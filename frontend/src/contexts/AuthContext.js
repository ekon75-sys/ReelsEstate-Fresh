import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext({});

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Configure axios to always send cookies AND auth header
axios.defaults.withCredentials = true;

// Add auth header interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      // Not authenticated, clear any stale token
      localStorage.removeItem('session_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const setUserData = (userData, sessionToken = null) => {
    setUser(userData);
    // Store session token if provided
    if (sessionToken) {
      localStorage.setItem('session_token', sessionToken);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('session_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUserData, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
