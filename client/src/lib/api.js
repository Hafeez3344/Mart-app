import axios from 'axios';

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== 'http://localhost:5000/api') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token to every request and auto-adapt to current host
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // If accessed via local Wi-Fi IP (e.g. 192.168.x.x) or domain, adapt baseURL dynamically
      if (window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
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


