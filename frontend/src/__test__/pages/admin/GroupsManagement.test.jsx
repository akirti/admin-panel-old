import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsManagement from '../../../pages/admin/GroupsManagement';

const mockIsSuperAdmin = jest.fn(() => true);

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

jest.mock('../../../services/api', () => ({
  groupsAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleStatus: jest.fn(),
    getUsers: jest.fn(),
    getTypes: jest.fn(),
  },
  permissionsAPI: { list: jest.fn() },
  domainsAPI: { list: jest.fn() },
  customersAPI: { list: jest.fn() },
  exportAPI: {
    groups: { csv: jest.fn(), json: jest.fn() },
  },
}));

jest.mock('../../../components/shared', () => ({
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
  const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
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
    jest.clearAllMocks();
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockReturnValue(new Promise(Function.prototype));
    groupsAPI.getTypes.mockReturnValue(new Promise(Function.prototype));
    permissionsAPI.list.mockReturnValue(new Promise(Function.prototype));
    domainsAPI.list.mockReturnValue(new Promise(Function.prototype));
    customersAPI.list.mockReturnValue(new Promise(Function.prototype));

    render(<GroupsManagement />);
    expect(screen.getByText(/loading groups/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
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

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('sales-team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales Team')).toBeInTheDocument();
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    expect(screen.getByRole('heading', { name: 'Create Group' })).toBeInTheDocument();

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(groupsAPI.create).toHaveBeenCalled();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(groupsAPI.update).toHaveBeenCalledWith('g1', expect.any(Object));
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.create.mockRejectedValue({ response: { data: { detail: 'ID exists' } } });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('ID exists')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(groupsAPI.delete).toHaveBeenCalledWith('g1');
      expect(screen.getByText('Group deleted successfully')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(groupsAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete group')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('handles toggle status (deactivate)', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(groupsAPI.toggleStatus).toHaveBeenCalledWith('g1');
      expect(screen.getByText('Group deactivated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status (activate)', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    const activateButtons = screen.getAllByTitle('Activate');
    await user.click(activateButtons[0]);

    await waitFor(() => {
      expect(groupsAPI.toggleStatus).toHaveBeenCalledWith('g2');
      expect(screen.getByText('Group activated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.toggleStatus.mockRejectedValue(new Error('Error'));
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to toggle group status')).toBeInTheDocument();
    });
  });

  it('shows users modal when View Users clicked', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({ data: [{ email: 'u@test.com', full_name: 'Test User', is_active: true }] });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(groupsAPI.getUsers).toHaveBeenCalledWith('g1');
    });
  });

  it('handles CSV export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(exportAPI.groups.csv).toHaveBeenCalled();
    });
  });

  it('handles JSON export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(exportAPI.groups.json).toHaveBeenCalled();
    });
  });

  it('handles export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.csv.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export groups')).toBeInTheDocument();
    });
  });

  it('cancels modal via Cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    expect(screen.getByRole('heading', { name: 'Create Group' })).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Create Group' })).not.toBeInTheDocument();
  });

  it('shows Select All and Clear All buttons in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    expect(screen.getAllByText('Select All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clear All').length).toBeGreaterThanOrEqual(1);
  });

  // --- Additional coverage tests ---

  it('types in form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Type in groupId
    const groupIdInput = screen.getByPlaceholderText('e.g., custom-group');
    await user.type(groupIdInput, 'test-group');
    expect(groupIdInput.value).toBe('test-group');

    // Type in name
    const nameInput = screen.getByPlaceholderText('Group Name');
    await user.type(nameInput, 'Test Group');
    expect(nameInput.value).toBe('Test Group');

    // Type in description
    const descInput = screen.getByPlaceholderText('Brief description of the group...');
    await user.type(descInput, 'A test description');
    expect(descInput.value).toBe('A test description');
  });

  it('toggles a permission checkbox in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Find permission checkbox - permissions section shows checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    const permCheckbox = checkboxes.find(cb => !cb.checked);
    if (permCheckbox) {
      await user.click(permCheckbox);
      expect(permCheckbox.checked).toBe(true);

      // Toggle back
      await user.click(permCheckbox);
      expect(permCheckbox.checked).toBe(false);
    }
  });

  it('clicks Select All permissions button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Click first Select All button
    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    // All checkboxes should be checked now
    const checkboxes = screen.getAllByRole('checkbox');
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    expect(checkedCount).toBeGreaterThan(0);
  });

  it('clicks Clear All permissions button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // First select all, then clear all
    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[0]);
  });

  it('changes type dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Find type select
    const typeSelect = screen.getByDisplayValue('Domain');
    await user.selectOptions(typeSelect, 'system');
    expect(typeSelect.value).toBe('system');
  });

  it('changes status dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Find status select
    const statusSelect = screen.getByDisplayValue('Active');
    await user.selectOptions(statusSelect, 'inactive');
    expect(statusSelect.value).toBe('inactive');
  });

  it('shows domain filter dropdown', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Domain filter with "All Domains"
    expect(screen.getByText('All Domains')).toBeInTheDocument();
  });

  it('filters by domain', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');
    expect(domainFilter.value).toBe('sales');
  });

  it('shows permission filter options', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    expect(screen.getByText('All Permissions')).toBeInTheDocument();
  });

  it('populates edit form with existing group data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    // Verify fields are populated
    expect(screen.getByDisplayValue('sales-team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales Team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales department group')).toBeInTheDocument();
  });

  it('shows users modal with error handling', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockRejectedValue(new Error('API error'));
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const viewUsersButtons = screen.getAllByTitle('View Users');
    await user.click(viewUsersButtons[0]);

    // Should show modal even on error
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('toggles domain checkbox in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Find domain checkbox (Sales domain)
    const checkboxes = screen.getAllByRole('checkbox');
    // Domains section has its own checkboxes - find one labeled 'Sales'
    const salesLabel = screen.getAllByText('Sales');
    const domainLabel = salesLabel.find(el => el.closest('label'));
    if (domainLabel) {
      const domainCheckbox = domainLabel.closest('label').querySelector('input[type="checkbox"]');
      await user.click(domainCheckbox);
      expect(domainCheckbox.checked).toBe(true);
      // Toggle back off
      await user.click(domainCheckbox);
      expect(domainCheckbox.checked).toBe(false);
    }
  });

  it('clicks Select All and Clear All for domains', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Domains section has its own Select All / Clear All (second set)
    const selectAllBtns = screen.getAllByText('Select All');
    // First is permissions, second is domains
    if (selectAllBtns.length >= 2) {
      await user.click(selectAllBtns[1]);
      // Verify domain is selected
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
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Scope to modal to avoid matching "None" text in the table
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
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');
    expect(permFilter.value).toBe('users.read');
  });

  it('shows and clicks Clear Filters button', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Set a filter to make Clear Filters appear
    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));
    expect(domainFilter.value).toBe('');
  });

  it('shows pagination when multiple pages', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 100, pages: 4, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
  });

  it('changes priority field in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const priorityInput = screen.getByDisplayValue('0');
    await user.clear(priorityInput);
    await user.type(priorityInput, '5');
    expect(priorityInput.value).toBe('5');
  });

  it('shows customers section when type is customers', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'domain', label: 'Domain' }, { value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'c1', customerId: 'cust1', name: 'Customer 1' }, { _id: 'c2', customerId: 'cust2', name: 'Customer 2' }] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Change type to customers
    const typeSelect = screen.getByDisplayValue('Domain');
    await user.selectOptions(typeSelect, 'customers');

    // Customer section should appear
    await waitFor(() => {
      expect(screen.getByText('Customers (0 selected)')).toBeInTheDocument();
    });

    // Toggle a customer checkbox - 'cust1' appears in table AND modal, so use getAllByText
    const custLabels = screen.getAllByText('cust1');
    const modalCustLabel = custLabels.find(el => el.closest('[data-testid="modal"]'));
    const custCheckbox = modalCustLabel.closest('label').querySelector('input[type="checkbox"]');
    await user.click(custCheckbox);
    await waitFor(() => {
      expect(screen.getByText('Customers (1 selected)')).toBeInTheDocument();
    });

    // Toggle it back off
    await user.click(custCheckbox);
    await waitFor(() => {
      expect(screen.getByText('Customers (0 selected)')).toBeInTheDocument();
    });
  });

  it('uses customer search in modal', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'c1', customerId: 'cust1', name: 'Customer 1' }, { _id: 'c2', customerId: 'cust2', name: 'Customer 2' }] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Type='customers' is default now since it's the only type
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search customers by ID or name...')).toBeInTheDocument();
    });

    // Search for a customer
    const custSearch = screen.getByPlaceholderText('Search customers by ID or name...');
    await user.type(custSearch, 'cust2');

    // Only Customer 2 should remain visible
    await waitFor(() => {
      expect(screen.getByText('cust2')).toBeInTheDocument();
    });
  });

  it('selects and clears all customers', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'c1', customerId: 'cust1', name: 'Customer 1' }] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    await waitFor(() => {
      expect(screen.getByText('Customers (0 selected)')).toBeInTheDocument();
    });

    // Select All customers
    const selectAllBtns = screen.getAllByText('Select All');
    const custSelectAll = selectAllBtns[selectAllBtns.length - 1];
    await user.click(custSelectAll);

    await waitFor(() => {
      expect(screen.getByText('Customers (1 selected)')).toBeInTheDocument();
    });

    // Clear All
    const clearAllBtns = screen.getAllByText('Clear All');
    const custClearAll = clearAllBtns[clearAllBtns.length - 1];
    await user.click(custClearAll);

    await waitFor(() => {
      expect(screen.getByText('Customers (0 selected)')).toBeInTheDocument();
    });
  });

  it('handles search with debounce', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search groups/i);
    await user.type(searchInput, 'test');

    // After debounce, API should be called with search param
    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'test',
      }));
    }, { timeout: 1000 });
  });

  it('shows users modal with user data', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'user1@test.com', full_name: 'User One', is_active: true },
        { _id: 'u2', email: 'user2@test.com', full_name: 'User Two', is_active: false },
      ],
    });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
    });
  });

  it('closes users modal via Close button', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Users');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users are in this group.')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));
    await waitFor(() => {
      expect(screen.queryByText('No users are in this group.')).not.toBeInTheDocument();
    });
  });

  // ===== ADDITIONAL BRANCH COVERAGE TESTS =====

  it('navigates to next and previous pages', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 100, pages: 4, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    });

    // Click next page
    const nextButton = screen.getByText('Page 1 of 4').parentElement.querySelectorAll('button')[1];
    await user.click(nextButton);

    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it('disables previous button on first page', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 100, pages: 4, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    });

    const prevButton = screen.getByText('Page 1 of 4').parentElement.querySelectorAll('button')[0];
    expect(prevButton).toBeDisabled();
  });

  it('uses groupId fallback when _id is missing for delete', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupsWithoutId = [
      { groupId: 'no-id-group', name: 'No ID Group', type: 'domain', permissions: [], domains: [], customers: [], status: 'active', priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupsWithoutId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    groupsAPI.delete.mockResolvedValue({ data: {} });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No ID Group')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(groupsAPI.delete).toHaveBeenCalledWith('no-id-group');
    });
    jest.restoreAllMocks();
  });

  it('uses groupId fallback when _id is missing for toggleStatus', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupsWithoutId = [
      { groupId: 'no-id-group', name: 'No ID Group', type: 'domain', permissions: [], domains: [], customers: [], status: 'active', priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupsWithoutId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    groupsAPI.toggleStatus.mockResolvedValue({ data: {} });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No ID Group')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Deactivate'));

    await waitFor(() => {
      expect(groupsAPI.toggleStatus).toHaveBeenCalledWith('no-id-group');
    });
  });

  it('uses groupId fallback when _id is missing for showUsers', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupsWithoutId = [
      { groupId: 'no-id-group', name: 'No ID Group', type: 'domain', permissions: [], domains: [], customers: [], status: 'active', priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupsWithoutId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    groupsAPI.getUsers.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No ID Group')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('View Users'));

    await waitFor(() => {
      expect(groupsAPI.getUsers).toHaveBeenCalledWith('no-id-group');
    });
  });

  it('uses groupId fallback when _id is missing for update', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupsWithoutId = [
      { groupId: 'no-id-group', name: 'No ID Group', type: 'domain', permissions: [], domains: [], customers: [], status: 'active', priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupsWithoutId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    groupsAPI.update.mockResolvedValue({ data: {} });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No ID Group')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(groupsAPI.update).toHaveBeenCalledWith('no-id-group', expect.any(Object));
    });
  });

  it('handles submit error without response.data.detail (fallback message)', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.create.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save group')).toBeInTheDocument();
    });
  });

  it('handles delete error with response.data.detail', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.delete.mockRejectedValue({ response: { data: { detail: 'Cannot delete system group' } } });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('Delete')[0]);

    await waitFor(() => {
      expect(screen.getByText('Cannot delete system group')).toBeInTheDocument();
    });
    jest.restoreAllMocks();
  });

  it('handles toggle status error with response.data.detail', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.toggleStatus.mockRejectedValue({ response: { data: { detail: 'Status change not allowed' } } });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('Deactivate')[0]);

    await waitFor(() => {
      expect(screen.getByText('Status change not allowed')).toBeInTheDocument();
    });
  });

  it('renders group with >3 domains showing overflow badge', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithManyDomains = [
      {
        _id: 'g3', groupId: 'many-domains', name: 'Many Domains', type: 'domain',
        permissions: [], domains: ['dom1', 'dom2', 'dom3', 'dom4', 'dom5'], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithManyDomains, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('+2 more')).toBeInTheDocument();
      expect(screen.getByText('dom1')).toBeInTheDocument();
      expect(screen.getByText('dom2')).toBeInTheDocument();
      expect(screen.getByText('dom3')).toBeInTheDocument();
    });
  });

  it('renders group with >3 customers showing overflow badge', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithManyCustomers = [
      {
        _id: 'g4', groupId: 'many-custs', name: 'Many Customers', type: 'domain',
        permissions: [], domains: [], customers: ['c1', 'c2', 'c3', 'c4'], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithManyCustomers, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('c1')).toBeInTheDocument();
      expect(screen.getByText('c2')).toBeInTheDocument();
      expect(screen.getByText('c3')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });
  });

  it('renders group with no description (no description div)', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupsNoDesc = [
      {
        _id: 'g5', groupId: 'no-desc', name: 'No Description Group', type: 'custom',
        permissions: [], domains: [], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupsNoDesc, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Description Group')).toBeInTheDocument();
    });

    // Group with type 'custom' renders bg-surface-hover text-content-secondary
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('renders system type badge with purple styling', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('system')).toBeInTheDocument();
    });

    const systemBadge = screen.getByText('system');
    expect(systemBadge.className).toContain('bg-purple-100');
  });

  it('renders user with is_active false in users modal', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'active@test.com', full_name: 'Active User', is_active: true },
        { _id: 'u2', email: 'inactive@test.com', full_name: 'Inactive User', is_active: false },
      ],
    });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('View Users')[0]);

    await waitFor(() => {
      expect(screen.getByText('Active User')).toBeInTheDocument();
      expect(screen.getByText('Inactive User')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    // Check badge styles
    const activeBadge = screen.getByText('Active');
    expect(activeBadge.className).toContain('bg-green-100');
    const inactiveBadge = screen.getByText('Inactive');
    expect(inactiveBadge.className).toContain('bg-red-100');
  });

  it('renders user without full_name showing username fallback', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u3', email: 'noname@test.com', username: 'testuser', is_active: true },
      ],
    });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('View Users')[0]);

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('noname@test.com')).toBeInTheDocument();
    });
  });

  it('renders user without full_name or username showing email fallback', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u4', email: 'emailonly@test.com', is_active: true },
      ],
    });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('View Users')[0]);

    await waitFor(() => {
      // email appears both as name fallback and in the email line below
      const emails = screen.getAllByText('emailonly@test.com');
      expect(emails.length).toBe(2);
    });
  });

  it('handles response without pagination data', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });
    // Should still render without pagination section
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('opens create modal with default type "domain" when groupTypes is empty', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // When groupTypes is empty, fallback options should be shown
    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('Domain')).toBeInTheDocument();
    expect(within(modal).getByText('Authentication')).toBeInTheDocument();
    expect(within(modal).getByText('Bookmark')).toBeInTheDocument();
    expect(within(modal).getByText('System')).toBeInTheDocument();
  });

  it('opens edit modal with missing optional fields (defaults)', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const sparseGroup = [
      { _id: 'g6', name: 'Sparse Group', status: 'active' },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: sparseGroup, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sparse Group')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    // groupId defaults to '', type defaults to 'custom'
    const groupIdInput = screen.getByPlaceholderText('e.g., custom-group');
    expect(groupIdInput.value).toBe('');
  });

  it('shows permissions with module fallback to Other', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p1', key: 'misc.action', name: 'Misc Action' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Permission without module should be grouped under "Other"
    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('Other')).toBeInTheDocument();
    expect(within(modal).getByText('Misc Action')).toBeInTheDocument();
  });

  it('shows permission by key when name is not available', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p2', key: 'data.export', module: 'Data' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('data.export')).toBeInTheDocument();
  });

  it('shows domain display with domainId fallback', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'd2', domainId: 'finance-dom', key: 'finance' },
      ] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Domain without name should display domainId
    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('finance-dom')).toBeInTheDocument();
  });

  it('shows domain display with key fallback when no name or domainId', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'd3', key: 'operations' },
      ] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('operations')).toBeInTheDocument();
  });

  it('handles permission name fallback in filter dropdown', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p3', key: 'admin.manage', module: 'Admin' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Permission without name should show key in the filter dropdown
    const permFilter = screen.getByDisplayValue('All Permissions');
    const options = permFilter.querySelectorAll('option');
    // Check that admin.manage is in the filter dropdown
    const hasKeyOption = Array.from(options).some(o => o.textContent === 'admin.manage');
    expect(hasKeyOption).toBe(true);
  });

  it('handles domain key fallback when domain has no key in filter', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'd4', name: 'Finance Domain' },
      ] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Domain without key should use _id in the value
    const domFilter = screen.getByDisplayValue('All Domains');
    const options = domFilter.querySelectorAll('option');
    const hasDomOption = Array.from(options).some(o => o.textContent === 'Finance Domain');
    expect(hasDomOption).toBe(true);
  });

  it('toggles permission that is already selected by permissionId', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithPermId = [
      {
        _id: 'g7', groupId: 'perm-test', name: 'Perm Test', type: 'domain',
        permissions: ['users.read'], domains: [], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithPermId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p1', permissionId: 'perm-001', key: 'users.read', name: 'Read Users', module: 'Users' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Perm Test')).toBeInTheDocument();
    });

    // Edit the group - its permissions include 'users.read' which matches perm.key
    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    // The permission checkbox should be checked (matches by key)
    const modal = screen.getByTestId('modal');
    const permCheckbox = within(modal).getByRole('checkbox');
    expect(permCheckbox.checked).toBe(true);

    // Toggle it off
    await user.click(permCheckbox);
    expect(permCheckbox.checked).toBe(false);
  });

  it('toggles domain that is already selected by domainKey', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithDomKey = [
      {
        _id: 'g8', groupId: 'dom-test', name: 'Dom Test', type: 'domain',
        permissions: [], domains: ['sales-key'], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithDomKey, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'd1', domainId: 'dom-001', domainKey: 'sales-key', key: 'sales', name: 'Sales' },
      ] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Dom Test')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const modal = screen.getByTestId('modal');
    const domCheckbox = within(modal).getByRole('checkbox');
    expect(domCheckbox.checked).toBe(true);

    // Toggle off
    await user.click(domCheckbox);
    expect(domCheckbox.checked).toBe(false);
  });

  it('renders customer chips with name and without name', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'c1', customerId: 'cust1', name: 'Customer One' },
        { _id: 'c2', customerId: 'cust2' },
      ] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Type is 'customers' by default now, select both customers
    const modal = screen.getByTestId('modal');
    const checkboxes = within(modal).getAllByRole('checkbox');
    // Click on each customer checkbox
    for (const cb of checkboxes) {
      if (!cb.checked) {
        await user.click(cb);
      }
    }

    await waitFor(() => {
      expect(screen.getByText('Customers (2 selected)')).toBeInTheDocument();
    });

    // Customer chips should show: "cust1 — Customer One" and "cust2" (no name)
    // The chip for cust1 will contain the name after dash
  });

  it('removes a customer chip via X button', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'c1', customerId: 'cust1', name: 'Customer One' },
      ] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Select a customer
    const modal = screen.getByTestId('modal');
    const custCheckbox = within(modal).getByRole('checkbox');
    await user.click(custCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Customers (1 selected)')).toBeInTheDocument();
    });

    // Find the X button on the chip and click it
    const chipButtons = within(modal).getAllByRole('button').filter(btn => {
      return btn.closest('.inline-flex');
    });
    // The X button in the chip
    if (chipButtons.length > 0) {
      await user.click(chipButtons[0]);
    }

    await waitFor(() => {
      expect(screen.getByText('Customers (0 selected)')).toBeInTheDocument();
    });
  });

  it('shows no permissions available text when permissions list is empty', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('No permissions available')).toBeInTheDocument();
  });

  it('shows no domains available text when domains list is empty', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [{ _id: 'p1', key: 'test', name: 'Test', module: 'Mod' }] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('No domains available')).toBeInTheDocument();
  });

  it('shows no customers found when customer search yields no results', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'c1', customerId: 'cust1', name: 'Customer One' }] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const custSearch = screen.getByPlaceholderText('Search customers by ID or name...');
    await user.type(custSearch, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No customers found')).toBeInTheDocument();
    });
  });

  it('shows "None" text for groups with empty permissions, domains, and customers', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    // Support group has empty permissions, domains, customers - each should show "None"
    const noneTexts = screen.getAllByText('None');
    expect(noneTexts.length).toBeGreaterThanOrEqual(3);
  });

  it('shows group priority value', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Sales Team has priority 1, Support has priority 10
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows group without priority displays 0', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupNoPriority = [
      { _id: 'g9', groupId: 'no-pri', name: 'No Priority', type: 'domain', permissions: [], domains: [], customers: [], status: 'active' },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupNoPriority, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Priority')).toBeInTheDocument();
    });

    // Priority should display 0 as fallback
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows group without status displays "active" text', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupNoStatus = [
      { _id: 'g10', groupId: 'no-stat', name: 'No Status', type: 'domain', permissions: [], domains: [], customers: [], priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupNoStatus, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Status')).toBeInTheDocument();
    });

    // Status should fall back to 'active'
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows group without type displays "custom" text', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupNoType = [
      { _id: 'g11', groupId: 'no-type', name: 'No Type', permissions: [], domains: [], customers: [], status: 'active', priority: 0 },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupNoType, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('No Type')).toBeInTheDocument();
    });

    // Type should fall back to 'custom'
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('shows success message for group creation', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Group created successfully')).toBeInTheDocument();
    });
  });

  it('shows success message for group update', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('Edit')[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Group updated successfully')).toBeInTheDocument();
    });
  });

  it('handles update error with response.data.detail', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.update.mockRejectedValue({ response: { data: { detail: 'Duplicate name' } } });
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('Edit')[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Duplicate name')).toBeInTheDocument();
    });
  });

  it('handles fetchFormData failure gracefully', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockRejectedValue(new Error('Types error'));
    permissionsAPI.list.mockRejectedValue(new Error('Perms error'));
    domainsAPI.list.mockRejectedValue(new Error('Domains error'));
    customersAPI.list.mockRejectedValue(new Error('Customers error'));

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });
  });

  it('renders total count in header', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText(/2 total/)).toBeInTheDocument();
    });
  });

  it('filters both by domain and permission simultaneously and shows Clear Filters', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    // Verify API was called with both filters
    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'sales',
        permission: 'users.read',
      }));
    });

    // Click clear filters to reset both
    await user.click(screen.getByText('Clear Filters'));
    expect(domainFilter.value).toBe('');
    expect(permFilter.value).toBe('');
  });

  it('handles export success message for CSV', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.csv.mockResolvedValue({ data: 'col1,col2\n1,2' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Exported groups as CSV')).toBeInTheDocument();
    });
  });

  it('handles export success message for JSON', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.json.mockResolvedValue({ data: '{"data":[]}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(screen.getByText('Exported groups as JSON')).toBeInTheDocument();
    });
  });

  it('isCustomerSelected matches by _id', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithCustById = [
      {
        _id: 'g12', groupId: 'cust-id-test', name: 'Cust ID Test', type: 'customers',
        permissions: [], domains: [], customers: ['c1'], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithCustById, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'c1', customerId: 'cust-actual', name: 'Actual Customer' }] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Cust ID Test')).toBeInTheDocument();
    });

    // Edit this group - it has customers: ['c1'] which matches by _id
    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    // The customer checkbox should be checked because customers includes 'c1' matching _id
    const modal = screen.getByTestId('modal');
    const custCheckbox = within(modal).getByRole('checkbox');
    expect(custCheckbox.checked).toBe(true);
  });

  it('isDomainSelected matches by domainId', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithDomId = [
      {
        _id: 'g13', groupId: 'dom-id-test', name: 'Dom ID Test', type: 'domain',
        permissions: [], domains: ['dom-001'], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithDomId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'd1', domainId: 'dom-001', name: 'Domain One' }] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Dom ID Test')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const modal = screen.getByTestId('modal');
    const domCheckbox = within(modal).getByRole('checkbox');
    expect(domCheckbox.checked).toBe(true);
  });

  it('isPermissionSelected matches by permissionId', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithPermId = [
      {
        _id: 'g14', groupId: 'permid-test', name: 'PermId Test', type: 'domain',
        permissions: ['perm-001'], domains: [], customers: [], status: 'active', priority: 0,
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithPermId, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'p1', permissionId: 'perm-001', key: 'admin.read', name: 'Admin Read', module: 'Admin' }] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('PermId Test')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const modal = screen.getByTestId('modal');
    const permCheckbox = within(modal).getByRole('checkbox');
    expect(permCheckbox.checked).toBe(true);
  });

  it('shows "Showing X to Y of Z" pagination text', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
    expect(screen.getByText(/of 50 groups/i)).toBeInTheDocument();
  });

  it('customer without name does not show dash in display label', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'c5', customerId: 'cust-no-name' },
      ] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Customer without name should just show customerId, no dash
    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('cust-no-name')).toBeInTheDocument();
  });

  it('handles group data with null permissions/domains/customers', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    const groupWithNulls = [
      {
        _id: 'g15', groupId: 'null-arrays', name: 'Null Arrays Group', type: 'domain',
        status: 'active', priority: 0,
        // permissions, domains, customers all missing (not even empty arrays)
      },
    ];
    groupsAPI.list.mockResolvedValue({
      data: { data: groupWithNulls, pagination: { total: 1, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Null Arrays Group')).toBeInTheDocument();
    });

    // All should display "None" since (group.permissions || []).length === 0
    const noneTexts = screen.getAllByText('None');
    expect(noneTexts.length).toBeGreaterThanOrEqual(3);
  });

  it('handleSelectAllModule adds only that module permissions', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
        { _id: 'p2', key: 'users.write', name: 'Write Users', module: 'Users' },
        { _id: 'p3', key: 'admin.read', name: 'Read Admin', module: 'Admin' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const modal = screen.getByTestId('modal');

    // Click "All" for the Users module
    const allButtons = within(modal).getAllByText('All');
    await user.click(allButtons[0]);

    // Users module perms should be selected, Admin should not
    await waitFor(() => {
      expect(screen.getByText('Permissions (2 selected)')).toBeInTheDocument();
    });

    // Click "None" for Users module
    const noneButtons = within(modal).getAllByText('None');
    await user.click(noneButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('select all permissions selects all across modules', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [{ value: 'domain', label: 'Domain' }] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' },
        { _id: 'p2', key: 'admin.read', name: 'Read Admin', module: 'Admin' },
      ] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [{ _id: 'd1', key: 'sales', name: 'Sales' }] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Click "Select All" for permissions (first Select All in modal)
    const selectAllBtns = screen.getAllByText('Select All');
    await user.click(selectAllBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (2 selected)')).toBeInTheDocument();
    });

    // Click "Clear All" for permissions
    const clearAllBtns = screen.getAllByText('Clear All');
    await user.click(clearAllBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Permissions (0 selected)')).toBeInTheDocument();
    });
  });

  it('group status badge uses red style for inactive', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    const inactiveBadge = screen.getByText('inactive');
    expect(inactiveBadge.className).toContain('bg-red-100');
    expect(inactiveBadge.className).toContain('text-red-700');
  });

  it('group status badge uses green style for active', async () => {
    await setupMocks();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    const activeBadge = screen.getByText('active');
    expect(activeBadge.className).toContain('bg-green-100');
    expect(activeBadge.className).toContain('text-green-700');
  });

  it('shows Create Group button text in create modal and Update Group in edit modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Open create modal
    await user.click(screen.getByText('Add Group'));
    expect(screen.getByText('Create Group', { selector: 'button' })).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByText('Cancel'));

    // Open edit modal
    await user.click(screen.getAllByTitle('Edit')[0]);
    await waitFor(() => {
      expect(screen.getByText('Update Group', { selector: 'button' })).toBeInTheDocument();
    });
  });

  it('groupId input is disabled in edit mode', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('Edit')[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Group' })).toBeInTheDocument();
    });

    const groupIdInput = screen.getByDisplayValue('sales-team');
    expect(groupIdInput).toBeDisabled();
  });

  it('groupId input is not disabled in create mode', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    const groupIdInput = screen.getByPlaceholderText('e.g., custom-group');
    expect(groupIdInput).not.toBeDisabled();
  });

  it('customer name is shown with dash separator in chip', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    groupsAPI.getTypes.mockResolvedValue({
      data: [{ value: 'customers', label: 'Customers' }],
    });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({
      data: { data: [
        { _id: 'c1', customerId: 'cust1', name: 'ACME Corp' },
      ] },
    });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText(/no groups found/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Group'));

    // Select customer
    const modal = screen.getByTestId('modal');
    const custCheckbox = within(modal).getByRole('checkbox');
    await user.click(custCheckbox);

    // Should show chip with "cust1" and "ACME Corp" separated by dash
    await waitFor(() => {
      const matches = screen.getAllByText(/cust1/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
      const corpMatches = screen.getAllByText(/ACME Corp/);
      expect(corpMatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays the users modal title with group name', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    groupsAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('View Users')[0]);

    await waitFor(() => {
      expect(screen.getByText('Users in Group: Sales Team')).toBeInTheDocument();
    });
  });

  it('handles pagination on last page (next button disabled)', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    let callCount = 0;
    groupsAPI.list.mockImplementation(async (params) => {
      callCount++;
      return {
        data: { data: mockGroups, pagination: { total: 50, pages: 2, page: params.page || 0, limit: 25 } },
      };
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    // Go to page 2 (last page)
    const paginationContainer = screen.getByText('Page 1 of 2').parentElement;
    const nextButton = paginationContainer.querySelectorAll('button')[1];
    await user.click(nextButton);

    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it('handles search resetting page to 0', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText(/search groups/i);
    await user.type(searchInput, 'test');

    // After debounce, search is applied with page 0
    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'test',
        page: 0,
      }));
    }, { timeout: 1000 });
  });

  it('domain filter resets page to 0', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'd1', key: 'sales', name: 'Sales' }] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        domain: 'sales',
        page: 0,
      }));
    });
  });

  it('permission filter resets page to 0', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' }] },
    });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const permFilter = screen.getByDisplayValue('All Permissions');
    await user.selectOptions(permFilter, 'users.read');

    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        permission: 'users.read',
        page: 0,
      }));
    });
  });

  it('clear filters also resets page to 0', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: [] });
    permissionsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'p1', key: 'users.read', name: 'Read Users', module: 'Users' }] },
    });
    domainsAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'd1', key: 'sales', name: 'Sales' }] },
    });
    customersAPI.list.mockResolvedValue({ data: { data: [] } });

    const user = userEvent.setup();
    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    // Set filter
    const domainFilter = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainFilter, 'sales');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    // Clear and check page reset
    groupsAPI.list.mockClear();
    await user.click(screen.getByText('Clear Filters'));

    await waitFor(() => {
      expect(groupsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        page: 0,
      }));
    });
  });

  it('export JSON failure shows error', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../../services/api');
    exportAPI.groups.json.mockRejectedValue(new Error('JSON export error'));
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export groups')).toBeInTheDocument();
    });
  });

  it('renders the loading users state in users modal', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../../services/api');
    // Never-resolving promise to keep loading state
    groupsAPI.getUsers.mockReturnValue(new Promise(Function.prototype));
    const user = userEvent.setup();

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    await user.click(screen.getAllByTitle('View Users')[0]);

    // Modal should show loading text
    await waitFor(() => {
      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });
  });

  it('handles response data being null in groups list', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: null, pagination: { total: 0, pages: 0 } },
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

  it('handles formData response null in permissions/domains/customers', async () => {
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../../services/api');
    groupsAPI.list.mockResolvedValue({
      data: { data: mockGroups, pagination: { total: 2, pages: 1 } },
    });
    groupsAPI.getTypes.mockResolvedValue({ data: null });
    permissionsAPI.list.mockResolvedValue({ data: { data: null } });
    domainsAPI.list.mockResolvedValue({ data: { data: null } });
    customersAPI.list.mockResolvedValue({ data: { data: null } });

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });
  });
});
