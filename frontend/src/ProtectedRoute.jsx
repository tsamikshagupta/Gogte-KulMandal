import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function isAuthenticated() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return !!(token && token !== 'undefined' && token !== 'null' && token.trim() !== '');
}

function getUserRole() {
  const userStr = typeof window !== 'undefined' ? 
    (localStorage.getItem('user') || localStorage.getItem('currentUser')) : null;
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role || 'user';
    } catch (e) {
      return 'user';
    }
  }
  return 'user';
}

const ProtectedRoute = () => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  // Redirect DBA users to DBA dashboard
  const userRole = getUserRole();
  if (userRole === 'dba') {
    return <Navigate to="/dba-dashboard" replace />;
  }
  
  // Redirect Admin users to Admin dashboard
  if (userRole === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  return <Outlet />;
};

// DBA Protected Route
export const DBAProtectedRoute = () => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  const userRole = getUserRole();
  if (userRole !== 'dba') {
    return <Navigate to="/dashboard" replace />;
  }
  
  // If DBA user tries to access regular dashboard, redirect to DBA dashboard
  if (location.pathname === '/dashboard' && userRole === 'dba') {
    return <Navigate to="/dba-dashboard" replace />;
  }
  
  return <Outlet />;
};

// Admin Protected Route
export const AdminProtectedRoute = () => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  const userRole = getUserRole();
  if (userRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  // If Admin user tries to access regular dashboard, redirect to Admin dashboard
  if (location.pathname === '/dashboard' && userRole === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  
  return <Outlet />;
};

export default ProtectedRoute;

