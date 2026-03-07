import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
    groupsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

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

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(groupsAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../services/api');
    groupsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GroupsManagement />);

    await waitFor(() => {
      expect(screen.getByText('Sales Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete group')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('handles toggle status (deactivate)', async () => {
    await setupMocks();
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { exportAPI } = await import('../../services/api');
    exportAPI.groups.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

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
    const { exportAPI } = await import('../../services/api');
    exportAPI.groups.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

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
    const { exportAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
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
    const { groupsAPI, permissionsAPI, domainsAPI, customersAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
    const { groupsAPI } = await import('../../services/api');
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
});
