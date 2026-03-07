import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolesManagement from './RolesManagement';

const mockIsSuperAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

vi.mock('../../services/api', () => ({
  rolesAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
    getUsers: vi.fn(),
  },
  permissionsAPI: { list: vi.fn() },
  domainsAPI: { list: vi.fn() },
  exportAPI: {
    roles: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('../../components/shared', () => ({
  Modal: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

const mockRoles = [
  {
    _id: 'r1',
    roleId: 'admin',
    name: 'Administrator',
    description: 'Full access',
    type: 'system',
    permissions: ['perm1', 'perm2'],
    domains: ['dom1'],
    status: 'active',
    priority: 1,
  },
  {
    _id: 'r2',
    roleId: 'viewer',
    name: 'Viewer',
    type: 'custom',
    permissions: [],
    domains: [],
    status: 'inactive',
    priority: 5,
  },
];

async function setupMocks() {
  const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../services/api');
  rolesAPI.list.mockResolvedValue({
    data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  permissionsAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' }] },
  });
  domainsAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'd1', key: 'sales', name: 'Sales' }] },
  });
}

describe('RolesManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(true);
  });

  it('shows access denied for non-super-admin', () => {
    mockIsSuperAdmin.mockReturnValue(false);
    render(<RolesManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    await setupMocks();
    render(<RolesManagement />);
    expect(screen.getByText('Roles Management')).toBeInTheDocument();
  });

  it('renders roles table with data', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });
  });

  it('shows status badges', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('shows type badges', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('system')).toBeInTheDocument();
      expect(screen.getByText('custom')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    render(<RolesManagement />);
    expect(screen.getByPlaceholderText(/search roles/i)).toBeInTheDocument();
  });

  it('opens create modal on Add Role click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));
    expect(screen.getByRole('heading', { name: 'Create Role' })).toBeInTheDocument();
  });

  it('shows empty state when no roles', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText(/no roles found/i)).toBeInTheDocument();
    });
  });

  it('shows permission count badges', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('perm1')).toBeInTheDocument();
      expect(screen.getByText('perm2')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../services/api');
    rolesAPI.list.mockReturnValue(new Promise(() => {}));
    permissionsAPI.list.mockReturnValue(new Promise(() => {}));
    domainsAPI.list.mockReturnValue(new Promise(() => {}));

    render(<RolesManagement />);
    expect(screen.getByText(/loading roles/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../services/api');
    rolesAPI.list.mockRejectedValue(new Error('Network error'));
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch roles')).toBeInTheDocument();
    });
  });
});
