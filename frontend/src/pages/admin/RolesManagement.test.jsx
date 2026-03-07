import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Administrator')).toBeInTheDocument();
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));
    expect(screen.getByRole('heading', { name: 'Create Role' })).toBeInTheDocument();

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(rolesAPI.create).toHaveBeenCalled();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(rolesAPI.update).toHaveBeenCalledWith('r1', expect.any(Object));
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.create.mockRejectedValue({ response: { data: { detail: 'Role exists' } } });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Role exists')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.delete).toHaveBeenCalledWith('r1');
      expect(screen.getByText('Role deleted successfully')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(rolesAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete role')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('handles toggle status (deactivate)', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.toggleStatus).toHaveBeenCalledWith('r1');
      expect(screen.getByText('Role deactivated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status (activate)', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });

    const activateButtons = screen.getAllByTitle('Activate');
    await user.click(activateButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.toggleStatus).toHaveBeenCalledWith('r2');
      expect(screen.getByText('Role activated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.toggleStatus.mockRejectedValue(new Error('Error'));
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to toggle role status')).toBeInTheDocument();
    });
  });

  it('shows users modal when View Users clicked', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.getUsers.mockResolvedValue({ data: [{ email: 'u@test.com', full_name: 'Test User', is_active: true }] });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.getUsers).toHaveBeenCalledWith('r1');
    });
  });

  it('handles CSV export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.roles.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(exportAPI.roles.csv).toHaveBeenCalled();
    });
  });

  it('handles JSON export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.roles.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(exportAPI.roles.json).toHaveBeenCalled();
    });
  });

  it('handles export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.roles.csv.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export roles')).toBeInTheDocument();
    });
  });

  it('cancels modal via Cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));
    expect(screen.getByRole('heading', { name: 'Create Role' })).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Create Role' })).not.toBeInTheDocument();
  });

  it('shows Select All and Clear All buttons in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));
    expect(screen.getAllByText('Select All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clear All').length).toBeGreaterThanOrEqual(1);
  });

  it('shows domain count badges', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('dom1')).toBeInTheDocument();
    });
  });

  // --- Additional coverage tests ---

  it('types in form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const roleIdInput = screen.getByPlaceholderText('e.g., custom-role');
    await user.type(roleIdInput, 'test-role');
    expect(roleIdInput.value).toBe('test-role');

    const nameInput = screen.getByPlaceholderText('Role Name');
    await user.type(nameInput, 'Test Role');
    expect(nameInput.value).toBe('Test Role');

    const descInput = screen.getByPlaceholderText('Brief description of the role...');
    await user.type(descInput, 'Test description');
    expect(descInput.value).toBe('Test description');
  });

  it('toggles permission checkbox in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const checkboxes = screen.getAllByRole('checkbox');
    const permCheckbox = checkboxes.find(cb => !cb.checked);
    if (permCheckbox) {
      await user.click(permCheckbox);
      expect(permCheckbox.checked).toBe(true);
    }
  });

  it('clicks Select All permissions', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    const checkboxes = screen.getAllByRole('checkbox');
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    expect(checkedCount).toBeGreaterThan(0);
  });

  it('clicks Clear All permissions', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[0]);
  });

  it('changes type and status dropdowns', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Change type (default is 'custom' = "Custom")
    const typeSelect = screen.getByDisplayValue('Custom');
    await user.selectOptions(typeSelect, 'system');
    expect(typeSelect.value).toBe('system');

    // Change status (default is 'active' = "Active")
    const statusSelect = screen.getByDisplayValue('Active');
    await user.selectOptions(statusSelect, 'inactive');
    expect(statusSelect.value).toBe('inactive');
  });

  it('shows domain and permission filter dropdowns', async () => {
    await setupMocks();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    expect(screen.getByText('All Domains')).toBeInTheDocument();
    expect(screen.getByText('All Permissions')).toBeInTheDocument();
  });

  it('populates edit form with role data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Administrator')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Full access')).toBeInTheDocument();
  });

  it('shows users modal with error handling', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.getUsers.mockRejectedValue(new Error('API error'));
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const viewUsersButtons = screen.getAllByTitle('View Users');
    await user.click(viewUsersButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('changes domain filter', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');
    expect(domainFilter.value).toBe('sales');
  });

  it('toggles domain checkbox in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Find domain checkbox labeled 'Sales'
    const salesLabels = screen.getAllByText('Sales');
    const domainLabel = salesLabels.find(el => el.closest('label'));
    if (domainLabel) {
      const domainCheckbox = domainLabel.closest('label').querySelector('input[type="checkbox"]');
      await user.click(domainCheckbox);
      expect(domainCheckbox.checked).toBe(true);
      await user.click(domainCheckbox);
      expect(domainCheckbox.checked).toBe(false);
    }
  });

  it('clicks Select All and Clear All for domains', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Domains Select All / Clear All (second set of buttons)
    const selectAllBtns = screen.getAllByText('Select All');
    if (selectAllBtns.length >= 2) {
      await user.click(selectAllBtns[1]);
      await waitFor(() => {
        expect(screen.getByText('Domains (1 selected)')).toBeInTheDocument();
      });
      const clearAllBtns = screen.getAllByText('Clear All');
      await user.click(clearAllBtns[1]);
      await waitFor(() => {
        expect(screen.getByText('Domains (0 selected)')).toBeInTheDocument();
      });
    }
  });

  it('clicks module-level All and None buttons', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const modal = screen.getByTestId('modal');
    const allBtns = within(modal).getAllByText('All');
    const noneBtns = within(modal).getAllByText('None');

    await user.click(allBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Permissions (1 selected)')).toBeInTheDocument();
    });

    await user.click(noneBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('filters by permission dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');
    expect(permFilter.value).toBe('users.read');
  });

  it('shows and clicks Clear Filters button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));
    expect(domainFilter.value).toBe('');
  });

  it('shows pagination when multiple pages', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 100, pages: 4, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
  });

  it('changes priority field in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const priorityInput = screen.getByDisplayValue('0');
    await user.clear(priorityInput);
    await user.type(priorityInput, '5');
    expect(priorityInput.value).toBe('5');
  });

  it('handles search with debounce', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search roles/i);
    await user.type(searchInput, 'admin');

    await waitFor(() => {
      expect(rolesAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'admin',
      }));
    }, { timeout: 1000 });
  });

  it('shows users in users modal', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'user1@test.com', full_name: 'User One', is_active: true },
        { _id: 'u2', email: 'user2@test.com', full_name: 'User Two', is_active: false },
      ],
    });
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });
  });

  it('closes users modal', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../services/api');
    rolesAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users have this role assigned.')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByText('No users have this role assigned.')).not.toBeInTheDocument();
    });
  });
});
