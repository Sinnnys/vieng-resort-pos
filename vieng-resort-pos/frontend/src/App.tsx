import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerPage from './pages/CustomerPage';
import OrderStatusPage from './pages/OrderStatusPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { getStoredAdmin, setToken, setStoredAdmin } from './api';
import type { AdminUser } from './api';
import './App.css';

function AdminGuard() {
  const [admin, setAdmin] = useState<AdminUser | null>(getStoredAdmin);

  const handleLogout = useCallback(() => {
    setToken(null);
    setStoredAdmin(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    window.addEventListener('pos-logout', handleLogout);
    return () => window.removeEventListener('pos-logout', handleLogout);
  }, [handleLogout]);

  if (!admin) return <LoginPage onLogin={setAdmin} />;
  return <AdminPage admin={admin} onLogout={handleLogout} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<CustomerPage />} />
        <Route path="/table/:tableNumber/order/:orderId" element={<OrderStatusPage />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="*" element={<Navigate to="/table/1" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
