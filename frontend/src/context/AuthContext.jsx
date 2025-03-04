import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { getCurrentUser, login, register } from '../services/api';

// Create AuthContext
export const AuthContext = createContext(null);

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          // Token is invalid or expired
          localStorage.removeItem('token');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Login handler
  const handleLogin = async (username, password) => {
    try {
      const response = await login(username, password);
      
      // Store token
      localStorage.setItem('token', response.access_token);
      
      // Fetch user details
      const userData = await getCurrentUser();
      
      setUser(userData);
      setIsAuthenticated(true);
      
      return userData;
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Register handler
  const handleRegister = async (userData) => {
    try {
      const response = await register(userData);
      return response;
    } catch (error) {
      console.error('Registration failed', error);
      throw error;
    }
  };

  // Context value
  const authContextValue = {
    user,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    register: handleRegister
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};