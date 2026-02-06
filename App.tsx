
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChatProvider } from './contexts/ChatContext';
import Layout from './components/Layout';
import SystemConfigListener from './components/SystemConfigListener';
import ForceUpdatePopup from './components/ForceUpdatePopup';
import SystemNotificationModal from './components/SystemNotificationModal';
import Login from './pages/Login';
import Register from './pages/Register';
import UpdatePassword from './pages/UpdatePassword';
import LandingPage from './pages/LandingPage';
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
import CustomerFinance from './pages/CustomerFinance';
import TeamFund from './pages/TeamFund';
import FinanceHistory from './pages/FinanceHistory';
import CarPrices from './pages/CarPrices';
import BankRates from './pages/BankRates';
import Inventory from './pages/Inventory';
import Proposals from './pages/Proposals';
import Analytics from './pages/Analytics';
import CalendarPage from './pages/Calendar';
import OnlineQuote from './pages/OnlineQuote';
import BankCalculator from './pages/BankCalculator';
import LeadsQueue from './pages/LeadsQueue';
import LeadEmailSettings from './pages/LeadEmailSettings';
import Utilities from './pages/Utilities';
import NotFound from './pages/NotFound';
import Community from './pages/Community';
import GlobalChatBubble from './components/GlobalChatBubble';

const { BrowserRouter, Routes, Route, Navigate } = ReactRouterDOM as any;

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

import SupportWidget from './components/SupportWidget';

import { PresenceProvider } from './contexts/PresenceContext';
import useFcmToken from './src/hooks/useFcmToken';

const FcmInit: React.FC = () => {
  const { notificationPermissionStatus, requestPermission } = useFcmToken();
  const [showBanner, setShowBanner] = React.useState(true);

  if (notificationPermissionStatus === 'default' && showBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-primary-600 text-white p-4 flex justify-between items-center z-[200] animate-slide-up shadow-lg">
        <div className="flex flex-col mr-4">
          <span className="font-bold text-sm">Bật thông báo?</span>
          <span className="text-xs opacity-90">Nhận tin tức mới nhất từ hệ thống.</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBanner(false)}
            className="text-white/60 hover:text-white px-2 text-xs"
          >
            Để sau
          </button>
          <button
            onClick={requestPermission}
            className="bg-white text-primary-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-gray-100 transition-colors shadow-sm"
          >
            Bật ngay
          </button>
        </div>
      </div>
    );
  }
  return null;
}


const App: React.FC = () => {
  return (
    <AuthProvider>
      <PresenceProvider>
        <SystemConfigListener />
        <ForceUpdatePopup />
        <SystemNotificationModal />
        <ThemeProvider>
          <NotificationProvider>
            <ChatProvider>
              <BrowserRouter>
                <SupportWidget />
                <GlobalChatBubble />
                <FcmInit />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="/intro" element={<LandingPage />} />

                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />

                  {/* Customer Management */}
                  <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
                  <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />

                  {/* Lead Management */}
                  <Route path="/leads/assign" element={<ProtectedRoute><AssignCustomers /></ProtectedRoute>} />
                  <Route path="/leads/new" element={<ProtectedRoute><LeadsFromForm /></ProtectedRoute>} />
                  <Route path="/leads/queue" element={<ProtectedRoute><LeadsQueue /></ProtectedRoute>} />

                  {/* Sales & Orders */}
                  <Route path="/deals" element={<ProtectedRoute><Deals /></ProtectedRoute>} />
                  <Route path="/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
                  <Route path="/quote" element={<ProtectedRoute><OnlineQuote /></ProtectedRoute>} />
                  <Route path="/bank-calculator" element={<ProtectedRoute><BankCalculator /></ProtectedRoute>} />

                  {/* HR & Profile */}
                  <Route path="/employees" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
                  <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                  {/* Finance */}
                  <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                  <Route path="/finance/customer" element={<ProtectedRoute><CustomerFinance /></ProtectedRoute>} />
                  <Route path="/fund-history" element={<ProtectedRoute><FinanceHistory /></ProtectedRoute>} />
                  <Route path="/fund" element={<ProtectedRoute><TeamFund /></ProtectedRoute>} />

                  {/* Resources */}
                  <Route path="/resources/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
                  <Route path="/resources/cars" element={<ProtectedRoute><CarPrices /></ProtectedRoute>} />
                  <Route path="/resources/banks" element={<ProtectedRoute><BankRates /></ProtectedRoute>} />
                  <Route path="/resources/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />

                  {/* System */}
                  <Route path="/utilities" element={<ProtectedRoute><Utilities /></ProtectedRoute>} />
                  <Route path="/system" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
                  <Route path="/admin/lead-email-settings" element={<ProtectedRoute><LeadEmailSettings /></ProtectedRoute>} />
                  <Route path="/distributors" element={<Navigate to="/system" replace />} />
                  <Route path="/configuration" element={<Navigate to="/system" replace />} />

                  {/* Legacy Redirects */}
                  <Route path="/team-fund" element={<Navigate to="/fund" replace />} />
                  <Route path="/car-prices" element={<Navigate to="/resources/cars" replace />} />
                  <Route path="/bank-rates" element={<Navigate to="/resources/banks" replace />} />
                  <Route path="/inventory" element={<Navigate to="/resources/inventory" replace />} />
                  <Route path="/promotions" element={<Navigate to="/resources/promotions" replace />} />
                  <Route path="/leads-form" element={<Navigate to="/leads/new" replace />} />
                  <Route path="/leads-queue" element={<Navigate to="/leads/queue" replace />} />
                  <Route path="/assign" element={<Navigate to="/leads/assign" replace />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </ChatProvider>
          </NotificationProvider>
        </ThemeProvider>
      </PresenceProvider>
    </AuthProvider>
  );
};

export default App;

