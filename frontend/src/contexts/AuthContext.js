import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext({});

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Configure axios to always send cookies
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    setToken(response.data.token);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    return response.data;
  };

  const register = async (email, password, name) => {
    const response = await axios.post(`${API_URL}/auth/register`, { email, password, name });
    setToken(response.data.token);
    localStorage.setItem('token', response.data.token);
    setUser(response.data.user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    return response.data;
  };

  const googleAuth = async (sessionId) => {
    console.log('Calling backend /auth/google with session_id');
    const response = await axios.post(`${API_URL}/auth/google`, { session_id: sessionId }, { withCredentials: true });
    console.log('Backend response:', response.data);
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
