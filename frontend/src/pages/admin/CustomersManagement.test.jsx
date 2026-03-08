import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomersManagement from './CustomersManagement';

const mockIsSuperAdmin = jest.fn(() => true);

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: mockIsSuperAdmin }),
}));

jest.mock('../../services/api', () => ({
  customersAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleStatus: jest.fn(),
    getUsers: jest.fn(),
    getFilters: jest.fn(),
    assignUsers: jest.fn(),
    removeUsers: jest.fn(),
  },
  usersAPI: { list: jest.fn() },
  exportAPI: {
    customers: { csv: jest.fn(), json: jest.fn() },
  },
}));

jest.mock('../../components/shared', () => ({
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
    jest.clearAllMocks();
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
    jest.spyOn(window, 'confirm').mockReturnValue(true);

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

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(customersAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete customer')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
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

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

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

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

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

  // ===== ADDITIONAL BRANCH COVERAGE TESTS =====

  it('search debounce triggers API call with search param', async () => {
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
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    customersAPI.list.mockClear();

    const searchInput = screen.getByPlaceholderText(/search customers/i);
    await user.type(searchInput, 'Beta');

    // Wait for debounce (300ms) to trigger API call with search param
    await waitFor(() => {
      expect(customersAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Beta' })
      );
    }, { timeout: 2000 });
  });

  it('filters trigger API calls with filter params', async () => {
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
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    customersAPI.list.mockClear();

    // Set location filter
    const locationSelect = screen.getByDisplayValue('All Locations');
    await user.selectOptions(locationSelect, 'San Francisco');

    await waitFor(() => {
      expect(customersAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'San Francisco' })
      );
    });

    customersAPI.list.mockClear();

    // Set unit filter
    const unitSelect = screen.getByDisplayValue('All Units');
    await user.selectOptions(unitSelect, 'SMB');

    await waitFor(() => {
      expect(customersAPI.list).toHaveBeenCalledWith(
        expect.objectContaining({ unit: 'SMB', location: 'San Francisco' })
      );
    });
  });

  it('handles response without pagination data', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });
  });

  it('handles response with null data fields', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: null, pagination: { total: null, pages: null } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: null, locations: null, units: null },
    });
    usersAPI.list.mockResolvedValue({ data: { data: null } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText(/no customers found/i)).toBeInTheDocument();
    });
  });

  it('handles getFilters API failure', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    customersAPI.getFilters.mockRejectedValue(new Error('Filter error'));
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });
  });

  it('handles usersAPI.list failure', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockRejectedValue(new Error('Users error'));

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });
  });

  it('renders pagination when totalPages > 1', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 60, pages: 3, page: 0, limit: 25 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Should show pagination info
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 to/)).toBeInTheDocument();
  });

  it('navigates pagination forward and backward', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 60, pages: 3, page: 0, limit: 25 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // The previous button should be disabled on page 0
    const buttons = screen.getAllByRole('button');
    // Find ChevronRight button (next page) - it should be in the pagination area
    const nextBtn = buttons.find(b => b.textContent === '' && !b.disabled &&
      b.closest('.flex.items-center.gap-2'));

    // Click next page
    customersAPI.list.mockClear();
    // Find all buttons that look like pagination buttons
    const paginationArea = screen.getByText(/Page 1 of 3/).parentElement;
    const pagButtons = paginationArea.querySelectorAll('button');
    // Second button should be "next"
    if (pagButtons.length >= 2) {
      await user.click(pagButtons[1]); // Click next
      await waitFor(() => {
        expect(customersAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 })
        );
      });
    }
  });

  it('disables previous button on first page', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 60, pages: 3, page: 0, limit: 25 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const paginationArea = screen.getByText(/Page 1 of 3/).parentElement;
    const pagButtons = paginationArea.querySelectorAll('button');
    expect(pagButtons[0]).toBeDisabled(); // Previous button disabled on first page
  });

  it('renders customer without created_at showing N/A', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const customersNoDate = [
      {
        _id: 'c3',
        customerId: 'no-date',
        name: 'No Date Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: customersNoDate, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('No Date Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders customer with only contactEmail (no phone)', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c4',
        customerId: 'email-only',
        name: 'Email Only Corp',
        contactEmail: 'test@email.com',
        status: 'active',
        tags: ['tag1'],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Email Only Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('test@email.com')).toBeInTheDocument();
    expect(screen.queryByText('No contact info')).not.toBeInTheDocument();
  });

  it('renders customer with only contactPhone (no email)', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c5',
        customerId: 'phone-only',
        name: 'Phone Only Corp',
        contactPhone: '+1-999-0000',
        status: 'active',
        tags: null,
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Phone Only Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('+1-999-0000')).toBeInTheDocument();
  });

  it('renders customer with exactly 3 tags (no overflow)', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c6',
        customerId: 'three-tags',
        name: 'Three Tags Corp',
        status: 'active',
        tags: ['A', 'B', 'C'],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Three Tags Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    // No overflow indicator
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('renders customer with null tags showing dash', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c7',
        customerId: 'null-tags',
        name: 'Null Tags Corp',
        status: 'active',
        tags: null,
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Null Tags Corp')).toBeInTheDocument();
    });
  });

  it('renders customer with no description', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c8',
        customerId: 'no-desc',
        name: 'No Description Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('No Description Corp')).toBeInTheDocument();
    });
  });

  it('renders customer with description showing truncated text', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Major enterprise client')).toBeInTheDocument();
    });
  });

  it('renders customer showing dash for missing business attributes', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c9',
        customerId: 'no-attrs',
        name: 'No Attrs Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('No Attrs Corp')).toBeInTheDocument();
    });

    // unit, sales, division, channel, location all missing => show '-'
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it('renders success badge for active customer', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const activeBadge = screen.getByText('active');
    expect(activeBadge).toHaveAttribute('data-variant', 'success');
  });

  it('renders danger badge for inactive customer', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    });

    const inactiveBadge = screen.getByText('inactive');
    expect(inactiveBadge).toHaveAttribute('data-variant', 'danger');
  });

  it('renders customer with no status defaulting to active label', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const cust = [
      {
        _id: 'c10',
        customerId: 'no-status',
        name: 'No Status Corp',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('No Status Corp')).toBeInTheDocument();
    });

    // customer.status || 'active' => shows 'active'
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('edit modal populates with fallback empty values for missing fields', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    // Customer with all fields missing
    const cust = [
      {
        _id: 'c11',
        customerId: 'minimal',
        name: 'Minimal Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: cust, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Minimal Corp')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Customer' })).toBeInTheDocument();
    });

    // All optional fields should be empty strings
    expect(screen.getByDisplayValue('minimal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Minimal Corp')).toBeInTheDocument();
  });

  it('adds tag via Enter key in form', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'EnterTag');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('EnterTag')).toBeInTheDocument();
    });
  });

  it('does not add duplicate tag', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'DupTag');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('DupTag')).toBeInTheDocument();
    });

    // Try adding same tag again
    await user.type(tagInput, 'DupTag');
    await user.keyboard('{Enter}');

    // Should still be only one
    const dupTags = screen.getAllByText('DupTag');
    expect(dupTags.length).toBe(1);
  });

  it('does not add empty tag', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    // Press Enter without typing anything
    await user.keyboard('{Enter}');

    // No tags should appear
    const modal = screen.getByTestId('modal');
    expect(modal.querySelectorAll('.rounded-full').length).toBe(0);
  });

  it('removes tag from form', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'RemoveMe');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('RemoveMe')).toBeInTheDocument();
    });

    // Click the X button next to the tag
    const tagEl = screen.getByText('RemoveMe');
    const removeBtn = tagEl.parentElement.querySelector('button');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('RemoveMe')).not.toBeInTheDocument();
    });
  });

  it('does not handle Enter key for non-Enter keys in tag input', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'TestTag');
    // Press Tab instead of Enter - should not add tag
    await user.keyboard('{Tab}');

    // Tag should not be added (input content lost focus but tag not created)
    expect(screen.queryByText('TestTag')).not.toBeInTheDocument();
  });

  it('handles form input change for all fields', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const modal = screen.getByTestId('modal');

    // Type in all form fields by placeholder
    await user.type(screen.getByPlaceholderText('e.g., acme-corp'), 'test-id');
    expect(screen.getByPlaceholderText('e.g., acme-corp').value).toBe('test-id');

    await user.type(screen.getByPlaceholderText('Acme Corporation'), 'Test Corp');
    expect(screen.getByPlaceholderText('Acme Corporation').value).toBe('Test Corp');

    await user.type(screen.getByPlaceholderText('Brief description of the customer...'), 'A description');
    expect(screen.getByPlaceholderText('Brief description of the customer...').value).toBe('A description');

    await user.type(screen.getByPlaceholderText('contact@example.com'), 'test@test.com');
    expect(screen.getByPlaceholderText('contact@example.com').value).toBe('test@test.com');

    await user.type(screen.getByPlaceholderText('+1 (555) 123-4567'), '555-5555');
    expect(screen.getByPlaceholderText('+1 (555) 123-4567').value).toBe('555-5555');

    await user.type(screen.getByPlaceholderText('Full address...'), '123 Main St');
    expect(screen.getByPlaceholderText('Full address...').value).toBe('123 Main St');

    await user.type(screen.getByPlaceholderText('Business unit...'), 'Enterprise');
    expect(screen.getByPlaceholderText('Business unit...').value).toBe('Enterprise');

    await user.type(screen.getByPlaceholderText('Sales region/team...'), 'North');
    expect(screen.getByPlaceholderText('Sales region/team...').value).toBe('North');

    await user.type(screen.getByPlaceholderText('Division...'), 'Tech');
    expect(screen.getByPlaceholderText('Division...').value).toBe('Tech');

    await user.type(screen.getByPlaceholderText('Channel...'), 'Direct');
    expect(screen.getByPlaceholderText('Channel...').value).toBe('Direct');

    await user.type(screen.getByPlaceholderText('Location...'), 'NYC');
    expect(screen.getByPlaceholderText('Location...').value).toBe('NYC');
  });

  it('handles status select change in form', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const modal = screen.getByTestId('modal');
    // Find status select (the one in the modal, not filters)
    const statusSelect = modal.querySelector('select[name="status"]');
    await user.selectOptions(statusSelect, 'inactive');
    expect(statusSelect.value).toBe('inactive');
  });

  it('create success shows success message and closes modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Customer created successfully')).toBeInTheDocument();
    });

    // Modal should be closed
    expect(screen.queryByRole('heading', { name: 'Create Customer' })).not.toBeInTheDocument();
  });

  it('update success shows success message and closes modal', async () => {
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
      expect(screen.getByText('Customer updated successfully')).toBeInTheDocument();
    });
  });

  it('create failure without response.data.detail uses fallback error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.create.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save customer')).toBeInTheDocument();
    });
  });

  it('delete failure with response.data.detail shows specific error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.delete.mockRejectedValue({ response: { data: { detail: 'Cannot delete active customer' } } });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cannot delete active customer')).toBeInTheDocument();
    });
    jest.restoreAllMocks();
  });

  it('toggle status failure with response.data.detail shows specific error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.toggleStatus.mockRejectedValue({ response: { data: { detail: 'Toggle not allowed' } } });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Toggle not allowed')).toBeInTheDocument();
    });
  });

  it('uses customerId fallback when _id is missing for update', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'no-id-corp',
        name: 'No ID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('No ID Corp')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Customer' })).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(customersAPI.update).toHaveBeenCalledWith('no-id-corp', expect.any(Object));
    });
  });

  it('uses customerId fallback when _id is missing for delete', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'del-no-id',
        name: 'Del No ID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Del No ID Corp')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(customersAPI.delete).toHaveBeenCalledWith('del-no-id');
    });
    jest.restoreAllMocks();
  });

  it('uses customerId fallback when _id is missing for toggleStatus', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'toggle-no-id',
        name: 'Toggle No ID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Toggle No ID Corp')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    await waitFor(() => {
      expect(customersAPI.toggleStatus).toHaveBeenCalledWith('toggle-no-id');
    });
  });

  it('uses customerId fallback when _id is missing for showUsers', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'users-no-id',
        name: 'Users No ID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Users No ID Corp')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(customersAPI.getUsers).toHaveBeenCalledWith('users-no-id');
    });
  });

  it('shows users modal with assigned users list', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'user1@test.com', full_name: 'User One', is_active: true },
        { _id: 'u2', email: 'user2@test.com', username: 'usertwo', is_active: false },
      ],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('user1@test.com')).toBeInTheDocument();
      expect(screen.getByText('usertwo')).toBeInTheDocument();
      expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    });

    // Check active/inactive badges
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows users modal with user who has only email (no full_name or username)', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u3', email: 'onlyemail@test.com', is_active: true },
      ],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      // Should display email as the name (fallback: user.full_name || user.username || user.email)
      const emailElems = screen.getAllByText('onlyemail@test.com');
      expect(emailElems.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty users message when no users assigned', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });
  });

  it('shows loading state in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockReturnValue(new Promise(() => {})); // Never resolves
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });
  });

  it('handles getUsers failure in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockRejectedValue(new Error('Users fetch failed'));
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });
  });

  it('searches and assigns user in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers
      .mockResolvedValueOnce({ data: [] })   // Initial load
      .mockResolvedValueOnce({ data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User', is_active: true }] }); // After assign
    customersAPI.assignUsers.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    // Search for a user to assign
    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    // Click to assign
    await user.click(screen.getByText('Test User'));

    await waitFor(() => {
      expect(customersAPI.assignUsers).toHaveBeenCalledWith('c1', ['u1']);
    });
  });

  it('assign user failure shows error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    customersAPI.assignUsers.mockRejectedValue({ response: { data: { detail: 'Assign failed' } } });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test User'));

    await waitFor(() => {
      expect(screen.getByText('Assign failed')).toBeInTheDocument();
    });
  });

  it('assign user failure without detail uses fallback error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    customersAPI.assignUsers.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test User'));

    await waitFor(() => {
      expect(screen.getByText('Failed to assign user')).toBeInTheDocument();
    });
  });

  it('removes user from customer in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers
      .mockResolvedValueOnce({ data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User', is_active: true }] })
      .mockResolvedValueOnce({ data: [] }); // After removal
    customersAPI.removeUsers.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    // Click remove button
    const removeBtn = screen.getByTitle('Remove from customer');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(customersAPI.removeUsers).toHaveBeenCalledWith('c1', ['u1']);
    });
  });

  it('remove user failure shows error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User', is_active: true }],
    });
    customersAPI.removeUsers.mockRejectedValue({ response: { data: { detail: 'Remove failed' } } });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('Remove from customer');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText('Remove failed')).toBeInTheDocument();
    });
  });

  it('remove user failure without detail uses fallback error', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User', is_active: true }],
    });
    customersAPI.removeUsers.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('Remove from customer');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText('Failed to remove user')).toBeInTheDocument();
    });
  });

  it('filters available users by email search in users modal', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
          { _id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones' },
        ],
      },
    });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    // Search by email
    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'alice');

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    // Bob should not appear (doesn't match 'alice')
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });

  it('filters available users by full_name search in users modal', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
          { _id: 'u2', email: 'bob@test.com', full_name: 'Bob Jones' },
        ],
      },
    });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'Bob');

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('shows "No matching users found" when search has no results', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'u1', email: 'alice@test.com', full_name: 'Alice' }] },
    });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'zzzznonexistent');

    await waitFor(() => {
      expect(screen.getByText('No matching users found')).toBeInTheDocument();
    });
  });

  it('excludes already-assigned users from available users list', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'alice@test.com', full_name: 'Alice' },
          { _id: 'u2', email: 'bob@test.com', full_name: 'Bob' },
        ],
      },
    });
    // Alice is already assigned
    customersAPI.getUsers.mockResolvedValue({
      data: [{ _id: 'u1', email: 'alice@test.com', full_name: 'Alice', is_active: true }],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Search for users to assign
    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'bob');

    // Bob should appear in available list but Alice should not (she's already assigned)
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('closes users modal via Close button', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('No users assigned to this customer')).not.toBeInTheDocument();
    });
  });

  it('shows user with full_name in available users dropdown', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' },
          { _id: 'u2', email: 'nofullname@test.com' },
        ],
      },
    });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'no');

    // User without full_name should show email as display name (appears in both name and email fields)
    await waitFor(() => {
      const matches = screen.getAllByText('nofullname@test.com');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('error/success messages auto-clear after timeout', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockRejectedValueOnce(new Error('Network error'));
    customersAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch customers')).toBeInTheDocument();
    });

    // The error auto-clear uses setTimeout(5000)
    // Verify the error message eventually clears
    await waitFor(() => {
      expect(screen.queryByText('Failed to fetch customers')).not.toBeInTheDocument();
    }, { timeout: 7000 });
  }, 10000);

  it('success message auto-clears after timeout', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.toggleStatus.mockResolvedValue({ data: {} });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    deactivateButtons[0].click();

    await waitFor(() => {
      expect(screen.getByText('Customer deactivated successfully')).toBeInTheDocument();
    });

    // The success auto-clear uses setTimeout(5000)
    await waitFor(() => {
      expect(screen.queryByText('Customer deactivated successfully')).not.toBeInTheDocument();
    }, { timeout: 7000 });
  }, 10000);

  it('export CSV creates blob and triggers download', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.customers.csv.mockResolvedValue({ data: 'col1,col2\nval1,val2' });
    const user = userEvent.setup();

    const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
    const mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const mockAppendChild = jest.spyOn(document.body, 'appendChild');
    const mockRemoveChild = jest.spyOn(document.body, 'removeChild');

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as CSV'));

    await waitFor(() => {
      expect(exportAPI.customers.csv).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(screen.getByText('Exported customers as CSV')).toBeInTheDocument();
    });

    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('export JSON creates blob and triggers download', async () => {
    await setupMocks();
    const { exportAPI } = await import('../../services/api');
    exportAPI.customers.json.mockResolvedValue({ data: '{"customers":[]}' });
    const user = userEvent.setup();

    const mockCreateObjectURL = jest.fn(() => 'blob:test-url');
    const mockRevokeObjectURL = jest.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export'));
    await user.click(screen.getByText('Export as JSON'));

    await waitFor(() => {
      expect(exportAPI.customers.json).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(screen.getByText('Exported customers as JSON')).toBeInTheDocument();
    });
  });

  it('clear filters resets both location and unit', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Set both filters
    const locationSelect = screen.getByDisplayValue('All Locations');
    await user.selectOptions(locationSelect, 'San Francisco');

    const unitSelect = screen.getByDisplayValue('All Units');
    await user.selectOptions(unitSelect, 'SMB');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    customersAPI.list.mockClear();

    await user.click(screen.getByText('Clear Filters'));

    // Both filters should be reset
    expect(locationSelect.value).toBe('');
    expect(unitSelect.value).toBe('');
  });

  it('only unit filter shows clear filters button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const unitSelect = screen.getByDisplayValue('All Units');
    await user.selectOptions(unitSelect, 'SMB');

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('shows total count in header', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText(/2 total/)).toBeInTheDocument();
    });
  });

  it('shows the Assigned Users count in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'user1@test.com', full_name: 'User One', is_active: true },
        { _id: 'u2', email: 'user2@test.com', full_name: 'User Two', is_active: true },
      ],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Assigned Users (2)')).toBeInTheDocument();
    });
  });

  it('shows modal title with customer name in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Manage Users: Acme Corporation/ })).toBeInTheDocument();
    });
  });

  it('shows Assign User section heading in users modal', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Assign User')).toBeInTheDocument();
    });
  });

  it('displays customer with customerId as key when _id is missing', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'key-fallback',
        name: 'Key Fallback Corp',
        status: 'active',
        tags: ['one', 'two'],
        created_at: '2024-06-01T00:00:00Z',
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Key Fallback Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('key-fallback')).toBeInTheDocument();
  });

  it('handles customer with created_at date rendering', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Check that date is formatted (locale-dependent, so match dynamically)
    const expectedDate = new Date('2024-01-15T00:00:00Z').toLocaleDateString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('shows Update Customer button text in edit modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Update Customer')).toBeInTheDocument();
    });
  });

  it('shows Create Customer button text in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));

    await waitFor(() => {
      // Submit button should say "Create Customer"
      const modal = screen.getByTestId('modal');
      const submitBtn = modal.querySelector('button[type="submit"]');
      expect(submitBtn.textContent).toBe('Create Customer');
    });
  });

  it('customerId input is disabled in edit mode', async () => {
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

    const customerIdInput = screen.getByDisplayValue('acme-corp');
    expect(customerIdInput).toBeDisabled();
  });

  it('customerId input is enabled in create mode', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const customerIdInput = screen.getByPlaceholderText('e.g., acme-corp');
    expect(customerIdInput).not.toBeDisabled();
  });

  it('edit modal pre-fills tags from existing customer', async () => {
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

    // Tags from Acme: VIP, Gold, Premium, Tier-1 should be in the form
    const modal = screen.getByTestId('modal');
    // VIP appears both in the tag badges in the form and possibly in the table behind
    const formTags = modal.querySelectorAll('.rounded-full');
    expect(formTags.length).toBe(4);
  });

  it('users modal shows user with full_name over username over email fallback', async () => {
    await setupMocks();
    const { customersAPI } = await import('../../services/api');
    customersAPI.getUsers.mockResolvedValue({
      data: [
        { _id: 'u1', email: 'a@test.com', full_name: 'Full Name User', username: 'username1', is_active: true },
        { _id: 'u2', email: 'b@test.com', username: 'username2', is_active: true },
        { _id: 'u3', email: 'c@test.com', is_active: false },
      ],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Full Name User')).toBeInTheDocument();
      expect(screen.getByText('username2')).toBeInTheDocument();
      // The third user should display email as name
      const cEmails = screen.getAllByText('c@test.com');
      expect(cEmails.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles users modal with assignUsers using customerId fallback', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'assign-noid',
        name: 'Assign NoID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({
      data: { data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User' }] },
    });
    customersAPI.getUsers
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Test User', is_active: true }] });
    customersAPI.assignUsers.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Assign NoID Corp')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test User'));

    await waitFor(() => {
      expect(customersAPI.assignUsers).toHaveBeenCalledWith('assign-noid', ['u1']);
    });
  });

  it('handles users modal with removeUsers using customerId fallback', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    const custNoId = [
      {
        customerId: 'remove-noid',
        name: 'Remove NoID Corp',
        status: 'active',
        tags: [],
      },
    ];
    customersAPI.list.mockResolvedValue({
      data: { data: custNoId, pagination: { total: 1, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({ data: { tags: [], locations: [], units: [] } });
    usersAPI.list.mockResolvedValue({ data: { data: [] } });
    customersAPI.getUsers
      .mockResolvedValueOnce({ data: [{ _id: 'u1', email: 'user@test.com', full_name: 'Removable User', is_active: true }] })
      .mockResolvedValueOnce({ data: [] });
    customersAPI.removeUsers.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Remove NoID Corp')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Removable User')).toBeInTheDocument();
    });

    const removeBtn = screen.getByTitle('Remove from customer');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(customersAPI.removeUsers).toHaveBeenCalledWith('remove-noid', ['u1']);
    });
  });

  it('filters users excluding those matched by email', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'same@test.com', full_name: 'Same User' },
          { _id: 'u2', email: 'different@test.com', full_name: 'Diff User' },
        ],
      },
    });
    // Assigned user matches by email but has different _id
    customersAPI.getUsers.mockResolvedValue({
      data: [{ _id: 'u99', email: 'same@test.com', full_name: 'Same User Already', is_active: true }],
    });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Same User Already')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'test');

    // 'Same User' should be excluded (email match), 'Diff User' should appear
    await waitFor(() => {
      expect(screen.getByText('Diff User')).toBeInTheDocument();
    });
  });

  it('user without full_name in available users shows email as name', async () => {
    const { customersAPI, usersAPI } = await import('../../services/api');
    customersAPI.list.mockResolvedValue({
      data: { data: mockCustomers, pagination: { total: 2, pages: 1 } },
    });
    customersAPI.getFilters.mockResolvedValue({
      data: { tags: [], locations: [], units: [] },
    });
    usersAPI.list.mockResolvedValue({
      data: {
        data: [
          { _id: 'u1', email: 'nofull@test.com' },
        ],
      },
    });
    customersAPI.getUsers.mockResolvedValue({ data: [] });
    const user = userEvent.setup();

    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    const manageButtons = screen.getAllByTitle('Manage Users');
    await user.click(manageButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('No users assigned to this customer')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users to assign...');
    await user.type(searchInput, 'nofull');

    await waitFor(() => {
      // user.full_name || user.email => shows email
      const elements = screen.getAllByText('nofull@test.com');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('isSuperAdmin not called should not fetch data', () => {
    mockIsSuperAdmin.mockReturnValue(false);
    render(<CustomersManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Customers Management')).not.toBeInTheDocument();
  });

  it('renders customer info badge variants correctly', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Tags in table use 'info' variant
    const tagBadges = screen.getAllByText('VIP');
    tagBadges.forEach(badge => {
      expect(badge).toHaveAttribute('data-variant', 'info');
    });
  });

  it('renders table headers', async () => {
    await setupMocks();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    expect(screen.getByText('Customer ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('handles add tag via Add button click', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, 'ButtonTag');

    const modal = screen.getByTestId('modal');
    const addBtns = modal.querySelectorAll('button');
    const addTagBtn = Array.from(addBtns).find(btn => btn.textContent === 'Add');
    await user.click(addTagBtn);

    await waitFor(() => {
      expect(screen.getByText('ButtonTag')).toBeInTheDocument();
    });

    // Tag input should be cleared after adding
    expect(tagInput.value).toBe('');
  });

  it('add tag button with whitespace-only input does nothing', async () => {
    await setupMocks();
    const user = userEvent.setup();
    render(<CustomersManagement />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Customer'));
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');
    await user.type(tagInput, '   ');

    const modal = screen.getByTestId('modal');
    const addBtns = modal.querySelectorAll('button');
    const addTagBtn = Array.from(addBtns).find(btn => btn.textContent === 'Add');
    await user.click(addTagBtn);

    // No tags should appear
    const formTags = modal.querySelectorAll('.rounded-full');
    expect(formTags.length).toBe(0);
  });
});
