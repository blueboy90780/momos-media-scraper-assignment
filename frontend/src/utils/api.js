import axios from 'axios';

// Determine if we're running on server or client side
const isServer = typeof window === 'undefined';

// Use the internal URL for server-side requests, public URL for client-side
const baseURL = isServer 
  ? (process.env.NEXT_PUBLIC_INTERNAL_API_URL || 'http://backend:3001/api')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api');

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  // For client-side, get token from localStorage
  // For server-side, token should be passed in headers
  const token = !isServer ? localStorage.getItem('token') : null;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The server responded with a status code outside of 2xx
      throw new Error(error.response.data.error || 'An error occurred');
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network error details:', {
        baseURL: api.defaults.baseURL,
        timeout: error.config?.timeout,
        method: error.config?.method,
        url: error.config?.url
      });
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Something happened in setting up the request
      throw new Error('Error setting up request');
    }
  }
);

// SSR-compatible fetch function for server components
export const fetchMediaSSR = async (options = {}) => {
  const serverUrl = process.env.NEXT_PUBLIC_INTERNAL_API_URL || 'http://backend:3001/api';
  
  try {
    const response = await fetch(`${serverUrl}/media`, {
      headers: {
        'Authorization': `Bearer ${process.env.INITIAL_AUTH_TOKEN || ''}`
      },
      next: { revalidate: options.revalidate || 60 }
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('SSR data fetching error:', error);
    return { media: [], pages: 0 };
  }
};

// Client-side API functions
export const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const scrapeUrls = async (urls) => {
  const response = await api.post('/media/scrape', { urls });
  return response.data;
};

export const getMedia = async ({ page = 1, filter = '', search = '', limit = 10 }) => {
  const response = await api.get('/media', {
    params: {
      page,
      type: filter,
      search,
      limit
    }
  });
  return response.data;
};

export const clearMedia = async () => {
  const response = await api.delete('/media/clear');
  return response.data;
};