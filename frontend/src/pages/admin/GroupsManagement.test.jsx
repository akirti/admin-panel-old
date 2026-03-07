import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsManagement from './GroupsManagement';

const mockIsSuperAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

vi.mock('../../services/api', () => ({
  groupsAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
    getUsers: vi.fn(),
    getTypes: vi.fn(),
  },
  permissionsAPI: { list: vi.fn() },
  domainsAPI: { list: vi.fn() },
  customersAPI: { list: vi.fn() },
  exportAPI: {
    groups: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('../../components/shared', () => ({
  Modal: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

const mockGroups = [
  {
    _id: 'g1',
    groupId: 'sales-team',
    name: 'Sales Team',
    description: 'Sales department group',
    type: 'domain',
    permissions: ['perm1', 'perm2', 'perm3', 'perm4'],
    domains: ['sales'],
    customers: ['cust1'],
    status: 'active',
    priority: 1,
  },
  {
    _id: 'g2',
    groupId: 'support',
    name: 'Support',
    type: 'system',
    permissions: [],
    domains: [],
    customers: [],
    status: 'inactive',
    priority: 10,
  },
];

async function setupMocks() {
  const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
  groupsAPI.list.mockResolvedValue({
    data: { data: mockGroups, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  groupsAPI.getTypes.mockResolvedValue({
    data: [{ value: 'domain', label: 'Domain' }, { value: 'system', label: 'System' }],
  });
  permissionsAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' }] },
  });
  domainsAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'd1', key: 'sales', name: 'Sales' }] },
  });
  customersAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'c1', customerId: 'cust1', name: 'Customer 1' }] },
  });
}

describe('GroupsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(true);
  });

  it('shows access denied for non-super-admin', () => {
    mockIsSuperAdmin.mockReturnValue(false);
    render(<GroupsManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    await setupMocks();
    render(<GroupsManagement />);
    expect(screen.getByText('Groups Management')).toBeInTheDocument();
  });

  it('renders groups table with data', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });
  });

  it('shows status badges', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('shows permissions overflow badge', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      // Sales Team has 4 permissions, shows first 3 + "+1 more"
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    render(<GroupsManagement />);
    expect(screen.getByPlaceholderText(/search groups/i)).toBeInTheDocument();
  });

  it('opens create modal on Add Group click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    expect(screen.getByRole('heading', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('shows empty state when no groups', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText(/no groups found/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
    groupsAPI.list.mockReturnValue(new Promise(() => {}));
    groupsAPI.getTypes.mockReturnValue(new Promise(() => {}));
    permissionsAPI.list.mockReturnValue(new Promise(() => {}));
    domainsAPI.list.mockReturnValue(new Promise(() => {}));
    customersAPI.list.mockReturnValue(new Promise(() => {}));

    render(<GroupsManagement />);
    expect(screen.getByText(/loading groups/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
    groupsAPI.list.mockRejectedValue(new Error('Network error'));
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch groups')).toBeInTheDocument();
    });
  });

  it('shows group description', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales department group')).toBeInTheDocument();
    });
  });
});
