import React from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// User Pages
import DashboardPage from './pages/user/DashboardPage';
import ProfilePage from './pages/user/ProfilePage';
import DomainsPage from './pages/user/DomainsPage';
import DomainDetailPage from './pages/user/DomainDetailPage';
import ScenarioDetailPage from './pages/user/ScenarioDetailPage';
import AskScenarioPage from './pages/user/AskScenarioPage';
import MyRequestsPage from './pages/user/MyRequestsPage';
import RequestDetailPage from './pages/user/RequestDetailPage';

// Explorer Pages
import V1ExplorerLayout from './components/explorer/v1_ExplorerLayout';
import V1ExplorerDomainPage from './pages/explorer/v1_ExplorerDomainPage';
import V1ExplorerReportPage from './pages/explorer/v1_ExplorerReportPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UsersManagement from './pages/admin/UsersManagement';
import RolesManagement from './pages/admin/RolesManagement';
import DomainsManagement from './pages/admin/DomainsManagement';
import ScenariosManagement from './pages/admin/ScenariosManagement';
import ScenarioRequestsManagement from './pages/admin/ScenarioRequestsManagement';
import GroupsManagement from './pages/admin/GroupsManagement';
import PermissionsManagement from './pages/admin/PermissionsManagement';
import ConfigurationsManagement from './pages/admin/ConfigurationsManagement';
import PlayboardsManagement from './pages/admin/PlayboardsManagement';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';
import ErrorLogsPage from './pages/admin/ErrorLogsPage';
import BulkUploadPage from './pages/admin/BulkUploadPage';
import CustomersManagement from './pages/admin/CustomersManagement';
import FeedbackManagement from './pages/admin/FeedbackManagement';
import ApiConfigsManagement from './pages/admin/ApiConfigsManagement';
import DistributionListManagement from './pages/admin/DistributionListManagement';

// Public Pages
import FeedbackPage from './pages/FeedbackPage';

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false, requireGroupAdmin = false }) {
  const { user, loading, isSuperAdmin, isAdmin, canManageUsers } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireGroupAdmin && !canManageUsers()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Public Route (redirect if already logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Public Feedback Route (no auth required) */}
        <Route path="/feedback" element={<FeedbackPage />} />

        {/* Protected User Routes */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="/domains/:domainKey" element={<DomainDetailPage />} />
          <Route path="/domains/:domainKey/scenarios/:scenarioKey" element={<ScenarioDetailPage />} />
          <Route path="/scenarios/:scenarioKey" element={<ScenarioDetailPage />} />
          <Route path="/ask-scenario" element={<AskScenarioPage />} />
          <Route path="/my-requests" element={<MyRequestsPage />} />
          <Route path="/my-requests/:requestId" element={<RequestDetailPage />} />
          <Route path="/my-requests/:requestId/edit" element={<AskScenarioPage />} />

          {/* Explorer Routes */}
          <Route path="/explorer" element={<V1ExplorerLayout />}>
            <Route path=":dataDomain" element={<V1ExplorerDomainPage />} />
            <Route path=":dataDomain/:scenarioKey" element={<V1ExplorerReportPage />} />
          </Route>
        </Route>

        {/* Admin Routes - Super Admin Only */}
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <MainLayout isAdmin />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="roles" element={<RolesManagement />} />
          <Route path="groups" element={<GroupsManagement />} />
          <Route path="permissions" element={<PermissionsManagement />} />
          <Route path="domains" element={<DomainsManagement />} />
          <Route path="scenarios" element={<ScenariosManagement />} />
          <Route path="playboards" element={<PlayboardsManagement />} />
          <Route path="configurations" element={<ConfigurationsManagement />} />
          <Route path="scenario-requests" element={<ScenarioRequestsManagement />} />
          <Route path="scenario-requests/:requestId" element={<RequestDetailPage />} />
          <Route path="scenario-requests/:requestId/edit" element={<AskScenarioPage />} />
          <Route path="customers" element={<CustomersManagement />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
          <Route path="error-logs" element={<ErrorLogsPage />} />
          <Route path="bulk-upload" element={<BulkUploadPage />} />
          <Route path="feedback" element={<FeedbackManagement />} />
          <Route path="api-configs" element={<ApiConfigsManagement />} />
          <Route path="distribution-lists" element={<DistributionListManagement />} />
        </Route>

        {/* Group Admin Routes */}
        <Route path="/management" element={
          <ProtectedRoute requireGroupAdmin>
            <MainLayout isGroupAdmin />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersManagement />} />
          <Route path="domains" element={<DomainsManagement />} />
          <Route path="scenario-requests" element={<ScenarioRequestsManagement />} />
          <Route path="scenario-requests/:requestId" element={<RequestDetailPage />} />
          <Route path="scenario-requests/:requestId/edit" element={<AskScenarioPage />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
