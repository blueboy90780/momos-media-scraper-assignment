const cheerio = require('cheerio');
const axios = require('axios');
const Queue = require('bull');

// Parse environment variables as integers and ensure they are valid numbers
const BATCH_SIZE = Math.max(1, Math.floor(parseInt(process.env.BATCH_SIZE) || 50));
const QUEUE_CONCURRENCY = Math.max(1, Math.floor(parseInt(process.env.QUEUE_CONCURRENCY) || 2));
const MAX_MEMORY_USAGE = Math.max(100, Math.floor(parseInt(process.env.MAX_MEMORY_USAGE) || 500));

// Queue configuration
const queueConfig = {
  redis: {
    port: 6379,
    host: process.env.REDIS_HOST || 'redis',
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('Redis connection failed after multiple retries');
        return null;
      }
      return Math.min(times * 500, 2000);
    },
    maxRetriesPerRequest: 5,
    enableReadyCheck: false,
    connectTimeout: 10000
  },
  limiter: {
    max: 100,
    duration: 5000
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 3
  }
};

// Create Redis queue
const scrapingQueue = new Queue('media-scraping', queueConfig);

// Memory usage check
const checkMemoryUsage = () => {
  const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  if (usedMemory > MAX_MEMORY_USAGE) {
    return new Promise((resolve) => {
      setTimeout(resolve, 5000); // Wait 5s if memory usage is high
    });
  }
  return Promise.resolve();
};

// Batch processor function
async function processBatch(urls) {
  const results = [];
  const errors = [];
  
  for (const url of urls) {
    try {
      await checkMemoryUsage();
      const media = await scrapeUrl(url);
      
      // If media items were found, add them to results
      if (media.length > 0) {
        results.push(...media);
      } else {
        // If no media was found, still mark as processed but with no media
        results.push({
          sourceUrl: url,
          mediaUrl: null,
          type: null,
          status: 'processed'
        });
      }
      
      // Free up memory
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
      errors.push({ sourceUrl: url, error: error.message });
    }
  }
  return { results, errors };
}

// Process queue with integer concurrency
scrapingQueue.process(QUEUE_CONCURRENCY, async (job) => {
  console.log(`Processing job ${job.id} with concurrency ${QUEUE_CONCURRENCY}`);
  const { urls } = job.data;
  const batches = [];
  
  // Split URLs into batches
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }

  const allResults = [];
  const allErrors = [];
  let processedUrls = 0;
  
  for (const batch of batches) {
    try {
      const { results, errors } = await processBatch(batch);
      if (results && results.length > 0) {
        allResults.push(...results);
      }
      if (errors && errors.length > 0) {
        allErrors.push(...errors);
      }
      
      // Update processed count and job progress more accurately
      processedUrls += batch.length;
      const progress = Math.floor((processedUrls / urls.length) * 100);
      await job.progress(progress);
      
      // Emit progress event through Redis
      try {
        await scrapingQueue.client.publish('scraping-progress', JSON.stringify({
          jobId: job.id,
          progress,
          processed: processedUrls,
          total: urls.length,
          batch: {
            results: results.length,
            errors: errors.length
          }
        }));
      } catch (redisError) {
        console.warn('Redis publish error (non-critical):', redisError.message);
      }
      
    } catch (error) {
      console.error(`Error processing batch:`, error);
      batch.forEach(url => {
        allErrors.push({ sourceUrl: url, error: 'Batch processing failed' });
      });
      processedUrls += batch.length;
    }
    
    // Small delay between batches to prevent overload
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Job ${job.id} completed. Results: ${allResults.length}, Errors: ${allErrors.length}`);
  return { results: allResults, errors: allErrors };
});

async function scrapeUrl(url) {
  try {
    console.log(`Starting to scrape URL: ${url}`);
    
    // Normalize URL to ensure it's properly formatted
    url = normalizeUrl(url);
    
    // Configure axios with more robust options
    const response = await axios.get(url, {
      timeout: 45000, // Increased timeout for slower pages
      maxContentLength: 20000000, // 20MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com/'
      },
      validateStatus: status => status < 500, // Accept all responses below 500 status
      responseType: 'text',
      decompress: true,
      maxRedirects: 10
    });

    // Handle non-200 responses that might still contain usable data
    if (response.status !== 200) {
      console.warn(`Received non-200 status code ${response.status} for ${url}, but continuing processing`);
    }

    if (!response.data) {
      console.warn(`Empty response received from ${url}, marking as processed with no media`);
      return [{
        sourceUrl: url,
        mediaUrl: null,
        type: null,
        status: 'processed'
      }];
    }

    const $ = cheerio.load(response.data);
    const media = [];
    const baseUrl = new URL(url);
    const processedUrls = new Set();
    const isWikipedia = url.includes('wikipedia.org');

    if (isWikipedia) {
      // For Wikipedia, specifically target content images
      const wikiImageSelectors = [
        'table.infobox img',
        'div.thumbinner img',
        'div.thumb img',
        '.image img',
        '.mw-file-element',
        'figure.mw-default-size img',
        'img.mw-headline-anchor',
        'a.image img',
        'img[src*="upload.wikimedia.org"]',
        '.wikitable img'
      ];

      $(wikiImageSelectors.join(', ')).each((_, element) => {
        try {
          const $img = $(element);
          // Try multiple potential sources in order of preference
          let src = $img.attr('src') || 
                    $img.attr('data-src') || 
                    $img.parent('a').attr('href');
          
          if (!src) return;

          // Skip icons and small images except if in infobox
          const width = parseInt($img.attr('width')) || 0;
          const height = parseInt($img.attr('height')) || 0;
          const inInfobox = $img.closest('table.infobox').length > 0;
          if (!inInfobox && width < 100 && height < 100) return;

          // Convert protocol-relative URLs to https
          if (src.startsWith('//')) {
            src = 'https:' + src;
          }

          // For Wikipedia image links
          if (src.startsWith('/wiki/File:')) {
            src = 'https://en.wikipedia.org' + src;
          }

          // Clean up Wikipedia thumbnail URLs to get original images
          if (src.includes('/thumb/')) {
            // Only modify if it's clearly a thumbnail URL pattern
            try {
              const parts = src.split('/');
              // Remove thumbnail and resolution specification
              if (parts.length > 2) {
                // Remove the last part (resolution)
                parts.pop();
                // Remove 'thumb' from the path
                const thumbIndex = parts.indexOf('thumb');
                if (thumbIndex !== -1) {
                  parts.splice(thumbIndex, 1);
                }
                src = parts.join('/');
              }
            } catch (err) {
              console.warn('Error cleaning Wikipedia thumbnail URL:', err.message);
              // Use original src if cleaning fails
            }
          }

          // Always use HTTPS for Wikipedia media
          src = src.replace('http://', 'https://');
          
          // Handle SVG thumbnails which are rendered as PNG
          if (src.includes('.svg.') && src.endsWith('.png')) {
            try {
              // Try to get the original SVG
              const svgPath = src.split('/').slice(0, -1).join('/');
              const svgFilename = src.split('/').pop().replace('.svg.png', '.svg');
              src = `${svgPath}/${svgFilename}`;
            } catch (err) {
              console.warn('Error converting SVG thumbnail URL:', err.message);
            }
          }
          
          // Convert Wikimedia Commons URLs
          if (src.includes('commons.wikimedia.org')) {
            src = src.replace('/commons/', '/upload.wikimedia.org/wikipedia/commons/');
          }

          const absoluteUrl = resolveUrl(src, baseUrl.href);
          if (absoluteUrl && !processedUrls.has(absoluteUrl) &&
              !absoluteUrl.includes('Special:') &&
              !absoluteUrl.includes('w/index.php')) {
            processedUrls.add(absoluteUrl);
            media.push({
              sourceUrl: url,
              mediaUrl: absoluteUrl,
              type: 'image',
              status: 'processed'
            });
            console.log(`Found Wikipedia image: ${absoluteUrl}`);
          }
        } catch (err) {
          console.error('Error processing Wikipedia image:', err.message);
        }
      });
    } else {
      // Non-Wikipedia image processing with broader selectors
      try {
        $('img, picture img, picture source[srcset], .image img, .thumb img, .gallery img, .infobox-image img, figure img, a.image img, [data-src]').each((_, element) => {
          try {
            const $img = $(element);
            // Try multiple potential image source attributes in order of preference
            let src = $img.attr('src') || 
                      $img.attr('data-src') || 
                      $img.attr('data-lazy-src') || 
                      $img.attr('data-original') ||
                      $img.attr('data-srcset')?.split(' ')[0] || 
                      $img.attr('srcset')?.split(' ')[0] ||
                      $img.closest('picture').find('source').attr('srcset')?.split(' ')[0];
            
            // Skip small icons and logos unless they're clearly content
            const imgClass = $img.attr('class') || '';
            const imgId = $img.attr('id') || '';
            const imgAlt = $img.attr('alt') || '';
            
            // Skip obvious UI elements
            if ((imgClass.includes('icon') && !imgClass.includes('content')) || 
                imgClass.includes('logo') || 
                imgClass.includes('avatar') ||
                imgId.includes('logo') || 
                imgAlt.includes('logo')) {
              return;
            }
            
            if (!src) return;
            
            // Remove any query parameters that might affect image quality
            // But preserve crucial query params for sites that require them
            if (!src.includes('imgurl=') && !src.includes('image_url=')) {
              src = src.split('?')[0];
            }
            
            // Convert relative URLs to absolute
            const absoluteUrl = resolveUrl(src, baseUrl.href);
            if (absoluteUrl && !processedUrls.has(absoluteUrl)) {
              processedUrls.add(absoluteUrl);
              
              // Get dimensions (when available)
              const width = parseInt($img.attr('width')) || parseInt($img.attr('data-width')) || 0;
              const height = parseInt($img.attr('height')) || parseInt($img.attr('data-height')) || 0;
              
              // Filter out very small images, data URIs, and SVGs
              // But include images without dimensions (we can't tell their size)
              if ((width === 0 || height === 0 || width > 100 || height > 100) && 
                  !absoluteUrl.startsWith('data:') && 
                  !absoluteUrl.endsWith('.svg')) {
                media.push({
                  sourceUrl: url,
                  mediaUrl: absoluteUrl,
                  type: 'image',
                  status: 'processed'
                });
                console.log(`Found image: ${absoluteUrl}`);
              }
            }
          } catch (err) {
            console.error('Error processing image:', err.message);
          }
        });
      } catch (err) {
        console.error('Error finding images:', err.message);
      }
    }

    // Process videos with improved selectors
    $('video source, video[src], iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[data-src*="youtube"], [data-video-src], a[href*="youtube.com/watch"], a[href*="youtu.be/"]').each((_, element) => {
      try {
        let src = null;
        const $el = $(element);
        
        // Handle different element types
        if (element.tagName === 'VIDEO') {
          src = $el.attr('src') || $el.find('source').first().attr('src');
        } else if (element.tagName === 'IFRAME') {
          src = $el.attr('src') || $el.attr('data-src');
        } else if (element.tagName === 'A' && ($el.attr('href')?.includes('youtube.com/watch') || $el.attr('href')?.includes('youtu.be/'))) {
          // Convert YouTube watch links to embeds
          const href = $el.attr('href');
          if (href.includes('youtube.com/watch')) {
            const videoId = new URL(href).searchParams.get('v');
            if (videoId) {
              src = `https://www.youtube.com/embed/${videoId}`;
            }
          } else if (href.includes('youtu.be/')) {
            const videoId = href.split('youtu.be/')[1].split('?')[0];
            if (videoId) {
              src = `https://www.youtube.com/embed/${videoId}`;
            }
          }
        } else {
          src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-video-src');
        }
        
        if (src) {
          // Convert relative URLs to absolute
          const absoluteUrl = resolveUrl(src, baseUrl.href);
          if (absoluteUrl && !processedUrls.has(absoluteUrl)) {
            processedUrls.add(absoluteUrl);
            
            media.push({
              sourceUrl: url,
              mediaUrl: absoluteUrl,
              type: 'video',
              status: 'processed'
            });
            console.log(`Found video: ${absoluteUrl}`);
          }
        }
      } catch (err) {
        console.error('Error processing video:', err.message);
      }
    });

    // Clear cheerio data from memory
    $.root().empty();
    
    if (media.length === 0) {
      // If no media found, still mark as processed
      media.push({
        sourceUrl: url,
        mediaUrl: null,
        type: null,
        status: 'processed'
      });
    }
    
    console.log(`Finished scraping ${url}. Found ${media.length} media items.`);
    return media;
  } catch (error) {
    // More detailed error logging
    console.error(`Error scraping ${url}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    // For some error types, try to return a processed status instead of failing
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.warn(`Timeout occurred for ${url}, marking as processed with no media`);
      return [{
        sourceUrl: url,
        mediaUrl: null,
        type: null,
        status: 'processed'
      }];
    }
    
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

// Function to normalize URLs before processing
function normalizeUrl(url) {
  try {
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse and reconstruct to ensure validity
    const parsedUrl = new URL(url);
    return parsedUrl.href;
  } catch (e) {
    console.error('Error normalizing URL:', e.message, { url });
    // Return original if parsing fails
    return url;
  }
}

// Function to resolve relative URLs to absolute URLs
function resolveUrl(relativeUrl, baseUrl) {
  try {
    // Handle protocol-relative URLs
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`;
    }
    
    // Handle Wikipedia's specific URL formats
    if (relativeUrl.startsWith('/wiki/')) {
      return `https://en.wikipedia.org${relativeUrl}`;
    }
    
    // Handle relative URLs that start with /
    if (relativeUrl.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${relativeUrl}`;
    }
    
    // Handle data URLs
    if (relativeUrl.startsWith('data:')) {
      return relativeUrl;
    }
    
    // Handle absolute URLs
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    
    // Handle all other cases
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    console.error('Error resolving URL:', e.message, { relativeUrl, baseUrl });
    return null;
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Handle queue events for monitoring
scrapingQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

scrapingQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
});

scrapingQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

// Add reconnect logic for Redis
scrapingQueue.on('error', async (err) => {
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    console.error('Redis connection lost. Attempting to reconnect...');
    try {
      await scrapingQueue.close();
      // Wait before attempting to reconnect
      await new Promise(resolve => setTimeout(resolve, 5000));
      // Re-create the queue
      scrapingQueue = new Queue('media-scraping', queueConfig);
    } catch (reconnectErr) {
      console.error('Failed to reconnect to Redis:', reconnectErr);
    }
  }
});

module.exports = {
  scrapingQueue,
  scrapeUrl
};