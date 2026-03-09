import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PermissionsManagement from '../../../pages/admin/PermissionsManagement';

const mockIsSuperAdmin = jest.fn(() => true);

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

jest.mock('../../../services/api', () => ({
  permissionsAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getModules: jest.fn(),
    getRoles: jest.fn(),
    getGroups: jest.fn(),
  },
  exportAPI: {
    permissions: { csv: jest.fn(), json: jest.fn() },
  },
}));

jest.mock('../../../components/shared', () => ({
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
  const { permissionsAPI } = await import('../../../services/api');
  permissionsAPI.list.mockResolvedValue({
    data: { data: mockPermissions, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  permissionsAPI.getModules.mockResolvedValue({
    data: { modules: ['Users', 'Reports'] },
  });
}

describe('PermissionsManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const { permissionsAPI } = await import('../../../services/api');
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
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.list.mockReturnValue(new Promise(Function.prototype));
    permissionsAPI.getModules.mockReturnValue(new Promise(Function.prototype));

    render(<PermissionsManagement />);
    expect(screen.getByText(/loading permissions/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { permissionsAPI } = await import('../../../services/api');
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

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Permission' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('users.create')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Create Users')).toBeInTheDocument();
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Permission'));
    expect(screen.getByRole('heading', { name: 'Create Permission' })).toBeInTheDocument();

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(permissionsAPI.create).toHaveBeenCalled();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Permission' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(permissionsAPI.update).toHaveBeenCalledWith('p1', expect.any(Object));
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key exists' } } });
    const user = userEvent.setup();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Permission'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Key exists')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(permissionsAPI.delete).toHaveBeenCalledWith('p1');
      expect(screen.getByText('Permission deleted successfully')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(permissionsAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete permission')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('shows relationships modal when View Roles & Groups clicked', async () => {
    await setupMocks();
    const { permissionsAPI } = await import('../../../services/api');
    permissionsAPI.getRoles.mockResolvedValue({ data: [{ name: 'Admin', roleId: 'admin' }] });
    permissionsAPI.getGroups.mockResolvedValue({ data: [{ name: 'Sales', groupId: 'sales' }] });
    const user = userEvent.setup();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Roles & Groups');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(permissionsAPI.getRoles).toHaveBeenCalledWith('p1');
      expect(permissionsAPI.getGroups).toHaveBeenCalledWith('p1');
    });
  });

  it('handles CSV export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.permissions.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(exportAPI.permissions.csv).toHaveBeenCalled();
    });
  });

  it('handles JSON export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.permissions.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(exportAPI.permissions.json).toHaveBeenCalled();
    });
  });

  it('handles export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.permissions.csv.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export permissions')).toBeInTheDocument();
    });
  });

  it('cancels modal via Cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Permission'));
    expect(screen.getByRole('heading', { name: 'Create Permission' })).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Create Permission' })).not.toBeInTheDocument();
  });

  it('shows Select All and Clear All buttons in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Permission'));
    expect(screen.getAllByText('Select All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clear All').length).toBeGreaterThanOrEqual(1);
  });

  it('shows permission description', async () => {
    await setupMocks();
    render(<PermissionsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Allows creating users')).toBeInTheDocument();
    });
  });

  it('toggles action checkbox in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Permission'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find action checkboxes (create, read, update, delete, list, export)
    const checkboxes = screen.getAllByRole('checkbox');
    // "read" should be pre-checked (default), click another action
    const uncheckedCb = checkboxes.find(cb => !cb.checked);
    if (uncheckedCb) {
      await user.click(uncheckedCb);
      expect(uncheckedCb.checked).toBe(true);
      // Toggle it off
      await user.click(uncheckedCb);
      expect(uncheckedCb.checked).toBe(false);
    }
  });

  it('clicks Select All and Clear All for actions', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Permission'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Click Select All
    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    // All checkboxes should be checked
    const checkboxes = screen.getAllByRole('checkbox');
    const allChecked = checkboxes.every(cb => cb.checked);
    expect(allChecked).toBe(true);

    // Click Clear All
    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[0]);

    // All checkboxes should be unchecked
    const checkboxes2 = screen.getAllByRole('checkbox');
    const allUnchecked = checkboxes2.every(cb => !cb.checked);
    expect(allUnchecked).toBe(true);
  });

  it('filters by module using dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    // Find module filter dropdown
    const moduleSelect = screen.getByDisplayValue('All Modules');
    await user.selectOptions(moduleSelect, 'Users');
    expect(moduleSelect.value).toBe('Users');

    // Clear button should appear
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    // Click clear
    await user.click(screen.getByText('Clear'));
    expect(moduleSelect.value).toBe('');
  });

  it('clicks module stat card to filter', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    // Click on module stat card (Users module card)
    const usersCards = screen.getAllByText('Users');
    await user.click(usersCards[0]); // Click first Users text (module card)

    // Should filter to Users module
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });
  });

  it('fills form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Permission'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Fill in form fields
    const inputs = screen.getByTestId('modal').querySelectorAll('input[type="text"]');
    if (inputs.length > 0) {
      await user.type(inputs[0], 'test.permission');
    }
  });

  it('searches permissions by text', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<PermissionsManagement />);

    await waitFor(() => { expect(screen.getByText('Create Users')).toBeInTheDocument(); });

    const searchInput = screen.getByPlaceholderText('Search permissions by key or name...');
    await user.type(searchInput, 'users');
    expect(searchInput.value).toBe('users');
  });
});
