import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';

// Layouts (static imports — they wrap routes)
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Auth Pages (lazy)
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage'));

// User Pages (lazy)
const DashboardPage = React.lazy(() => import('./pages/user/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/user/ProfilePage'));
const DomainsPage = React.lazy(() => import('./pages/user/DomainsPage'));
const DomainDetailPage = React.lazy(() => import('./pages/user/DomainDetailPage'));
const ScenarioDetailPage = React.lazy(() => import('./pages/user/ScenarioDetailPage'));
const AskScenarioPage = React.lazy(() => import('./pages/user/AskScenarioPage'));
const MyRequestsPage = React.lazy(() => import('./pages/user/MyRequestsPage'));
const RequestDetailPage = React.lazy(() => import('./pages/user/RequestDetailPage'));

// Explorer Pages (lazy)
const V1ExplorerLayout = React.lazy(() => import('./components/explorer/v1_ExplorerLayout'));
const V1ExplorerDomainPage = React.lazy(() => import('./pages/explorer/v1_ExplorerDomainPage'));
const V1ExplorerReportPage = React.lazy(() => import('./pages/explorer/v1_ExplorerReportPage'));

// Admin Pages (lazy)
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const UsersManagement = React.lazy(() => import('./pages/admin/UsersManagement'));
const RolesManagement = React.lazy(() => import('./pages/admin/RolesManagement'));
const DomainsManagement = React.lazy(() => import('./pages/admin/DomainsManagement'));
const ScenariosManagement = React.lazy(() => import('./pages/admin/ScenariosManagement'));
const ScenarioRequestsManagement = React.lazy(() => import('./pages/admin/ScenarioRequestsManagement'));
const GroupsManagement = React.lazy(() => import('./pages/admin/GroupsManagement'));
const PermissionsManagement = React.lazy(() => import('./pages/admin/PermissionsManagement'));
const ConfigurationsManagement = React.lazy(() => import('./pages/admin/ConfigurationsManagement'));
const PlayboardsManagement = React.lazy(() => import('./pages/admin/PlayboardsManagement'));
const ActivityLogsPage = React.lazy(() => import('./pages/admin/ActivityLogsPage'));
const ErrorLogsPage = React.lazy(() => import('./pages/admin/ErrorLogsPage'));
const BulkUploadPage = React.lazy(() => import('./pages/admin/BulkUploadPage'));
const CustomersManagement = React.lazy(() => import('./pages/admin/CustomersManagement'));
const FeedbackManagement = React.lazy(() => import('./pages/admin/FeedbackManagement'));
const ApiConfigsManagement = React.lazy(() => import('./pages/admin/ApiConfigsManagement'));
const DistributionListManagement = React.lazy(() => import('./pages/admin/DistributionListManagement'));
const UISchemaManagement = React.lazy(() => import('./pages/admin/UISchemaManagement'));

// Public Pages (lazy)
const FeedbackPage = React.lazy(() => import('./pages/FeedbackPage'));

// Suspense fallback loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64" role="status" aria-label="Loading page">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    <span className="sr-only">Loading...</span>
  </div>
);

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false, requireGroupAdmin = false }) {
  const { user, loading, isSuperAdmin, canManageUsers } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" role="status" aria-label="Authenticating">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="sr-only">Authenticating...</span>
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
      <div className="flex items-center justify-center h-screen" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="sr-only">Loading...</span>
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
      <div aria-live="polite">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            },
          }}
        />
      </div>
      <Suspense fallback={<PageLoader />}>
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

          {/* UI Schemas — accessible from main menu with permission check */}
          <Route path="/ui-schemas" element={<UISchemaManagement />} />
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
          <Route path="ui-schemas" element={<UISchemaManagement />} />
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
          <Route path="ui-schemas" element={<UISchemaManagement />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default App;
