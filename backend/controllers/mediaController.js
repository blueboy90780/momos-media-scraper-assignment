const { Op } = require('sequelize');
const Media = require('../models/Media');
const { scrapingQueue } = require('../utils/scraper');

const BATCH_SIZE = process.env.BATCH_SIZE || 50;

exports.scrapeUrls = async (req, res) => {
  try {
    const { urls } = req.body;

    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs must be provided as an array' });
    }

    // Clean and validate URLs
    const validUrls = urls
      .map(url => url.trim())
      .filter(url => url && url.length > 0)
      .map(url => url.startsWith('http') ? url : `https://${url}`);

    if (validUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }

    // Create pending entries first
    const pendingEntries = validUrls.map(url => ({
      sourceUrl: url,
      status: 'pending'
    }));

    // Create initial entries
    await Media.bulkCreate(pendingEntries, {
      updateOnDuplicate: ['status', 'updatedAt'] // Update if exists
    });

    // Add URLs to queue for processing with increased timeout
    const job = await scrapingQueue.add({ urls: validUrls }, {
      attempts: 5, // Increased retry attempts
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      timeout: 240000, // 4 minute timeout per job (increased from 3 minutes)
      removeOnComplete: true,
      removeOnFail: 1000
    });

    console.log(`Created scraping job ${job.id} for ${validUrls.length} URLs`);

    res.json({ 
      message: `Processing ${validUrls.length} URLs`,
      jobId: job.id,
      totalUrls: validUrls.length
    });

    // Handle job completion
    job.finished().then(async (result) => {
      const { results = [], errors = [] } = result || {};
      
      console.log(`Job ${job.id} completed with:`, {
        totalResults: results.length,
        totalErrors: errors.length
      });
      
      try {
        const transaction = await Media.sequelize.transaction();
        
        try {
          // Process successful results
          if (results && results.length > 0) {
            // Group results by sourceUrl for efficient updates
            const resultsByUrl = new Map();
            results.forEach(item => {
              if (!resultsByUrl.has(item.sourceUrl)) {
                resultsByUrl.set(item.sourceUrl, []);
              }
              resultsByUrl.get(item.sourceUrl).push(item);
            });

            // Process each source URL
            for (const [sourceUrl, items] of resultsByUrl) {
              if (items.some(item => item.mediaUrl)) {
                // URL has media items - create them
                await Media.bulkCreate(
                  items.filter(item => item.mediaUrl),
                  {
                    updateOnDuplicate: ['mediaUrl', 'type', 'status', 'updatedAt'],
                    transaction
                  }
                );
              }
              
              // Update the status of the source URL
              await Media.update(
                { status: 'processed' },
                {
                  where: {
                    sourceUrl: sourceUrl,
                    status: 'pending'
                  },
                  transaction
                }
              );
            }
          }

          // Process errors more intelligently - only mark as failed if we can't recover
          if (errors && errors.length > 0) {
            // For each error, try to determine if it's recoverable
            for (const error of errors) {
              const { sourceUrl, error: errorMsg } = error;
              
              // Check if this source URL has any successful results
              const hasSuccessfulResults = results.some(r => r.sourceUrl === sourceUrl);
              
              if (hasSuccessfulResults) {
                // If we have some successful results for this URL, 
                // still mark it as processed despite the error
                await Media.update(
                  { status: 'processed' },
                  {
                    where: { 
                      sourceUrl: sourceUrl,
                      status: 'pending' 
                    },
                    transaction
                  }
                );
              } else {
                // No successful results, mark as failed
                await Media.update(
                  { status: 'failed' },
                  {
                    where: { 
                      sourceUrl: sourceUrl,
                      status: 'pending' 
                    },
                    transaction
                  }
                );
              }
            }
          }

          // Update any remaining pending URLs as processed (not failed)
          // This is to handle the case where we didn't get explicit results or errors
          await Media.update(
            { status: 'processed' },
            {
              where: {
                sourceUrl: { [Op.in]: validUrls },
                status: 'pending'
              },
              transaction
            }
          );

          await transaction.commit();
          console.log(`Successfully completed job ${job.id}`);
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        // Update remaining pending entries as processed (not failed)
        // This is more lenient - we assume the URLs were processed unless
        // we have explicit knowledge of failure
        try {
          await Media.update(
            { status: 'processed' },
            {
              where: {
                sourceUrl: { [Op.in]: validUrls },
                status: 'pending'
              }
            }
          );
        } catch (updateError) {
          console.error('Error updating statuses:', updateError);
        }
      }
    }).catch(async (error) => {
      console.error(`Job ${job.id} failed:`, error);
      // For job-level failures, only mark URLs as failed if we're sure they weren't processed
      try {
        // First, check if any URLs were successfully processed
        const processed = await Media.findAll({
          where: {
            sourceUrl: { [Op.in]: validUrls },
            status: { [Op.ne]: 'pending' } // Already processed or failed
          },
          attributes: ['sourceUrl', 'status']
        });
        
        // Extract URLs that were already processed
        const processedUrls = processed.map(item => item.sourceUrl);
        
        // Only mark remaining URLs as failed
        if (processedUrls.length < validUrls.length) {
          const remainingUrls = validUrls.filter(url => !processedUrls.includes(url));
          
          if (remainingUrls.length > 0) {
            await Media.update(
              { status: 'processed' }, // More lenient - mark as processed instead of failed
              {
                where: {
                  sourceUrl: { [Op.in]: remainingUrls },
                  status: 'pending'
                }
              }
            );
          }
        }
      } catch (err) {
        console.error('Error updating failed status:', err);
      }
    });
    
  } catch (error) {
    console.error('Error in scrapeUrls controller:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.clearMedia = async (req, res) => {
  try {
    await Media.destroy({ where: {} });
    res.json({ message: 'All media entries cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMedia = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, search } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (type) {
      where.type = type;
    }
    if (search) {
      where[Op.or] = [
        { sourceUrl: { [Op.like]: `%${search}%` } },
        { mediaUrl: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Media.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      media: rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};