import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router';
import App from './App';

// Mock all page components
vi.mock('./pages/auth/LoginPage', () => ({ default: () => <div>Login Page</div> }));
vi.mock('./pages/auth/RegisterPage', () => ({ default: () => <div>Register Page</div> }));
vi.mock('./pages/auth/ForgotPasswordPage', () => ({ default: () => <div>Forgot Password Page</div> }));
vi.mock('./pages/auth/ResetPasswordPage', () => ({ default: () => <div>Reset Password Page</div> }));
vi.mock('./pages/user/DashboardPage', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('./pages/user/ProfilePage', () => ({ default: () => <div>Profile Page</div> }));
vi.mock('./pages/user/DomainsPage', () => ({ default: () => <div>Domains Page</div> }));
vi.mock('./pages/user/DomainDetailPage', () => ({ default: () => <div>Domain Detail</div> }));
vi.mock('./pages/user/ScenarioDetailPage', () => ({ default: () => <div>Scenario Detail</div> }));
vi.mock('./pages/user/AskScenarioPage', () => ({ default: () => <div>Ask Scenario</div> }));
vi.mock('./pages/user/MyRequestsPage', () => ({ default: () => <div>My Requests</div> }));
vi.mock('./pages/user/RequestDetailPage', () => ({ default: () => <div>Request Detail</div> }));
vi.mock('./pages/explorer/v1_ExplorerDomainPage', () => ({ default: () => <div>Explorer Domain</div> }));
vi.mock('./pages/explorer/v1_ExplorerReportPage', () => ({ default: () => <div>Explorer Report</div> }));
vi.mock('./pages/admin/AdminDashboard', () => ({ default: () => <div>Admin Dashboard</div> }));
vi.mock('./pages/admin/UsersManagement', () => ({ default: () => <div>Users Management</div> }));
vi.mock('./pages/admin/RolesManagement', () => ({ default: () => <div>Roles Management</div> }));
vi.mock('./pages/admin/DomainsManagement', () => ({ default: () => <div>Domains Management</div> }));
vi.mock('./pages/admin/ScenariosManagement', () => ({ default: () => <div>Scenarios Management</div> }));
vi.mock('./pages/admin/ScenarioRequestsManagement', () => ({ default: () => <div>Scenario Requests</div> }));
vi.mock('./pages/admin/GroupsManagement', () => ({ default: () => <div>Groups Management</div> }));
vi.mock('./pages/admin/PermissionsManagement', () => ({ default: () => <div>Permissions Management</div> }));
vi.mock('./pages/admin/ConfigurationsManagement', () => ({ default: () => <div>Configurations</div> }));
vi.mock('./pages/admin/PlayboardsManagement', () => ({ default: () => <div>Playboards</div> }));
vi.mock('./pages/admin/ActivityLogsPage', () => ({ default: () => <div>Activity Logs</div> }));
vi.mock('./pages/admin/ErrorLogsPage', () => ({ default: () => <div>Error Logs</div> }));
vi.mock('./pages/admin/BulkUploadPage', () => ({ default: () => <div>Bulk Upload</div> }));
vi.mock('./pages/admin/CustomersManagement', () => ({ default: () => <div>Customers</div> }));
vi.mock('./pages/admin/FeedbackManagement', () => ({ default: () => <div>Feedback Management</div> }));
vi.mock('./pages/admin/ApiConfigsManagement', () => ({ default: () => <div>API Configs</div> }));
vi.mock('./pages/admin/DistributionListManagement', () => ({ default: () => <div>Distribution Lists</div> }));
vi.mock('./pages/FeedbackPage', () => ({ default: () => <div>Feedback Page</div> }));

// Layout mocks that render Outlet
vi.mock('./components/layout/MainLayout', () => ({
  default: () => <div data-testid="main-layout"><Outlet /></div>,
}));
vi.mock('./components/layout/AuthLayout', () => ({
  default: () => <div data-testid="auth-layout"><Outlet /></div>,
}));
vi.mock('./components/explorer/v1_ExplorerLayout', () => ({
  default: () => <div data-testid="explorer-layout"><Outlet /></div>,
}));

let mockAuthValue = {};
vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('public routes', () => {
    beforeEach(() => {
      mockAuthValue = { user: null, loading: false };
    });

    it('renders login page', () => {
      render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('renders register page', () => {
      render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>);
      expect(screen.getByText('Register Page')).toBeInTheDocument();
    });

    it('renders forgot password page', () => {
      render(<MemoryRouter initialEntries={['/forgot-password']}><App /></MemoryRouter>);
      expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
    });

    it('renders feedback page (no auth required)', () => {
      render(<MemoryRouter initialEntries={['/feedback']}><App /></MemoryRouter>);
      expect(screen.getByText('Feedback Page')).toBeInTheDocument();
    });
  });

  describe('public route redirect when logged in', () => {
    it('redirects from login to dashboard when user is logged in', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });

  describe('protected routes', () => {
    it('redirects to login when not authenticated', () => {
      mockAuthValue = { user: null, loading: false };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('renders dashboard when authenticated', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        isAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('renders profile page when authenticated', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/profile']}><App /></MemoryRouter>);
      expect(screen.getByText('Profile Page')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockAuthValue = { user: null, loading: true };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
    });
  });

  describe('admin routes', () => {
    it('redirects non-admin to dashboard', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('renders admin dashboard for super-admin', () => {
      mockAuthValue = {
        user: { email: 'admin@test.com', roles: ['super-administrator'] },
        loading: false,
        isSuperAdmin: () => true,
        canManageUsers: () => true,
      };
      render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });

  describe('redirects', () => {
    it('redirects / to /dashboard', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });

    it('redirects unknown routes to /dashboard', () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/nonexistent']}><App /></MemoryRouter>);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });
});
