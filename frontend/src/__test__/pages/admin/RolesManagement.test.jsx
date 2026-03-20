import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolesManagement from '../../../pages/admin/RolesManagement';

const mockIsSuperAdmin = jest.fn(() => true);

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

jest.mock('../../../services/api', () => ({
  rolesAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleStatus: jest.fn(),
    getUsers: jest.fn(),
  },
  permissionsAPI: { list: jest.fn() },
  domainsAPI: { list: jest.fn() },
  exportAPI: {
    roles: { csv: jest.fn(), json: jest.fn() },
  },
}));

jest.mock('../../../components/shared', () => ({
  Modal: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
  Table: ({ columns, data, loading, emptyMessage }) => {
    if (loading) return <div>Loading...</div>;
    if (!data || data.length === 0) return <div>{emptyMessage || 'No data available'}</div>;
    return (
      <table>
        <thead><tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map(c => (
                <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
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
  const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
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
    jest.clearAllMocks();
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
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
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
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockReturnValue(new Promise(Function.prototype));
    permissionsAPI.list.mockReturnValue(new Promise(Function.prototype));
    domainsAPI.list.mockReturnValue(new Promise(Function.prototype));

    render(<RolesManagement />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

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

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(rolesAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete role')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('handles toggle status (deactivate)', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { exportAPI } = await import('../../../services/api');
    exportAPI.roles.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

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
    const { exportAPI } = await import('../../../services/api');
    exportAPI.roles.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

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
    const { exportAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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

  it('shows and clicks Clear button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear'));
    expect(domainFilter.value).toBe('');
  });

  it('shows pagination when multiple pages', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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
    const { rolesAPI } = await import('../../../services/api');
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

  // =====================================================================
  // ADDITIONAL BRANCH COVERAGE TESTS
  // =====================================================================

  it('shows "+N more" badge when role has more than 3 permissions', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r10',
            roleId: 'mega-role',
            name: 'Mega Role',
            description: 'Has many permissions',
            type: 'custom',
            permissions: ['p1', 'p2', 'p3', 'p4', 'p5'],
            domains: ['d1', 'd2', 'd3', 'd4'],
            status: 'active',
            priority: 1,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Mega Role')).toBeInTheDocument();
    });

    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows "None" when role has 0 permissions and 0 domains', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r11',
            roleId: 'empty-role',
            name: 'Empty Role',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Empty Role')).toBeInTheDocument();
    });

    const noneCells = screen.getAllByText('None');
    expect(noneCells.length).toBe(2);
  });

  it('renders role without description (no description div)', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r12',
            roleId: 'no-desc',
            name: 'No Description Role',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Description Role')).toBeInTheDocument();
    });

    // No description text should appear
    expect(screen.queryByText('Full access')).not.toBeInTheDocument();
  });

  it('renders role with type fallback when type is missing', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r13',
            roleId: 'no-type',
            name: 'No Type Role',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Type Role')).toBeInTheDocument();
    });

    // Type defaults to 'custom'
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('renders role with status fallback when status is missing', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r14',
            roleId: 'no-status',
            name: 'No Status Role',
            type: 'custom',
            permissions: [],
            domains: [],
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Status Role')).toBeInTheDocument();
    });

    // Status defaults to 'active'
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders role with priority fallback to 0', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r15',
            roleId: 'no-priority',
            name: 'No Priority Role',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Priority Role')).toBeInTheDocument();
    });

    // Priority defaults to 0 (may appear in stat cards too)
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates pagination forward and backward', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: mockRoles,
        pagination: { total: 100, pages: 4, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    });

    // Find the next button by looking at non-disabled pagination buttons
    const paginationButtons = screen.getAllByRole('button').filter(
      b => b.closest('.flex.items-center.gap-2') && !b.textContent
    );

    // Use the "right" chevron button
    const rightBtn = paginationButtons[paginationButtons.length - 1];
    await user.click(rightBtn);

    await waitFor(() => {
      expect(rolesAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it('disables prev button on first page and next on last page', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: mockRoles,
        pagination: { total: 50, pages: 2, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    // The prev button should be disabled on page 0
    const buttons = screen.getAllByRole('button');
    const disabledPagButtons = buttons.filter(b => b.disabled && b.closest('.flex.items-center.gap-2'));
    expect(disabledPagButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows users modal loading state', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    // Never resolve to keep loading
    rolesAPI.getUsers.mockReturnValue(new Promise(Function.prototype));
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });
  });

  it('shows users modal with empty users list', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
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
  });

  it('shows active and inactive user status in users modal', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'active@test.com', full_name: 'Active User', is_active: true },
        { _id: 'u2', email: 'inactive@test.com', full_name: 'Inactive User', is_active: false },
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
      expect(screen.getByText('Active User')).toBeInTheDocument();
      expect(screen.getByText('Inactive User')).toBeInTheDocument();
    });

    // "Active"/"Inactive" may appear in both table cells and user modal badges
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
  });

  it('shows username fallback when full_name is missing in users modal', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u3', email: 'noname@test.com', username: 'jdoe', is_active: true },
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
      expect(screen.getByText('jdoe')).toBeInTheDocument();
      expect(screen.getByText('noname@test.com')).toBeInTheDocument();
    });
  });

  it('shows email fallback when full_name and username are missing in users modal', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u4', email: 'only-email@test.com', is_active: true },
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
      // The email shows both as the "name" (fallback) and as the email line
      const emailTexts = screen.getAllByText('only-email@test.com');
      expect(emailTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles update error with detail message from API', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.update.mockRejectedValue({
      response: { data: { detail: 'Role name already taken' } },
    });
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
      expect(screen.getByText('Role name already taken')).toBeInTheDocument();
    });
  });

  it('handles update error without detail (fallback message)', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.update.mockRejectedValue(new Error('Network fail'));
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
      expect(screen.getByText('Failed to save role')).toBeInTheDocument();
    });
  });

  it('handles create error without detail (fallback message)', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.create.mockRejectedValue(new Error('Network fail'));
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save role')).toBeInTheDocument();
    });
  });

  it('handles delete error with detail from API', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.delete.mockRejectedValue({
      response: { data: { detail: 'Cannot delete system role' } },
    });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cannot delete system role')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('handles toggle status error with detail from API', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.toggleStatus.mockRejectedValue({
      response: { data: { detail: 'Cannot deactivate system role' } },
    });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cannot deactivate system role')).toBeInTheDocument();
    });
  });

  it('uses roleId fallback when _id is missing for delete', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            roleId: 'fallback-role',
            name: 'Fallback Role',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    rolesAPI.delete.mockResolvedValue({ data: {} });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Role')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.delete).toHaveBeenCalledWith('fallback-role');
    });

    jest.restoreAllMocks();
  });

  it('uses roleId fallback when _id is missing for toggleStatus', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            roleId: 'fallback-role2',
            name: 'Fallback Role 2',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    rolesAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Role 2')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.toggleStatus).toHaveBeenCalledWith('fallback-role2');
    });
  });

  it('uses roleId fallback when _id is missing for update', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            roleId: 'fallback-update',
            name: 'Fallback Update',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    rolesAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Update')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(rolesAPI.update).toHaveBeenCalledWith('fallback-update', expect.any(Object));
    });
  });

  it('uses roleId fallback when _id is missing for getUsers', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            roleId: 'fallback-users',
            name: 'Fallback Users',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    rolesAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Fallback Users')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(rolesAPI.getUsers).toHaveBeenCalledWith('fallback-users');
    });
  });

  it('shows export success message for CSV', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.roles.csv.mockResolvedValue({ data: 'csv content' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Exported roles as CSV')).toBeInTheDocument();
    });
  });

  it('shows export success message for JSON', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.roles.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(screen.getByText('Exported roles as JSON')).toBeInTheDocument();
    });
  });

  it('opens edit modal for role with no permissions, no domains, no description', async () => {
    await setupMocks();
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });

    // Edit the Viewer role which has empty arrays and no description
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[1]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('viewer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viewer')).toBeInTheDocument();
  });

  it('shows "No permissions available" in modal when permissions list is empty', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    expect(screen.getByText('No permissions available')).toBeInTheDocument();
  });

  it('shows "No domains available" in modal when domains list is empty', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' }] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    expect(screen.getByText('No domains available')).toBeInTheDocument();
  });

  it('groups permissions with "Other" module when module is missing', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p1', key: 'misc.action', name: 'Misc Action' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // The permission without a module should be grouped under 'Other'
    expect(screen.getByText('Other')).toBeInTheDocument();
    const miscMatches = screen.getAllByText('Misc Action');
    expect(miscMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('handles permission with key as name fallback in filter dropdown', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p2', key: 'reports.view', module: 'Reports' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    // Permission dropdown should show key as fallback when name is missing
    const permFilter = screen.getByDisplayValue('All Permissions');
    const options = permFilter.querySelectorAll('option');
    expect(options[1].textContent).toBe('reports.view');
  });

  it('toggles permission on and then off', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Find the permission checkbox for "Read Users" (appears in both dropdown and modal)
    const permLabels = screen.getAllByText('Read Users');
    const permLabel = permLabels.find(el => el.closest('label'))?.closest('label');
    const permCheckbox = permLabel.querySelector('input[type="checkbox"]');

    // Toggle on
    await user.click(permCheckbox);
    expect(permCheckbox.checked).toBe(true);

    // Toggle off
    await user.click(permCheckbox);
    expect(permCheckbox.checked).toBe(false);
  });

  it('toggles domain on and then off', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Find the domain checkbox for "Sales"
    const allSalesTexts = screen.getAllByText('Sales');
    const domainLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domainCheckbox = domainLabel.querySelector('input[type="checkbox"]');

    // Toggle on
    await user.click(domainCheckbox);
    expect(domainCheckbox.checked).toBe(true);

    // Toggle off
    await user.click(domainCheckbox);
    expect(domainCheckbox.checked).toBe(false);
  });

  it('clears filters when only permission filter is set', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear'));
    expect(permFilter.value).toBe('');
  });

  it('clears filters when both domain and permission filters are set', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear'));
    expect(domainFilter.value).toBe('');
    expect(permFilter.value).toBe('');
  });

  it('handles response without pagination property', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    // Should not crash - pagination section should not appear
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('handles response with missing data property', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { pagination: { total: 0, pages: 0 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: {} });
    domainsAPI.list.mockResolvedValue({ data: {} });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('shows role with multiple permissions including exactly 3', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r20',
            roleId: 'three-perms',
            name: 'Three Perms',
            type: 'custom',
            permissions: ['read', 'write', 'delete'],
            domains: ['dom1', 'dom2', 'dom3'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Three Perms')).toBeInTheDocument();
    });

    // Exactly 3, so no "+N more" should appear
    expect(screen.getByText('read')).toBeInTheDocument();
    expect(screen.getByText('write')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it('renders role with undefined permissions and domains (fallback to empty)', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r21',
            roleId: 'undef-arrays',
            name: 'Undef Arrays',
            type: 'custom',
            status: 'active',
            priority: 0,
            // permissions and domains not defined
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Undef Arrays')).toBeInTheDocument();
    });

    // Should show "None" for both
    const noneCells = screen.getAllByText('None');
    expect(noneCells.length).toBe(2);
  });

  it('shows success message after create and it auto-clears', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
    rolesAPI.create.mockResolvedValue({ data: {} });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const addBtn = screen.getByText('Add Role');
    addBtn.click();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Role' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Role created successfully')).toBeInTheDocument();
    });

    // The success auto-clear uses setTimeout(5000)
    await waitFor(() => {
      expect(screen.queryByText('Role created successfully')).not.toBeInTheDocument();
    }, { timeout: 7000 });
  }, 10000);

  it('shows success message after update', async () => {
    await setupMocks();
    const { rolesAPI } = await import('../../../services/api');
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
      expect(screen.getByText('Role updated successfully')).toBeInTheDocument();
    });
  });

  it('handles permission checkbox pre-selected by permissionId', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r30',
            roleId: 'perm-by-id',
            name: 'PermById Role',
            type: 'custom',
            permissions: ['perm-id-1'],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', permissionId: 'perm-id-1', key: 'users.read', name: 'Read Users', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('PermById Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    // The permission should be checked because permissions includes 'perm-id-1'
    // which matches permissionId
    const permLabels = screen.getAllByText('Read Users');
    const permLabel = permLabels.find(el => el.closest('label'))?.closest('label');
    const permCheckbox = permLabel.querySelector('input[type="checkbox"]');
    expect(permCheckbox.checked).toBe(true);
  });

  it('handles permission checkbox pre-selected by key', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r31',
            roleId: 'perm-by-key',
            name: 'PermByKey Role',
            type: 'custom',
            permissions: ['users.read'],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p-id-1', permissionId: 'perm-id-1', key: 'users.read', name: 'Read Users', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('PermByKey Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const permLabels = screen.getAllByText('Read Users');
    const permLabel = permLabels.find(el => el.closest('label'))?.closest('label');
    const permCheckbox = permLabel.querySelector('input[type="checkbox"]');
    expect(permCheckbox.checked).toBe(true);
  });

  it('handles domain checkbox pre-selected by domainId', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r32',
            roleId: 'dom-by-id',
            name: 'DomById Role',
            type: 'custom',
            permissions: [],
            domains: ['domain-id-1'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'domain-id-1', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('DomById Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);
  });

  it('handles domain checkbox pre-selected by domainKey', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r33',
            roleId: 'dom-by-key',
            name: 'DomByKey Role',
            type: 'custom',
            permissions: [],
            domains: ['sales-key'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'other-dom', domainKey: 'sales-key', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('DomByKey Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);
  });

  it('handles domain checkbox pre-selected by key field', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r34',
            roleId: 'dom-by-key-field',
            name: 'DomByKeyField Role',
            type: 'custom',
            permissions: [],
            domains: ['sales'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'other-dom', domainKey: 'other-key', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('DomByKeyField Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);
  });

  it('deselects permission that was selected by permissionId', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r35',
            roleId: 'desel-perm',
            name: 'Desel Perm',
            type: 'custom',
            permissions: ['perm-id-1'],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', permissionId: 'perm-id-1', key: 'users.read', name: 'Read Users', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Desel Perm')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const permLabels = screen.getAllByText('Read Users');
    const permLabel = permLabels.find(el => el.closest('label'))?.closest('label');
    const permCheckbox = permLabel.querySelector('input[type="checkbox"]');
    expect(permCheckbox.checked).toBe(true);

    // Deselect
    await user.click(permCheckbox);
    expect(permCheckbox.checked).toBe(false);
  });

  it('deselects domain that was selected by domainId', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r36',
            roleId: 'desel-dom',
            name: 'Desel Dom',
            type: 'custom',
            permissions: [],
            domains: ['domain-id-1'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'domain-id-1', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Desel Dom')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);

    // Deselect
    await user.click(domCheckbox);
    expect(domCheckbox.checked).toBe(false);
  });

  it('handles domain display name fallbacks (domainId, key) in modal', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'd10', domainId: 'dom-display-id', key: 'dom-key' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // domain.name is missing, so it should fall back to domainId
    expect(screen.getByText('dom-display-id')).toBeInTheDocument();
  });

  it('handles domain display name with only key fallback in modal', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'd11', key: 'only-key-domain' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // domain.name is missing, domainId is missing, falls back to key
    expect(screen.getByText('only-key-domain')).toBeInTheDocument();
  });

  it('handles permission name fallback to key in create modal', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p10', key: 'users.write', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // perm.name is missing, falls back to key (appears in both dropdown and modal)
    const matches = screen.getAllByText('users.write');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('handles multiple permission modules in create modal', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
          { _id: 'p2', key: 'users.write', name: 'Write Users', module: 'Users' },
          { _id: 'p3', key: 'reports.view', name: 'View Reports', module: 'Reports' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Both modules should appear
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('selects all for one module without affecting another', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
          { _id: 'p2', key: 'users.write', name: 'Write Users', module: 'Users' },
          { _id: 'p3', key: 'reports.view', name: 'View Reports', module: 'Reports' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Click "All" for the Users module
    const modal = screen.getByTestId('modal');
    const allBtns = within(modal).getAllByText('All');
    await user.click(allBtns[0]);

    // Users module perms should be checked (2 selected)
    await waitFor(() => {
      expect(screen.getByText('Permissions (2 selected)')).toBeInTheDocument();
    });

    // Click "None" for Users module
    const noneBtns = within(modal).getAllByText('None');
    await user.click(noneBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('select all permissions selects all across modules', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
          { _id: 'p2', key: 'reports.view', name: 'View Reports', module: 'Reports' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Click the global "Select All" for permissions
    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (2 selected)')).toBeInTheDocument();
    });

    // Click global "Clear All" for permissions
    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('handles domain filter dropdown with key fallback', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'd1', name: 'Engineering' },
          { key: 'finance', name: 'Finance' },
        ],
      },
    });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    const options = domainFilter.querySelectorAll('option');
    // "All Domains" + 2 domain options
    expect(options.length).toBe(3);
  });

  it('handles isSuperAdmin returning false - no API calls', async () => {
    mockIsSuperAdmin.mockReturnValue(false);

    render(<RolesManagement />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('Only Super Administrators can access this page.')).toBeInTheDocument();
    expect(screen.queryByText('Roles Management')).not.toBeInTheDocument();
  });

  it('handles edit modal for role with missing optional fields', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r40',
            roleId: 'minimal',
            name: 'Minimal Role',
            // no description, type, permissions, domains, status, priority
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    rolesAPI.update.mockResolvedValue({ data: {} });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Minimal Role')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    // Verify fallback values
    expect(screen.getByDisplayValue('minimal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Minimal Role')).toBeInTheDocument();

    // Submit the form
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(rolesAPI.update).toHaveBeenCalledWith('r40', expect.objectContaining({
        type: 'custom',
        permissions: [],
        domains: [],
        status: 'active',
        priority: 0,
      }));
    });
  });

  it('handles JSON export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.roles.json.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export roles')).toBeInTheDocument();
    });
  });

  it('shows pagination info text correctly', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: mockRoles,
        pagination: { total: 75, pages: 3, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
    expect(screen.getByText(/of 75 roles/)).toBeInTheDocument();
  });

  it('handles domain key used in filter option rendering', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'd1', key: 'eng', name: 'Engineering' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'eng');

    await waitFor(() => {
      expect(rolesAPI.list).toHaveBeenCalledWith(expect.objectContaining({ domain: 'eng' }));
    });
  });

  it('fetchFormData error is handled gracefully', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockRejectedValue(new Error('Perm fetch fail'));
    domainsAPI.list.mockRejectedValue(new Error('Domain fetch fail'));

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });
  });

  it('total count displays correctly in header', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 42, pages: 2, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    expect(screen.getByText(/42 total/)).toBeInTheDocument();
  });

  it('pagination does not appear when totalPages is 1', async () => {
    await setupMocks();

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    // setupMocks sets pages: 1, so pagination should not appear
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('handles role table row key using roleId when _id is missing', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            roleId: 'key-by-roleid',
            name: 'KeyByRoleId',
            type: 'custom',
            permissions: [],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('KeyByRoleId')).toBeInTheDocument();
    });

    // It should render without crashing even without _id
    expect(screen.getByText('key-by-roleid')).toBeInTheDocument();
  });

  it('deselects domain that was selected by domainKey', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r50',
            roleId: 'desel-domkey',
            name: 'Desel DomKey',
            type: 'custom',
            permissions: [],
            domains: ['sales-key'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'other-dom', domainKey: 'sales-key', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Desel DomKey')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);

    // Deselect it
    await user.click(domCheckbox);
    expect(domCheckbox.checked).toBe(false);
  });

  it('deselects domain that was selected by key', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r51',
            roleId: 'desel-domkeyfield',
            name: 'Desel DomKeyField',
            type: 'custom',
            permissions: [],
            domains: ['sales'],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'other-id', domainId: 'other-dom', domainKey: 'other-key', key: 'sales', name: 'Sales' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Desel DomKeyField')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const allSalesTexts = screen.getAllByText('Sales');
    const domLabel = allSalesTexts.find(el => el.closest('label'))?.closest('label');
    const domCheckbox = domLabel.querySelector('input[type="checkbox"]');
    expect(domCheckbox.checked).toBe(true);

    // Deselect it
    await user.click(domCheckbox);
    expect(domCheckbox.checked).toBe(false);
  });

  it('deselects permission that was selected by key', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r52',
            roleId: 'desel-permkey',
            name: 'Desel PermKey',
            type: 'custom',
            permissions: ['users.read'],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p-id-1', permissionId: 'perm-id-1', key: 'users.read', name: 'Read Users', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Desel PermKey')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    const permLabels = screen.getAllByText('Read Users');
    const permLabel = permLabels.find(el => el.closest('label'))?.closest('label');
    const permCheckbox = permLabel.querySelector('input[type="checkbox"]');
    expect(permCheckbox.checked).toBe(true);

    // Deselect
    await user.click(permCheckbox);
    expect(permCheckbox.checked).toBe(false);
  });

  it('clears module permissions by key during None click', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: {
        data: [
          {
            _id: 'r53',
            roleId: 'clear-module',
            name: 'Clear Module',
            type: 'custom',
            permissions: ['users.read', 'users.write'],
            domains: [],
            status: 'active',
            priority: 0,
          },
        ],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    permissionsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
          { _id: 'p2', key: 'users.write', name: 'Write Users', module: 'Users' },
        ],
      },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Clear Module')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
    });

    // Permissions are pre-selected by key
    expect(screen.getByText('Permissions (2 selected)')).toBeInTheDocument();

    // Click "None" for the Users module to clear them
    const modal = screen.getByTestId('modal');
    const noneBtns = within(modal).getAllByText('None');
    await user.click(noneBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('handles pagination with missing pages/total in response', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: {} },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    // With pages=0 (default), pagination should not appear
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('select all domains then clear all domains in edit modal', async () => {
    const { rolesAPI, permissionsAPI, domainsAPI } = await import('../../../services/api');
    rolesAPI.list.mockResolvedValue({
      data: { data: mockRoles, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'd1', key: 'sales', name: 'Sales' },
          { _id: 'd2', key: 'eng', name: 'Engineering' },
        ],
      },
    });

    const user = userEvent.setup();
    render(<RolesManagement />);

    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Role'));

    // Select All domains
    const selectAllBtns = screen.getAllByText('Select All');
    // Domains Select All is the second one
    await user.click(selectAllBtns[1]);

    await waitFor(() => {
      expect(screen.getByText('Domains (2 selected)')).toBeInTheDocument();
    });

    // Clear All domains
    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[1]);

    await waitFor(() => {
      expect(screen.getByText('Domains (0 selected)')).toBeInTheDocument();
    });
  });
});
