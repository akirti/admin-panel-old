import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PermissionsManagement from './PermissionsManagement';

const mockIsSuperAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

vi.mock('../../services/api', () => ({
  permissionsAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getModules: vi.fn(),
    getRoles: vi.fn(),
    getGroups: vi.fn(),
  },
  exportAPI: {
    permissions: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('../../components/shared', () => ({
  Modal: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

const mockPermissions = [
  {
    _id: 'p1',
    key: 'users.create',
    name: 'Create Users',
    description: 'Allows creating users',
    module: 'Users',
    actions: ['create', 'read'],
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    _id: 'p2',
    key: 'reports.view',
    name: 'View Reports',
    module: 'Reports',
    actions: ['read', 'list', 'export', 'delete'],
    created_at: '2024-02-10T00:00:00Z',
  },
];

async function setupMocks() {
  const { permissionsAPI } = await import('../../services/api');
  permissionsAPI.list.mockResolvedValue({
    data: { data: mockPermissions, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  permissionsAPI.getModules.mockResolvedValue({
    data: { modules: ['Users', 'Reports'] },
  });
}

describe('PermissionsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(true);
  });

  it('shows access denied for non-super-admin', () => {
    mockIsSuperAdmin.mockReturnValue(false);
    render(<PermissionsManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    await setupMocks();
    render(<PermissionsManagement />);
    expect(screen.getByText('Permissions Management')).toBeInTheDocument();
  });

  it('renders permissions table with data', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });
  });

  it('shows permission keys', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('users.create')).toBeInTheDocument();
      expect(screen.getByText('reports.view')).toBeInTheDocument();
    });
  });

  it('shows module badges', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      // "Users" and "Reports" appear in stat cards, table, and filter dropdown
      expect(screen.getAllByText('Users').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows action badges with overflow', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      // p2 has 4 actions, shows first 3 + "+1 more"
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    render(<PermissionsManagement />);
    expect(screen.getByPlaceholderText(/search permissions/i)).toBeInTheDocument();
  });

  it('opens create modal on Add Permission click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Permission'));
    expect(screen.getByRole('heading', { name: 'Create Permission' })).toBeInTheDocument();
  });

  it('shows empty state when no permissions', async () => {
    const { permissionsAPI } = await import('../../services/api');
    permissionsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    permissionsAPI.getModules.mockResolvedValue({ data: { modules: [] } });

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText(/no permissions found/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { permissionsAPI } = await import('../../services/api');
    permissionsAPI.list.mockReturnValue(new Promise(() => {}));
    permissionsAPI.getModules.mockReturnValue(new Promise(() => {}));

    render(<PermissionsManagement />);
    expect(screen.getByText(/loading permissions/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { permissionsAPI } = await import('../../services/api');
    permissionsAPI.list.mockRejectedValue(new Error('Network error'));
    permissionsAPI.getModules.mockRejectedValue(new Error('Network error'));

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch permissions')).toBeInTheDocument();
    });
  });

  it('shows module statistics cards', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      // Module stat cards show count of permissions per module
      expect(screen.getAllByText('permissions').length).toBeGreaterThanOrEqual(1);
    });
  });
});
