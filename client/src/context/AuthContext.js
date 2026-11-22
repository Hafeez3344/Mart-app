'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkUserLoggedIn();
  }, []);

  const checkUserLoggedIn = async () => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('hms_token') || localStorage.getItem('token')) : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      } else {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth verification error:', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Protect against Chrome/Safari BFCache restoration when logged out
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        const token = localStorage.getItem('hms_token') || localStorage.getItem('token');
        const isPublic = window.location.pathname === '/login' || window.location.pathname === '/';
        if (!token && !isPublic) {
          window.location.replace('/login');
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // Route transition guard: if browsing a protected route without token, redirect immediately
  useEffect(() => {
    if (pathname && pathname !== '/login' && pathname !== '/') {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('hms_token') || localStorage.getItem('token')) : null;
      if (!token) {
        window.location.replace('/login');
      }
    }
  }, [pathname]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('hms_token', res.data.token);
        setUser(res.data.user);

        const role = res.data.user.role;
        let targetPath = '/pos';
        if (role === 'ADMIN' || role === 'MANAGER') {
          targetPath = '/admin';
        } else if (role === 'CASHIER') {
          targetPath = '/pos';
        } else if (role === 'STOCK_KEEPER') {
          targetPath = '/products';
        } else if (role === 'ACCOUNTANT') {
          targetPath = '/expenses';
        } else {
          targetPath = '/pos';
        }

        router.push(targetPath);
        return { success: true };
      }

      return {
        success: false,
        message: res.data.message || 'Login failed. Please check your credentials.',
      };
    } catch (err) {
      if (!err.response) {
        return {
          success: false,
          message: 'Unable to connect to backend server. If using Vercel, please ensure your backend API is deployed and NEXT_PUBLIC_API_URL is configured.',
        };
      }
      return {
        success: false,
        message: err.response.data?.message || 'Login failed. Please check your credentials.',
      };
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('hms_token');
      localStorage.removeItem('token');
      sessionStorage.clear();
    } catch (e) {
      console.error('Logout cleanup error:', e);
    }
    setUser(null);
    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkUserLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
