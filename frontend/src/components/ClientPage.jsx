'use client';

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styles from '../app/page.module.css';
import LoginForm from './LoginForm.jsx';
import ScrapeForm from './ScrapeForm.jsx';
import SubmittedLinks from './SubmittedLinks.jsx';
import MediaControls from './MediaControls.jsx';
import MediaCard from './MediaCard.jsx';
import Pagination from './Pagination.jsx';
import * as api from '../utils/api';

export default function ClientPage({ initialData }) {
  // State management
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [urls, setUrls] = useState('');
  const [submittedUrls, setSubmittedUrls] = useState([]);
  const [mediaItems, setMediaItems] = useState(initialData?.media || []);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialData?.pages || 1);
  const [initialLoad, setInitialLoad] = useState(true);
  const [processingJob, setProcessingJob] = useState(null);
  const [hasPendingUrls, setHasPendingUrls] = useState(false);
  
  // For loading states during client-side transitions
  const [isPending, startTransition] = useTransition();
  
  // Refs
  const statusCheckIntervalRef = useRef(null);
  const previousUrlStatusesRef = useRef({});

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Try to fetch media to verify token is still valid
          await api.getMedia({ page: 1 });
          setIsLoggedIn(true);
          
          // If we have initial data from SSR and we're authenticated, use it
          if (initialData?.media?.length > 0) {
            setMediaItems(initialData.media);
            setTotalPages(initialData.pages || 1);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
        }
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, [initialData]);

  // Load submitted URLs from localStorage only after auth check
  useEffect(() => {
    if (!isCheckingAuth) {
      const savedUrls = localStorage.getItem('submittedUrls');
      if (savedUrls) {
        const parsed = JSON.parse(savedUrls);
        setSubmittedUrls(parsed);
        
        // Initialize previous statuses
        const statusMap = {};
        parsed.forEach(urlObj => {
          statusMap[urlObj.url] = urlObj.status;
        });
        previousUrlStatusesRef.current = statusMap;
        
        // Check if we have any pending URLs to monitor
        setHasPendingUrls(parsed.some(url => url.status === 'pending'));
      }
      setInitialLoad(false);
    }
  }, [isCheckingAuth]);

  // Save submitted URLs whenever they change
  useEffect(() => {
    if (submittedUrls.length > 0) {
      localStorage.setItem('submittedUrls', JSON.stringify(submittedUrls));
      // Update our pending flag whenever submitted URLs change
      setHasPendingUrls(submittedUrls.some(url => url.status === 'pending'));
    }
  }, [submittedUrls]);

  // Setup polling for URL status updates when we have pending URLs
  useEffect(() => {
    // Clear existing interval if any
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }

    // If we're logged in and have pending URLs, start polling
    if (isLoggedIn && hasPendingUrls) {
      statusCheckIntervalRef.current = setInterval(() => {
        checkPendingUrlsStatus();
      }, 2000); // Check every 2 seconds
    }

    // Cleanup on unmount
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, [isLoggedIn, hasPendingUrls]);

  // Fetch media when page, filter, or search changes using client-side transitions
  useEffect(() => {
    if (!initialLoad && isLoggedIn) {
      // Use a transition to indicate loading state without blocking the UI
      startTransition(() => {
        fetchMedia();
      });
    }
  }, [page, filter, searchTerm, isLoggedIn, initialLoad]);

  // Memoized fetch function to prevent unnecessary rerenders
  const fetchMedia = useCallback(async () => {
    if (!isLoggedIn || loading) return;
    
    try {
      setLoading(true);
      const response = await api.getMedia({
        page,
        filter,
        search: searchTerm
      });
      
      setMediaItems(response.media);
      setTotalPages(response.pages);
      
      // Update status of submitted URLs based on media data
      if (response.media.length > 0) {
        updateUrlStatuses(response.media);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      toast.error('Failed to fetch media items');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, loading, page, filter, searchTerm]);

  const checkPendingUrlsStatus = async () => {
    if (!isLoggedIn || !hasPendingUrls) return;

    try {
      // Get all pending URLs
      const pendingUrls = submittedUrls
        .filter(urlObj => urlObj.status === 'pending')
        .map(urlObj => urlObj.url);

      if (pendingUrls.length === 0) return;

      console.log('Checking status of pending URLs:', pendingUrls.length);

      // Get first page of results with a large limit to try to capture our pending URLs
      const response = await api.getMedia({
        page: 1,
        limit: 50, // Use a larger limit to try to get all processed URLs
        search: '' // No filtering to get all results
      });
      
      if (response.media && response.media.length > 0) {
        updateUrlStatuses(response.media);
        
        // Refresh media display if we're on first page with no filters
        if (page === 1 && !filter && !searchTerm) {
          setMediaItems(response.media);
          setTotalPages(response.pages);
        }
      }
    } catch (error) {
      console.error('Error checking pending URLs status:', error);
      // Don't show error toast to user - this is a background operation
    }
  };

  const updateUrlStatuses = (mediaData) => {
    const newSubmittedUrls = [...submittedUrls];
    let hasUpdates = false;
    // Get the previous statuses for comparison
    const prevStatuses = {...previousUrlStatusesRef.current};
    const newStatuses = {...prevStatuses};

    mediaData.forEach(item => {
      const urlIndex = newSubmittedUrls.findIndex(u => u.url === item.sourceUrl);
      if (urlIndex !== -1) {
        const status = item.status || 'processed';
        if (newSubmittedUrls[urlIndex].status !== status) {
          // Status has changed
          const oldStatus = newSubmittedUrls[urlIndex].status;
          newSubmittedUrls[urlIndex].status = status;
          newStatuses[item.sourceUrl] = status;
          hasUpdates = true;
          
          // Show a toast notification for status changes from pending to processed/failed
          if (oldStatus === 'pending' && (status === 'processed' || status === 'failed')) {
            const shortUrl = item.sourceUrl.length > 50 
              ? item.sourceUrl.substring(0, 47) + '...' 
              : item.sourceUrl;
              
            if (status === 'processed') {
              toast.success(`URL processed successfully: ${shortUrl}`);
            } else if (status === 'failed') {
              toast.error(`Processing failed for: ${shortUrl}`);
            }
          }
        }
      }
    });

    if (hasUpdates) {
      setSubmittedUrls(newSubmittedUrls);
      previousUrlStatusesRef.current = newStatuses;
      
      // If all pending URLs are now processed, we can stop the polling
      const stillHasPending = newSubmittedUrls.some(url => url.status === 'pending');
      if (!stillHasPending && hasPendingUrls) {
        setHasPendingUrls(false);
        
        // Show a summary toast when all URLs have been processed
        const totalUrls = newSubmittedUrls.length;
        const processedUrls = newSubmittedUrls.filter(url => url.status === 'processed').length;
        const failedUrls = newSubmittedUrls.filter(url => url.status === 'failed').length;
        
        // Use a different toast type (success) with longer duration for better visibility
        toast.success(
          `All URLs processed: ${processedUrls} successful, ${failedUrls} failed`, 
          { autoClose: 5000 }
        );
        
        // Fetch media one final time to ensure we have the latest data
        startTransition(() => {
          fetchMedia();
        });
      }
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const { token, username } = await api.login(credentials);
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      toast.success(`Welcome back, ${username}!`);
      
      // Once logged in, fetch media data client-side
      startTransition(() => {
        fetchMedia();
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Propagate error to LoginForm for display
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setMediaItems([]);
    setSubmittedUrls([]);
    toast.info('Logged out successfully');
  };

  const handleClearAll = async (e) => {
    e?.preventDefault();
    if (!window.confirm('Are you sure you want to clear all media?')) return;
    
    try {
      setLoading(true);
      await api.clearMedia();
      setMediaItems([]);
      setSubmittedUrls([]);
      localStorage.removeItem('submittedUrls');
      previousUrlStatusesRef.current = {}; // Reset status tracking
      toast.success('All media cleared successfully');
    } catch (error) {
      console.error('Error clearing media:', error);
      toast.error('Failed to clear media');
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    const urlList = urls.split(/[\n,]+/).map(url => url.trim()).filter(Boolean);
    
    if (urlList.length === 0) {
      toast.warning('Please enter at least one valid URL');
      return;
    }

    try {
      setLoading(true);
      const response = await api.scrapeUrls(urlList);
      
      // Add URLs to submitted list with pending status
      const newUrls = urlList.map(url => ({
        url,
        status: 'pending'
      }));
      
      // Update the previous statuses with the new URLs
      const newStatuses = {...previousUrlStatusesRef.current};
      urlList.forEach(url => {
        newStatuses[url] = 'pending';
      });
      previousUrlStatusesRef.current = newStatuses;
      
      setSubmittedUrls(prev => [...newUrls, ...prev]);
      setUrls(''); // Clear input
      setProcessingJob(response.jobId);
      
      toast.info(`Processing ${urlList.length} URLs...`, {
        autoClose: 3000
      });
      
      // Set hasPendingUrls to true to start polling
      setHasPendingUrls(true);
      
      // Start immediate status checking
      checkPendingUrlsStatus();
      
      // Fetch media after a short delay to allow initial processing
      setTimeout(() => {
        startTransition(() => {
          fetchMedia();
        });
      }, 2000);
    } catch (error) {
      console.error('Error scraping URLs:', error);
      toast.error('Failed to start scraping');
    } finally {
      setLoading(false);
    }
  };

  // Show a loading indicator for both auth check and CSR transitions
  if (isCheckingAuth || isPending) {
    return (
      <div className={styles.loadingContainer}>
        {isCheckingAuth ? 'Loading authentication status...' : 'Loading content...'}
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <button onClick={handleLogout}>Logout</button>
      </nav>

      <ScrapeForm
        urls={urls}
        onUrlsChange={setUrls}
        onScrape={handleScrape}
        onClearAll={handleClearAll}
        loading={loading}
      />

      <SubmittedLinks links={submittedUrls} />

      <section className={styles.mediaSection}>
        <MediaControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filter={filter}
          onFilterChange={setFilter}
        />

        <div className={styles.mediaGrid}>
          {mediaItems.length > 0 ? (
            mediaItems
              .filter(item => item.mediaUrl)
              .map((item) => (
                <MediaCard key={item.id} item={item} />
              ))
          ) : (
            <p className={styles.noContent}>
              {loading || isPending ? 'Loading...' : 'No media items found'}
            </p>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={loading || isPending}
        />
      </section>
      
      <ToastContainer 
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={5} 
      />
    </main>
  );
}