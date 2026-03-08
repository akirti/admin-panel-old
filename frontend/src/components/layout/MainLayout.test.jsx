import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import MainLayout from './MainLayout';

const mockNavigate = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockIsSuperAdmin = jest.fn(() => false);
const mockCanManageUsers = jest.fn(() => false);
const mockIsEditor = jest.fn(() => false);

jest.mock('react-router', () => {
  const actual = jest.requireActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      full_name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      roles: ['user'],
    },
    logout: mockLogout,
    isSuperAdmin: mockIsSuperAdmin,
    canManageUsers: mockCanManageUsers,
    isEditor: mockIsEditor,
  })),
}));

jest.mock('../shared/ThemeSwitcher', () => ({
  __esModule: true, default: () => <div data-testid="theme-switcher">ThemeSwitcher</div>,
}));

jest.mock('../shared', () => ({
  Badge: ({ children }) => <span data-testid="badge">{children}</span>,
}));

import { useAuth } from '../../contexts/AuthContext';

function renderMainLayout(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <MainLayout {...props} />
    </MemoryRouter>
  );
}

describe('MainLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(false);
    mockCanManageUsers.mockReturnValue(false);
    mockIsEditor.mockReturnValue(false);
    useAuth.mockReturnValue({
      user: {
        full_name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        roles: ['user'],
      },
      logout: mockLogout,
      isSuperAdmin: mockIsSuperAdmin,
      canManageUsers: mockCanManageUsers,
      isEditor: mockIsEditor,
    });
  });

  describe('regular user layout', () => {
    it('renders sidebar with user navigation items', () => {
      renderMainLayout();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Domains')).toBeInTheDocument();
      expect(screen.getByText('Ask Scenario')).toBeInTheDocument();
      expect(screen.getByText('My Requests')).toBeInTheDocument();
      expect(screen.getByText('Explorer')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Feedback')).toBeInTheDocument();
    });

    it('shows EasyLife branding', () => {
      renderMainLayout();
      expect(screen.getByText('EasyLife')).toBeInTheDocument();
    });

    it('shows Welcome header', () => {
      renderMainLayout();
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });

    it('does not show Admin Panel link for regular users', () => {
      renderMainLayout();
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    });

    it('shows Admin Panel link for super admins', () => {
      mockIsSuperAdmin.mockReturnValue(true);
      renderMainLayout();
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });

    it('shows Management link for group admins', () => {
      mockCanManageUsers.mockReturnValue(true);
      renderMainLayout();
      expect(screen.getByText('Management')).toBeInTheDocument();
    });
  });

  describe('admin layout', () => {
    it('shows Admin Panel branding', () => {
      renderMainLayout({ isAdmin: true });
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });

    it('shows Administration header', () => {
      renderMainLayout({ isAdmin: true });
      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    it('shows admin nav items', () => {
      renderMainLayout({ isAdmin: true });
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Roles')).toBeInTheDocument();
      expect(screen.getByText('Groups')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
      expect(screen.getByText('Domains')).toBeInTheDocument();
      expect(screen.getByText('Scenarios')).toBeInTheDocument();
    });
  });

  describe('group admin layout', () => {
    it('shows Management branding', () => {
      renderMainLayout({ isGroupAdmin: true });
      // The branding text
      expect(screen.getAllByText('Management').length).toBeGreaterThanOrEqual(1);
    });

    it('shows management nav items', () => {
      renderMainLayout({ isGroupAdmin: true });
      expect(screen.getByText('Users Management')).toBeInTheDocument();
      expect(screen.getByText('Domains')).toBeInTheDocument();
    });
  });

  describe('sidebar interactions', () => {
    it('collapses sidebar when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = renderMainLayout();

      // Sidebar starts open (w-64)
      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('w-64');

      // Click the sidebar toggle button (X icon when open)
      const toggleButtons = container.querySelectorAll('button');
      // The toggle button is in the logo area
      const toggleButton = Array.from(toggleButtons).find(
        btn => btn.closest('.h-16')
      );
      if (toggleButton) {
        await user.click(toggleButton);
        expect(sidebar).toHaveClass('w-20');
      }
    });
  });

  describe('user menu', () => {
    it('shows user name and email', () => {
      renderMainLayout();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('opens user menu on click', async () => {
      const user = userEvent.setup();
      renderMainLayout();

      // Click the user area
      await user.click(screen.getByText('Test User'));

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('navigates to login on logout', async () => {
      const user = userEvent.setup();
      renderMainLayout();

      await user.click(screen.getByText('Test User'));
      await user.click(screen.getByText('Logout'));

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('theme switcher', () => {
    it('renders theme switcher', () => {
      renderMainLayout();
      expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    });
  });

  describe('role badges', () => {
    it('renders role badges for user', () => {
      renderMainLayout();
      expect(screen.getByText('user')).toBeInTheDocument();
    });
  });
});
