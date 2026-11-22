import axios from 'axios';

// Helper to check if hostname is a local LAN IP (e.g. 192.168.x.x, 10.x.x.x)
const isLocalLanIp = (hostname) => {
  return /^192\.168\.\d+\.\d+$/.test(hostname) ||
         /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
         /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);
};

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== 'http://localhost:5000/api') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (isLocalLanIp(window.location.hostname)) {
      return `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token to every request and auto-adapt to LAN host IP
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Only rewrite port 5000 if accessed via local LAN IP (not on cloud hosts like Vercel)
      if (window.location?.hostname && isLocalLanIp(window.location.hostname)) {
        config.baseURL = `${window.location.protocol}//${window.location.hostname}:5000/api`;
      }
      const token = localStorage.getItem('hms_token') || localStorage.getItem('token');
      if (token) {
        if (config.headers?.set) {
          config.headers.set('Authorization', `Bearer ${token}`);
          config.headers.set('x-auth-token', token);
        } else {
          config.headers['Authorization'] = `Bearer ${token}`;
          config.headers['x-auth-token'] = token;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);
export default api;


