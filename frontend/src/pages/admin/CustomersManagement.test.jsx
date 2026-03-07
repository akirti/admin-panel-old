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
});
