import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import UsersManagement from './UsersManagement';

vi.mock('../../services/api', () => ({
  usersAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
    sendPasswordReset: vi.fn(),
  },
  rolesAPI: { list: vi.fn() },
  groupsAPI: { list: vi.fn() },
  customersAPI: { list: vi.fn() },
  exportAPI: {
    users: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUsers = [
  {
    _id: '1',
    email: 'user1@test.com',
    username: 'user1',
    full_name: 'User One',
    roles: ['admin', 'user'],
    groups: ['group1'],
    customers: [],
    is_active: true,
  },
  {
    _id: '2',
    email: 'user2@test.com',
    username: 'user2',
    full_name: 'User Two',
    roles: ['user'],
    groups: [],
    customers: [],
    is_active: false,
  },
];

const mockRoles = [
  { _id: 'r1', roleId: 'admin', name: 'Admin' },
  { _id: 'r2', roleId: 'user', name: 'User' },
];

const mockGroups = [
  { _id: 'g1', groupId: 'group1', name: 'Group 1' },
];

const mockCustomers = [
  { _id: 'c1', customerId: 'cust1', name: 'Customer 1' },
];

async function setupMocks() {
  const { usersAPI, rolesAPI, groupsAPI, customersAPI } = await import('../../services/api');
  usersAPI.list.mockResolvedValue({
    data: { data: mockUsers, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  rolesAPI.list.mockResolvedValue({ data: { data: mockRoles } });
  groupsAPI.list.mockResolvedValue({ data: { data: mockGroups } });
  customersAPI.list.mockResolvedValue({ data: { data: mockCustomers } });
}

function renderUsersManagement() {
  return render(
    <MemoryRouter>
      <UsersManagement />
    </MemoryRouter>
  );
}

describe('UsersManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
      expect(screen.getByText('Manage user accounts and access')).toBeInTheDocument();
    });
  });

  it('renders users table with data', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    });
  });

  it('shows status badges', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('opens add user modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });
  });

  it('renders export buttons', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('JSON')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by email, username, or name...')).toBeInTheDocument();
    });
  });

  it('renders role filter dropdown', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('All Roles')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { usersAPI, rolesAPI, groupsAPI, customersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.list.mockRejectedValue(new Error('API Error'));
    rolesAPI.list.mockRejectedValue(new Error('API Error'));
    groupsAPI.list.mockRejectedValue(new Error('API Error'));
    customersAPI.list.mockRejectedValue(new Error('API Error'));

    renderUsersManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load users');
    });
  });

  it('shows role badges with overflow', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      // User One has 2 roles shown as badges, User Two has 1
      expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('user').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // Submit form (form handler is onSubmit)
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(usersAPI.create).toHaveBeenCalled();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(usersAPI.delete).toHaveBeenCalledWith('user1@test.com');
      expect(toast.default.success).toHaveBeenCalledWith('User deleted successfully');
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(usersAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles toggle status (disable active user)', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    // First user is active, so the button title is "Disable"
    const disableButtons = screen.getAllByTitle('Disable');
    await user.click(disableButtons[0]);

    await waitFor(() => {
      expect(usersAPI.toggleStatus).toHaveBeenCalledWith('user1@test.com');
      expect(toast.default.success).toHaveBeenCalledWith('User disabled successfully');
    });
  });

  it('handles toggle status (enable inactive user)', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    });

    // Second user is inactive, so the button title is "Enable"
    const enableButtons = screen.getAllByTitle('Enable');
    await user.click(enableButtons[0]);

    await waitFor(() => {
      expect(usersAPI.toggleStatus).toHaveBeenCalledWith('user2@test.com');
      expect(toast.default.success).toHaveBeenCalledWith('User enabled successfully');
    });
  });

  it('handles send password reset', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.sendPasswordReset.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByTitle('Send Password Reset');
    await user.click(resetButtons[0]);

    await waitFor(() => {
      expect(usersAPI.sendPasswordReset).toHaveBeenCalledWith('user1@test.com', true);
      expect(toast.default.success).toHaveBeenCalledWith('Password reset email sent');
    });
  });

  it('handles CSV export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    exportAPI.users.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('CSV'));

    await waitFor(() => {
      expect(exportAPI.users.csv).toHaveBeenCalled();
    });
  });

  it('handles JSON export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    exportAPI.users.json.mockResolvedValue({ data: '{"users":[]}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('JSON'));

    await waitFor(() => {
      expect(exportAPI.users.json).toHaveBeenCalled();
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete user');
    });

    vi.restoreAllMocks();
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.toggleStatus.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const disableButtons = screen.getAllByTitle('Disable');
    await user.click(disableButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to update user status');
    });
  });

  it('handles password reset failure', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.sendPasswordReset.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const resetButtons = screen.getAllByTitle('Send Password Reset');
    await user.click(resetButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to send password reset');
    });
  });

  it('handles export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    exportAPI.users.csv.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('CSV'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to export users');
    });
  });

  it('renders usernames in table', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
    });
  });

  it('renders full names in table', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
    });
  });

  it('renders group filter dropdown', async () => {
    await setupMocks();
    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('All Groups')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching data', async () => {
    const { usersAPI, rolesAPI, groupsAPI, customersAPI } = await import('../../services/api');
    usersAPI.list.mockReturnValue(new Promise(() => {}));
    rolesAPI.list.mockReturnValue(new Promise(() => {}));
    groupsAPI.list.mockReturnValue(new Promise(() => {}));
    customersAPI.list.mockReturnValue(new Promise(() => {}));

    const { container } = renderUsersManagement();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('edit modal shows email field as disabled', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // Email should be disabled in edit mode
    const emailInput = screen.getByDisplayValue('user1@test.com');
    expect(emailInput).toBeDisabled();
  });

  it('edit modal does not show password field', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // Password field should not be present in edit mode
    expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
  });

  it('create modal shows password field', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // Password input has no placeholder - find by label text
    expect(screen.getByText('Password *')).toBeInTheDocument();
    const passwordInput = document.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
  });

  it('filters users by search term', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by email, username, or name...');
    await user.type(searchInput, 'user1');

    // Should trigger API refetch with search param
    await waitFor(() => {
      expect(usersAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'user1',
      }));
    });
  });

  it('filters users by role dropdown', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const roleSelect = screen.getByDisplayValue('All Roles');
    await user.selectOptions(roleSelect, 'admin');

    await waitFor(() => {
      expect(usersAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        role: 'admin',
      }));
    });
  });

  it('filters users by group dropdown', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const groupSelect = screen.getByDisplayValue('All Groups');
    await user.selectOptions(groupSelect, 'group1');

    await waitFor(() => {
      expect(usersAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        group: 'group1',
      }));
    });
  });

  it('clears filters when Clear Filters is clicked', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    // Set a filter first
    const roleSelect = screen.getByDisplayValue('All Roles');
    await user.selectOptions(roleSelect, 'admin');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));

    // After clearing, the role filter should be reset
    expect(roleSelect.value).toBe('');
  });

  it('edit modal pre-populates user data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // Check pre-populated fields
    expect(screen.getByDisplayValue('user1@test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('user1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('User One')).toBeInTheDocument();
  });

  it('submits update form with correct data', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // Submit the form
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(usersAPI.update).toHaveBeenCalledWith('user1@test.com', expect.objectContaining({
        email: 'user1@test.com',
        username: 'user1',
        full_name: 'User One',
      }));
      expect(toast.default.success).toHaveBeenCalledWith('User updated successfully');
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.create.mockRejectedValue(new Error('Email exists'));
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Operation failed');
    });
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { usersAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    usersAPI.update.mockRejectedValue(new Error('Update failed'));
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Operation failed');
    });
  });

  it('shows role checkboxes in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // Role names appear in both filter dropdown options and modal checkboxes
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(2);
  });

  it('shows group checkboxes in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // Group names appear in both filter dropdown and modal checkboxes
    expect(screen.getAllByText('Group 1').length).toBeGreaterThanOrEqual(2);
  });

  it('shows customer checkboxes in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    expect(screen.getByText('Customer 1')).toBeInTheDocument();
  });

  it('shows Select All and Clear All buttons for roles', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // Should have Select All / Clear All buttons (multiple instances for roles/groups/customers)
    expect(screen.getAllByText('Select All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Clear All').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Send Password Email checkbox for new users', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    expect(screen.getByText('Send password email')).toBeInTheDocument();
  });

  it('shows Is Active checkbox in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    // "Active" appears in both table badges and modal checkbox - use getAllByText
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
  });

  it('cancels modal via cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add User'));

    await waitFor(() => {
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    // Modal should be closed
    expect(screen.queryByText('Create User')).not.toBeInTheDocument();
  });

  it('shows +N more badge when user has many roles', async () => {
    const { usersAPI, rolesAPI, groupsAPI, customersAPI } = await import('../../services/api');
    usersAPI.list.mockResolvedValue({
      data: {
        data: [{
          _id: '3',
          email: 'multi@test.com',
          username: 'multi',
          full_name: 'Multi Role',
          roles: ['admin', 'user', 'editor', 'viewer'],
          groups: [],
          customers: [],
          is_active: true,
        }],
        pagination: { total: 1, pages: 1, page: 0, limit: 25 },
      },
    });
    rolesAPI.list.mockResolvedValue({ data: { data: mockRoles } });
    groupsAPI.list.mockResolvedValue({ data: { data: mockGroups } });
    customersAPI.list.mockResolvedValue({ data: { data: mockCustomers } });

    renderUsersManagement();

    await waitFor(() => {
      expect(screen.getByText('multi@test.com')).toBeInTheDocument();
    });

    // Should show +2 (4 roles, shows first 2 + overflow badge with count)
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
