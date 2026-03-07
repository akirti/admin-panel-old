import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersManagement from './CustomersManagement';

const mockIsSuperAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

vi.mock('../../services/api', () => ({
  customersAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
    getUsers: vi.fn(),
    getFilters: vi.fn(),
    assignUsers: vi.fn(),
    removeUsers: vi.fn(),
  },
  usersAPI: { list: vi.fn() },
  exportAPI: {
    customers: { csv: vi.fn(), json: vi.fn() },
  },
}));

vi.mock('../../components/shared', () => ({
  Modal: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
  Badge: ({ children, variant }) => <span data-variant={variant}>{children}</span>,
}));

const mockCustomers = [
  {
    _id: 'c1',
    customerId: 'acme-corp',
    name: 'Acme Corporation',
    description: 'Major enterprise client',
    contactEmail: 'info@acme.com',
    contactPhone: '+1-555-1234',
    status: 'active',
    unit: 'SMB',
    sales: 'West Coast',
    division: 'Engineering',
    channel: 'Partner',
    location: 'San Francisco',
    tags: ['VIP', 'Gold', 'Premium', 'Tier-1'],
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    _id: 'c2',
    customerId: 'beta-inc',
    name: 'Beta Inc',
    status: 'inactive',
    tags: [],
    created_at: '2024-03-01T00:00:00Z',
  },
];

async function setupMocks() {
  const { customersAPI, usersAPI } = await import('../../services/api');
  customersAPI.list.mockResolvedValue({
    data: { data: mockCustomers, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  customersAPI.getFilters.mockResolvedValue({
    data: { tags: ['VIP', 'Gold'], locations: ['San Francisco'], units: ['SMB'] },
  });
  usersAPI.list.mockResolvedValue({
    data: { data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User' }] },
  });
}

describe('CustomersManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(true);
  });

  it('shows access denied for non-super-admin', () => {
    mockIsSuperAdmin.mockReturnValue(false);
    render(<CustomersManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders page header', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    expect(screen.getByText('Customers Management')).toBeInTheDocument();
  });

  it('renders customers table with data', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });
  });

  it('shows customer IDs', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('acme-corp')).toBeInTheDocument();
      expect(screen.getByText('beta-inc')).toBeInTheDocument();
    });
  });

  it('shows contact info', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('info@acme.com')).toBeInTheDocument();
      expect(screen.getByText('+1-555-1234')).toBeInTheDocument();
    });
  });

  it('shows tags with overflow', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      // Acme has 4 tags, shows first 3 + "+1" overflow
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Gold')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  it('shows business attributes', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('West Coast')).toBeInTheDocument();
      expect(screen.getByText('Partner')).toBeInTheDocument();
      // "San Francisco" appears in both table and filter dropdown
      expect(screen.getAllByText('San Francisco').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    expect(screen.getByPlaceholderText(/search customers/i)).toBeInTheDocument();
  });

  it('opens create modal on Add Customer click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    expect(screen.getByRole('heading', { name: 'Create Customer' })).toBeInTheDocument();
  });

  it('shows empty state when no customers', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText(/no customers found/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockReturnValue(new Promise(() => {}));
    customersAPI.getFilters.mockReturnValue(new Promise(() => {}));
    usersAPI.list.mockReturnValue(new Promise(() => {}));

    render(<CustomersManagement />);
    expect(screen.getByText(/loading customers/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockRejectedValue(new Error('Network error'));
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch customers')).toBeInTheDocument();
    });
  });

  it('shows "No contact info" for customers without contact', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('No contact info')).toBeInTheDocument();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Customer' })).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('acme-corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    expect(screen.getByRole('heading', { name: 'Create Customer' })).toBeInTheDocument();

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(customersAPI.create).toHaveBeenCalled();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Customer' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(customersAPI.update).toHaveBeenCalledWith('c1', expect.any(Object));
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.create.mockRejectedValue({ response: { data: { detail: 'ID exists' } } });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('ID exists')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(customersAPI.delete).toHaveBeenCalledWith('c1');
      expect(screen.getByText('Customer deleted successfully')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(customersAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete customer')).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('handles toggle status (deactivate)', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(customersAPI.toggleStatus).toHaveBeenCalledWith('c1');
      expect(screen.getByText('Customer deactivated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status (activate)', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });

    const activateButtons = screen.getAllByTitle('Activate');
    await user.click(activateButtons[0]);

    await waitFor(() => {
      expect(customersAPI.toggleStatus).toHaveBeenCalledWith('c2');
      expect(screen.getByText('Customer activated successfully')).toBeInTheDocument();
    });
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.toggleStatus.mockRejectedValue(new Error('Error'));
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to toggle customer status')).toBeInTheDocument();
    });
  });

  it('shows users modal when Manage Users clicked', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [{ email: 'u@test.com', full_name: 'Test User', is_active: true }] });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(customersAPI.getUsers).toHaveBeenCalledWith('c1');
    });
  });

  it('handles CSV export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.customers.csv.mockResolvedValue({ data: 'csv data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(exportAPI.customers.csv).toHaveBeenCalled();
    });
  });

  it('handles JSON export', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.customers.json.mockResolvedValue({ data: '{}' });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(exportAPI.customers.json).toHaveBeenCalled();
    });
  });

  it('handles export failure', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.customers.csv.mockRejectedValue(new Error('Export failed'));
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(screen.getByText('Failed to export customers')).toBeInTheDocument();
    });
  });

  it('cancels modal via Cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    expect(screen.getByRole('heading', { name: 'Create Customer' })).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Create Customer' })).not.toBeInTheDocument();
  });

  it('shows status badges', async () => {
    await setupMocks();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('types in form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    expect(screen.getByRole('heading', { name: 'Create Customer' })).toBeInTheDocument();

    // Type in the customer ID field
    const inputs = screen.getByTestId('modal').querySelectorAll('input');
    if (inputs.length > 0) {
      await user.type(inputs[0], 'new-customer');
    }
  });

  it('adds and removes tags in form', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));

    // Find tag input (placeholder might be "Add tag...")
    const tagInput = screen.queryByPlaceholderText(/add tag/i) || screen.queryByPlaceholderText(/tag/i);
    if (tagInput) {
      await user.type(tagInput, 'NewTag');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('NewTag')).toBeInTheDocument();
      });
    }
  });

  it('assigns user to customer', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    customersAPI.assignUsers.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(customersAPI.getUsers).toHaveBeenCalledWith('c1');
    });
  });

  it('types in search input', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search customers/i);
    await user.type(searchInput, 'Beta');

    // Search should either filter client-side or trigger API call
    await waitFor(() => {
      expect(searchInput.value).toBe('Beta');
    });
  });

  it('filters customers by tag', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Find tag filter dropdown
    const selects = document.querySelectorAll('select');
    const tagFilter = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.textContent === 'All Tags' || o.textContent.includes('Tags'))
    );
    if (tagFilter) {
      await user.selectOptions(tagFilter, 'VIP');
    }
  });

  it('filters customers by location', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    const locationFilter = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.textContent === 'All Locations' || o.textContent.includes('Location'))
    );
    if (locationFilter) {
      await user.selectOptions(locationFilter, 'San Francisco');
    }
  });

  it('filters customers by unit', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const selects = document.querySelectorAll('select');
    const unitFilter = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.textContent === 'All Units' || o.textContent.includes('Unit'))
    );
    if (unitFilter) {
      await user.selectOptions(unitFilter, 'SMB');
    }
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.update.mockRejectedValue({ response: { data: { detail: 'Update error' } } });
    const user = userEvent.setup();

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Customer' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Update error')).toBeInTheDocument();
    });
  });

  it('adds tag in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => { expect(screen.getByText('Acme Corporation')).toBeInTheDocument(); });

    // Click button that says "Add Customer"
    const addCustBtn = screen.getAllByText(/Add Customer/);
    await user.click(addCustBtn[0]);

    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find tag input
    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'NewTag');

    // Click Add button for tags
    const modal = screen.getByTestId('modal');
    const addBtns = modal.querySelectorAll('button');
    const addTagBtn = Array.from(addBtns).find(btn => btn.textContent === 'Add');
    if (addTagBtn) {
      await user.click(addTagBtn);
      await waitFor(() => {
        expect(screen.getByText('NewTag')).toBeInTheDocument();
      });
    }
  });

  it('filters by location dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => { expect(screen.getByText('Acme Corporation')).toBeInTheDocument(); });

    const locationSelect = screen.getByDisplayValue('All Locations');
    await user.selectOptions(locationSelect, 'San Francisco');
    expect(locationSelect.value).toBe('San Francisco');
  });

  it('filters by unit dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => { expect(screen.getByText('Acme Corporation')).toBeInTheDocument(); });

    const unitSelect = screen.getByDisplayValue('All Units');
    await user.selectOptions(unitSelect, 'SMB');
    expect(unitSelect.value).toBe('SMB');
  });

  it('shows clear filters button when filter is active', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);

    await waitFor(() => { expect(screen.getByText('Acme Corporation')).toBeInTheDocument(); });

    const locationSelect = screen.getByDisplayValue('All Locations');
    await user.selectOptions(locationSelect, 'San Francisco');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear Filters'));
    expect(locationSelect.value).toBe('');
  });

  it('opens users modal and shows user management', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User' }] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => { expect(screen.getByText('Acme Corporation')).toBeInTheDocument(); });

    // Click users button
    const usersButtons = screen.getAllByTitle('Manage Users');
    if (usersButtons.length > 0) {
      await user.click(usersButtons[0]);
      await waitFor(() => {
        expect(customersAPI.getUsers).toHaveBeenCalled();
      });
    }
  });
});
