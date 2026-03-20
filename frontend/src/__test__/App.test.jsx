import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock all page components
jest.mock('../pages/auth/LoginPage', () => ({ __esModule: true, default: () => <div>Login Page</div> }));
jest.mock('../pages/auth/RegisterPage', () => ({ __esModule: true, default: () => <div>Register Page</div> }));
jest.mock('../pages/auth/ForgotPasswordPage', () => ({ __esModule: true, default: () => <div>Forgot Password Page</div> }));
jest.mock('../pages/auth/ResetPasswordPage', () => ({ __esModule: true, default: () => <div>Reset Password Page</div> }));
jest.mock('../pages/user/DashboardPage', () => ({ __esModule: true, default: () => <div>Dashboard Page</div> }));
jest.mock('../pages/user/ProfilePage', () => ({ __esModule: true, default: () => <div>Profile Page</div> }));
jest.mock('../pages/user/DomainsPage', () => ({ __esModule: true, default: () => <div>Domains Page</div> }));
jest.mock('../pages/user/DomainDetailPage', () => ({ __esModule: true, default: () => <div>Domain Detail</div> }));
jest.mock('../pages/user/ScenarioDetailPage', () => ({ __esModule: true, default: () => <div>Scenario Detail</div> }));
jest.mock('../pages/user/AskScenarioPage', () => ({ __esModule: true, default: () => <div>Ask Scenario</div> }));
jest.mock('../pages/user/MyRequestsPage', () => ({ __esModule: true, default: () => <div>My Requests</div> }));
jest.mock('../pages/user/RequestDetailPage', () => ({ __esModule: true, default: () => <div>Request Detail</div> }));
jest.mock('../pages/explorer/v1_ExplorerDomainPage', () => ({ __esModule: true, default: () => <div>Explorer Domain</div> }));
jest.mock('../pages/explorer/v1_ExplorerReportPage', () => ({ __esModule: true, default: () => <div>Explorer Report</div> }));
jest.mock('../pages/admin/AdminDashboard', () => ({ __esModule: true, default: () => <div>Admin Dashboard</div> }));
jest.mock('../pages/admin/UsersManagement', () => ({ __esModule: true, default: () => <div>Users Management</div> }));
jest.mock('../pages/admin/RolesManagement', () => ({ __esModule: true, default: () => <div>Roles Management</div> }));
jest.mock('../pages/admin/DomainsManagement', () => ({ __esModule: true, default: () => <div>Domains Management</div> }));
jest.mock('../pages/admin/ScenariosManagement', () => ({ __esModule: true, default: () => <div>Scenarios Management</div> }));
jest.mock('../pages/admin/ScenarioRequestsManagement', () => ({ __esModule: true, default: () => <div>Scenario Requests</div> }));
jest.mock('../pages/admin/GroupsManagement', () => ({ __esModule: true, default: () => <div>Groups Management</div> }));
jest.mock('../pages/admin/PermissionsManagement', () => ({ __esModule: true, default: () => <div>Permissions Management</div> }));
jest.mock('../pages/admin/ConfigurationsManagement', () => ({ __esModule: true, default: () => <div>Configurations</div> }));
jest.mock('../pages/admin/PlayboardsManagement', () => ({ __esModule: true, default: () => <div>Playboards</div> }));
jest.mock('../pages/admin/ActivityLogsPage', () => ({ __esModule: true, default: () => <div>Activity Logs</div> }));
jest.mock('../pages/admin/ErrorLogsPage', () => ({ __esModule: true, default: () => <div>Error Logs</div> }));
jest.mock('../pages/admin/BulkUploadPage', () => ({ __esModule: true, default: () => <div>Bulk Upload</div> }));
jest.mock('../pages/admin/CustomersManagement', () => ({ __esModule: true, default: () => <div>Customers</div> }));
jest.mock('../pages/admin/FeedbackManagement', () => ({ __esModule: true, default: () => <div>Feedback Management</div> }));
jest.mock('../pages/admin/ApiConfigsManagement', () => ({ __esModule: true, default: () => <div>API Configs</div> }));
jest.mock('../pages/admin/DistributionListManagement', () => ({ __esModule: true, default: () => <div>Distribution Lists</div> }));
jest.mock('../pages/admin/UISchemaManagement', () => ({ __esModule: true, default: () => <div>UI Schemas</div> }));
jest.mock('../pages/FeedbackPage', () => ({ __esModule: true, default: () => <div>Feedback Page</div> }));

// Layout mocks that render Outlet (require inside factory to avoid out-of-scope reference)
jest.mock('../components/layout/MainLayout', () => {
  const { Outlet } = require('react-router');
  return { __esModule: true, default: () => <div data-testid="main-layout"><Outlet /></div> };
});
jest.mock('../components/layout/AuthLayout', () => {
  const { Outlet } = require('react-router');
  return { __esModule: true, default: () => <div data-testid="auth-layout"><Outlet /></div> };
});
jest.mock('../components/explorer/v1_ExplorerLayout', () => {
  const { Outlet } = require('react-router');
  return { __esModule: true, default: () => <div data-testid="explorer-layout"><Outlet /></div> };
});

let mockAuthValue = {};
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  Toaster: () => null,
}));

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    beforeEach(() => {
      mockAuthValue = { user: null, loading: false };
    });

    it('renders login page', async () => {
      render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('renders register page', async () => {
      render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Register Page')).toBeInTheDocument();
      });
    });

    it('renders forgot password page', async () => {
      render(<MemoryRouter initialEntries={['/forgot-password']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
      });
    });

    it('renders feedback page (no auth required)', async () => {
      render(<MemoryRouter initialEntries={['/feedback']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Feedback Page')).toBeInTheDocument();
      });
    });
  });

  describe('public route redirect when logged in', () => {
    it('redirects from login to dashboard when user is logged in', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });
  });

  describe('protected routes', () => {
    it('redirects to login when not authenticated', async () => {
      mockAuthValue = { user: null, loading: false };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });

    it('renders dashboard when authenticated', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        isAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('renders profile page when authenticated', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/profile']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Profile Page')).toBeInTheDocument();
      });
    });

    it('shows loading state', () => {
      mockAuthValue = { user: null, loading: true };
      render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);
      expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
    });
  });

  describe('admin routes', () => {
    it('redirects non-admin to dashboard', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('renders admin dashboard for super-admin', async () => {
      mockAuthValue = {
        user: { email: 'admin@test.com', roles: ['super-administrator'] },
        loading: false,
        isSuperAdmin: () => true,
        canManageUsers: () => true,
      };
      render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('redirects', () => {
    it('redirects / to /dashboard', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('redirects unknown routes to /dashboard', async () => {
      mockAuthValue = {
        user: { email: 'test@test.com', roles: ['user'] },
        loading: false,
        isSuperAdmin: () => false,
        canManageUsers: () => false,
      };
      render(<MemoryRouter initialEntries={['/nonexistent']}><App /></MemoryRouter>);
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });
  });
});
