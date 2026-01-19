
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import UpdatePassword from './pages/UpdatePassword';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CustomerDetail from './pages/CustomerDetail';
import EmployeeList from './pages/EmployeeList';
import EmployeeDetail from './pages/EmployeeDetail';
import Configuration from './pages/Configuration';
import Profile from './pages/Profile';
import Deals from './pages/Deals';
import AssignCustomers from './pages/AssignCustomers';
import LeadsFromForm from './pages/LeadsFromForm';
import Promotions from './pages/Promotions';
import Finance from './pages/Finance';
import TeamFund from './pages/TeamFund';
import CarPrices from './pages/CarPrices';
import BankRates from './pages/BankRates';
import Inventory from './pages/Inventory';
import Proposals from './pages/Proposals';
import Analytics from './pages/Analytics';
import CalendarPage from './pages/Calendar';
import OnlineQuote from './pages/OnlineQuote';
import BankCalculator from './pages/BankCalculator';

const { HashRouter, Routes, Route, Navigate } = ReactRouterDOM as any;

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
            <Route path="/assign" element={<ProtectedRoute><AssignCustomers /></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute><Deals /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
            <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
            
            <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
            <Route path="/quote" element={<ProtectedRoute><OnlineQuote /></ProtectedRoute>} />
            <Route path="/bank-calculator" element={<ProtectedRoute><BankCalculator /></ProtectedRoute>} />
            
            <Route path="/distributors" element={<Navigate to="/configuration" replace />} /> 
            
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/leads-form" element={<ProtectedRoute><LeadsFromForm /></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
            <Route path="/team-fund" element={<ProtectedRoute><TeamFund /></ProtectedRoute>} />
            <Route path="/car-prices" element={<ProtectedRoute><CarPrices /></ProtectedRoute>} />
            <Route path="/bank-rates" element={<ProtectedRoute><BankRates /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
