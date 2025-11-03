import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from '../axios';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessRole, setAccessRole] = useState(1); // 1=Staff, 3=HR, 4=Principal
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await axios.get('/login/check_session');
        if (res.data.message === 'Valid token') {
          setIsAuthenticated(true);
          setAccessRole(res.data.access_role || 1);
          setUser({ staffId: res.data.staff_id, accessRole: res.data.access_role });

        } else {
          setIsAuthenticated(false);
          setAccessRole(1);
          setUser(null);
        }
      } catch (err) {
        setIsAuthenticated(false);
        setAccessRole(1);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const login = async (credentials) => {
    try {
      const res = await axios.post('/login/login', credentials);
      if (res.data.message === 'Logged in successfully') {
        setIsAuthenticated(true);
        setAccessRole(res.data.access_role || 1);
        setUser({ staffId: res.data.staff_id, accessRole: res.data.access_role });
        return { success: true, access_role: res.data.access_role || 1 };
      }
      return { success: false, reason: 'unknown' };
    } catch (err) {
      if (err.response && err.response.status === 401) {
        return { success: false, reason: 'invalid_credentials' };
      }
      return { success: false, reason: 'network' };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/login/logout');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  const value = {
    isAuthenticated,
    login,
    logout,
    accessRole,
    user,
  };

  return loading ? (
    <div className="text-center mt-5">Checking session...</div>
  ) : (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
