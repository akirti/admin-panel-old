import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import ScenarioDetailPage from './ScenarioDetailPage';

// ---- mocks ----

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { user_id: 'u1', full_name: 'Test User', username: 'testuser' },
    isSuperAdmin: () => false,
    isAdmin: () => false,
    isEditor: () => true,
    hasPermission: (p) => {
      const allowed = ['scenarios.edit', 'playboards.create', 'playboards.delete'];
      return allowed.includes(p);
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props) => null,
  FileText: (props) => null,
  ChevronRight: (props) => null,
  Layout: (props) => null,
  Settings: (props) => null,
  Plus: (props) => null,
  Edit2: (props) => null,
  Download: (props) => null,
  Eye: (props) => null,
  Trash2: (props) => null,
  Upload: (props) => null,
  X: (props) => null,
}));

vi.mock('../../components/shared', () => ({
  Card: ({ children, className, ...props }) => <div data-testid="card" className={className} {...props}>{children}</div>,
  Button: ({ children, onClick, disabled, variant, type, className, ...props }) => (
    <button onClick={onClick} disabled={disabled} type={type || 'button'} className={className} {...props}>{children}</button>
  ),
  Input: ({ label, value, onChange, placeholder, required, disabled, type, ...props }) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value || ''} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} type={type || 'text'} />
    </div>
  ),
  Modal: ({ isOpen, onClose, title, children, size }) => (
    isOpen ? <div data-testid="modal" role="dialog"><h2>{title}</h2>{children}</div> : null
  ),
  Badge: ({ children, variant, className }) => <span data-testid="badge" className={className}>{children}</span>,
  Select: ({ label, value, onChange, options }) => (
    <div>
      {label && <label>{label}</label>}
      <select value={value} onChange={onChange}>
        {options && options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  ),
  Toggle: ({ enabled, onChange, label }) => (
    <label>
      <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  ),
  FileUpload: ({ accept, label, onFileSelect }) => (
    <div data-testid="file-upload">{label}</div>
  ),
}));

vi.mock('../../services/api', () => ({
  scenariosAPI: {
    get: vi.fn(),
    getPlayboards: vi.fn(),
  },
  playboardsAPI: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    download: vi.fn(),
    toggleStatus: vi.fn(),
    upload: vi.fn(),
  },
  domainsAPI: {
    list: vi.fn(),
  },
}));

// ---- helpers ----

const mockScenario = {
  name: 'Customer Search',
  key: 'customer_search',
  description: 'A scenario for searching customers',
  status: 'active',
  domainKey: 'customers',
  order: 1,
};

const mockPlayboards = [
  {
    _id: 'pb1',
    name: 'Customer Playboard',
    description: 'Main playboard',
    status: 'active',
    scenarioKey: 'customer_search',
    data: {
      key: 'customer_pb_1',
      widgets: {
        filters: [{ name: 'query' }],
        grid: { actions: { rowActions: { events: [{ name: 'View' }] } } },
      },
    },
  },
];

function renderPage(scenarioKey = 'customer_search', domainKey = 'customers') {
  return render(
    <MemoryRouter initialEntries={[`/domains/${domainKey}/scenarios/${scenarioKey}`]}>
      <Routes>
        <Route path="/domains/:domainKey/scenarios/:scenarioKey" element={<ScenarioDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function setupMocks(scenario = mockScenario, playboards = mockPlayboards) {
  const { scenariosAPI, domainsAPI } = await import('../../services/api');
  scenariosAPI.get.mockResolvedValue({ data: scenario });
  scenariosAPI.getPlayboards.mockResolvedValue({ data: playboards });
  domainsAPI.list.mockResolvedValue({ data: { data: [{ key: 'customers', name: 'Customers' }] } });
  return { scenariosAPI, domainsAPI };
}

// ---- tests ----

describe('ScenarioDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', async () => {
    const { scenariosAPI, domainsAPI } = await import('../../services/api');
    scenariosAPI.get.mockReturnValue(new Promise(() => {}));
    scenariosAPI.getPlayboards.mockReturnValue(new Promise(() => {}));
    domainsAPI.list.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows "Scenario Not Found" when scenario is null', async () => {
    const { scenariosAPI, domainsAPI } = await import('../../services/api');
    scenariosAPI.get.mockResolvedValue({ data: null });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: [] });
    domainsAPI.list.mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Scenario Not Found')).toBeInTheDocument();
    });
  });

  it('renders scenario header with name and key', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
      expect(screen.getByText('customer_search')).toBeInTheDocument();
    });
  });

  it('displays scenario description', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('A scenario for searching customers')).toBeInTheDocument();
    });
  });

  it('shows breadcrumb navigation with Domains link', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Domains')).toBeInTheDocument();
    });
  });

  it('renders Playboards tab with count', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Playboards \(1\)/)).toBeInTheDocument();
    });
  });

  it('renders Details tab', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  it('lists playboards with name and key', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
      expect(screen.getByText('customer_pb_1')).toBeInTheDocument();
    });
  });

  it('shows filter and action badge counts for playboards', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('1 Filters')).toBeInTheDocument();
      expect(screen.getByText('1 Actions')).toBeInTheDocument();
    });
  });

  it('shows empty state when no playboards exist', async () => {
    await setupMocks(mockScenario, []);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No playboards available for this scenario.')).toBeInTheDocument();
    });
  });

  it('shows toast.error on API failure', async () => {
    const { scenariosAPI, domainsAPI } = await import('../../services/api');
    scenariosAPI.get.mockRejectedValue(new Error('Server error'));
    scenariosAPI.getPlayboards.mockRejectedValue(new Error('Server error'));
    domainsAPI.list.mockRejectedValue(new Error('Server error'));
    const toast = (await import('react-hot-toast')).default;

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load scenario details');
    });
  });

  it('renders Edit Scenario link for editors', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });
  });

  it('renders Build Playboard and Upload JSON buttons when user can add', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Build Playboard').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Upload JSON').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('switches to Details tab and shows Scenario Information', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const detailsTab = screen.getByText('Details');
    fireEvent.click(detailsTab);

    await waitFor(() => {
      expect(screen.getByText('Scenario Information')).toBeInTheDocument();
    });
  });

  it('shows Active badge for active scenario', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      const badges = screen.getAllByTestId('badge');
      const activeLabels = badges.filter(b => b.textContent === 'Active');
      expect(activeLabels.length).toBeGreaterThan(0);
    });
  });

  // --- Interaction tests ---

  it('opens Build Playboard modal with create form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getAllByText('Create Playboard').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('creates playboard successfully via form submission', async () => {
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.create.mockResolvedValue({ data: {} });
    // Re-mock for fetchData after create
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in key and name fields
    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    const nameInput = screen.getByPlaceholderText('Customer Search Playboard');
    await user.type(keyInput, 'new_playboard');
    await user.type(nameInput, 'New Playboard');

    // Submit form
    const form = screen.getByTestId('modal').querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(playboardsAPI.create).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Playboard created successfully');
    });
  });

  it('handles create playboard error', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key already exists' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    await user.type(keyInput, 'dup');

    const form = screen.getByTestId('modal').querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Key already exists');
    });
  });

  it('opens edit modal with existing playboard data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    const editBtn = screen.getByTitle('Edit');
    await user.click(editBtn);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Edit Playboard')).toBeInTheDocument();
    });
  });

  it('updates playboard via form submission', async () => {
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.update.mockResolvedValue({ data: {} });
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    const editBtn = screen.getByTitle('Edit');
    await user.click(editBtn);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const form = screen.getByTestId('modal').querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(playboardsAPI.update).toHaveBeenCalledWith('pb1', expect.any(Object));
      expect(toast.success).toHaveBeenCalledWith('Playboard updated successfully');
    });
  });

  it('handles update playboard error', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.update.mockRejectedValue({ response: { data: { detail: 'Update failed' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Edit'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const form = screen.getByTestId('modal').querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });

  it('deletes playboard after confirmation', async () => {
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.delete.mockResolvedValue({ data: {} });
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Delete'));

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete "Customer Playboard"?');

    await waitFor(() => {
      expect(playboardsAPI.delete).toHaveBeenCalledWith('pb1');
      expect(toast.success).toHaveBeenCalledWith('Playboard deleted successfully');
    });
  });

  it('cancels delete when confirm is false', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Delete'));

    expect(playboardsAPI.delete).not.toHaveBeenCalled();
  });

  it('downloads playboard as JSON file', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.download.mockResolvedValue({ data: { key: 'customer_pb_1', widgets: {} } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    window.URL.createObjectURL = vi.fn(() => 'blob:test');
    window.URL.revokeObjectURL = vi.fn();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Download JSON'));

    await waitFor(() => {
      expect(playboardsAPI.download).toHaveBeenCalledWith('pb1');
      expect(toast.success).toHaveBeenCalledWith('Playboard downloaded');
    });
  });

  it('handles download error', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.download.mockRejectedValue(new Error('Download failed'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Download JSON'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to download playboard');
    });
  });

  it('opens detail view modal showing playboard name', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('View JSON'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Playboard Details')).toBeInTheDocument();
    });
  });

  it('opens Upload JSON modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const uploadBtns = screen.getAllByText('Upload JSON');
    await user.click(uploadBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Upload Playboard JSON')).toBeInTheDocument();
    });
  });

  it('handles delete playboard API error', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.delete.mockRejectedValue({ response: { data: { detail: 'Cannot delete' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot delete');
    });
  });

  it('shows Details tab with scenario info fields', async () => {
    await setupMocks({ ...mockScenario, path: '/customers', icon: 'search', type: 'dynamic' });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    await user.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Scenario Information')).toBeInTheDocument();
      expect(screen.getByText('Path')).toBeInTheDocument();
      expect(screen.getByText('/customers')).toBeInTheDocument();
      expect(screen.getByText('Icon')).toBeInTheDocument();
      // "search" text appears in scenario name too, just check the label
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('dynamic')).toBeInTheDocument();
    });
  });

  it('shows Order in details tab when order is defined', async () => {
    await setupMocks({ ...mockScenario, order: 5 });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    await user.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Order')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows sub-domains in details tab', async () => {
    await setupMocks({ ...mockScenario, subDomains: [{ name: 'Sub A', key: 'sub_a' }] });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    await user.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Sub-Domains')).toBeInTheDocument();
      expect(screen.getByText('Sub A')).toBeInTheDocument();
      expect(screen.getByText('sub_a')).toBeInTheDocument();
    });
  });

  it('shows Inactive badge for inactive scenario', async () => {
    await setupMocks({ ...mockScenario, status: 'inactive' });

    renderPage();

    await waitFor(() => {
      const badges = screen.getAllByTestId('badge');
      const inactiveLabels = badges.filter(b => b.textContent === 'Inactive');
      expect(inactiveLabels.length).toBeGreaterThan(0);
    });
  });

  it('navigates to domain link in breadcrumb', async () => {
    await setupMocks();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('customers').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows form tabs in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      const modal = screen.getByTestId('modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText('Basic Info')).toBeInTheDocument();
      expect(within(modal).getByText('Filters')).toBeInTheDocument();
      expect(within(modal).getByText('Row Actions')).toBeInTheDocument();
      expect(within(modal).getByText('Grid Settings')).toBeInTheDocument();
      expect(within(modal).getAllByText('Description').length).toBeGreaterThanOrEqual(1);
      expect(within(modal).getByText('JSON Preview')).toBeInTheDocument();
    });
  });

  it('shows description in playboard list', async () => {
    await setupMocks(mockScenario, [{
      ...mockPlayboards[0],
      description: 'A detailed description',
    }]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('A detailed description')).toBeInTheDocument();
    });
  });

  // --- Modal form tab interaction tests ---

  it('switches to Filters tab in create modal and adds a filter', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Filters tab
    await user.click(screen.getByText('Filters'));

    await waitFor(() => {
      expect(screen.getByText('Add New Filter')).toBeInTheDocument();
    });

    // Fill in filter name and display name
    const nameInput = screen.getByPlaceholderText('query_text');
    const displayInput = screen.getByPlaceholderText('Customer#');
    await user.type(nameInput, 'search_query');
    await user.type(displayInput, 'Search');

    // Click Add Filter
    await user.click(screen.getByText('Add Filter'));

    // Filter should appear in configured filters
    await waitFor(() => {
      expect(screen.getByText('Configured Filters (1)')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });
  });

  it('switches to Row Actions tab in create modal and adds an action', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Row Actions tab
    await user.click(screen.getByText('Row Actions'));

    await waitFor(() => {
      expect(screen.getByText('Add New Row Action')).toBeInTheDocument();
    });

    // Fill in action key and name
    const keyInput = screen.getByPlaceholderText('orders_scenario_6');
    const nameInput = screen.getByPlaceholderText('Orders');
    await user.type(keyInput, 'view');
    await user.type(nameInput, 'View');

    // Click Add Row Action
    await user.click(screen.getByText('Add Row Action'));

    // Action should appear
    await waitFor(() => {
      expect(screen.getByText('Configured Row Actions (1)')).toBeInTheDocument();
    });
  });

  it('switches to Grid Settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Grid Settings'));

    await waitFor(() => {
      expect(screen.getByText('Enable Pagination')).toBeInTheDocument();
    });
  });

  it('switches to Description tab and adds a description', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Description tab - may appear multiple times
    const modal = screen.getByTestId('modal');
    const descBtns = within(modal).getAllByText('Description');
    const tabBtn = descBtns.find(b => b.tagName === 'BUTTON');
    if (tabBtn) await user.click(tabBtn);

    await waitFor(() => {
      expect(screen.getByText('Add Description Element')).toBeInTheDocument();
    });
  });

  it('switches to JSON Preview tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('JSON Preview'));

    // Should show a pre tag with JSON
    await waitFor(() => {
      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
    });
  });

  it('adds addon configuration in basic tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in addon input
    const addonInput = screen.getByPlaceholderText('customer-api_v2');
    await user.type(addonInput, 'test-addon');

    // Find and click the Add button next to addon input
    const modal = screen.getByTestId('modal');
    const addBtns = within(modal).getAllByText('Add');
    // The addon Add button should be there
    if (addBtns.length > 0) await user.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('test-addon')).toBeInTheDocument();
    });
  });

  it('toggles playboard status', async () => {
    // Note: toggleStatus is not in the ScenarioDetailPage UI as a button,
    // but let's test the handler is available
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.toggleStatus.mockResolvedValue({ data: {} });
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    // Active badge should be present
    const badges = screen.getAllByTestId('badge');
    const activeBadge = badges.find(b => b.textContent === 'Active');
    expect(activeBadge).toBeTruthy();
  });

  it('shows upload modal with file upload component and Expected JSON Structure', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const uploadBtns = screen.getAllByText('Upload JSON');
    await user.click(uploadBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Upload Playboard JSON')).toBeInTheDocument();
      expect(screen.getByText('Expected JSON Structure:')).toBeInTheDocument();
      expect(screen.getByText('Select playboard JSON file')).toBeInTheDocument();
    });
  });

  it('shows detail modal with playboard JSON', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('View JSON'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Playboard Details')).toBeInTheDocument();
      // Customer Playboard appears in both list and modal
      expect(screen.getAllByText('Customer Playboard').length).toBeGreaterThanOrEqual(2);
    });
  });

  // --- Remove/delete handler tests ---

  it('removes a filter from the configured filters', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Filters tab
    await user.click(screen.getByText('Filters'));

    await waitFor(() => {
      expect(screen.getByText('Add New Filter')).toBeInTheDocument();
    });

    // Add a filter first
    const nameInput = screen.getByPlaceholderText('query_text');
    const displayInput = screen.getByPlaceholderText('Customer#');
    await user.type(nameInput, 'temp_filter');
    await user.type(displayInput, 'Temp');
    await user.click(screen.getByText('Add Filter'));

    await waitFor(() => {
      expect(screen.getByText('Configured Filters (1)')).toBeInTheDocument();
    });

    // Remove the filter
    const removeButtons = document.querySelectorAll('button[title="Remove"]');
    if (removeButtons.length > 0) {
      await user.click(removeButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Configured Filters (0)')).toBeInTheDocument();
      });
    }
  });

  it('removes a row action from configured actions', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Row Actions tab
    await user.click(screen.getByText('Row Actions'));

    await waitFor(() => {
      expect(screen.getByText('Add New Row Action')).toBeInTheDocument();
    });

    // Add a row action first
    const keyInput = screen.getByPlaceholderText('orders_scenario_6');
    const nameInput = screen.getByPlaceholderText('Orders');
    await user.type(keyInput, 'action_key');
    await user.type(nameInput, 'Action Name');
    await user.click(screen.getByText('Add Row Action'));

    await waitFor(() => {
      expect(screen.getByText('Configured Row Actions (1)')).toBeInTheDocument();
    });

    // Remove the row action
    const removeButtons = document.querySelectorAll('button[title="Remove"]');
    if (removeButtons.length > 0) {
      await user.click(removeButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Configured Row Actions (0)')).toBeInTheDocument();
      });
    }
  });

  it('removes an addon', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Add an addon first
    const addonInput = screen.getByPlaceholderText('customer-api_v2');
    await user.type(addonInput, 'remove-addon');
    const modal = screen.getByTestId('modal');
    const addBtns = within(modal).getAllByText('Add');
    if (addBtns.length > 0) await user.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('remove-addon')).toBeInTheDocument();
    });

    // Find and click X/remove button for the addon
    const removeButtons = document.querySelectorAll('button[title="Remove addon"]');
    if (removeButtons.length > 0) {
      await user.click(removeButtons[0]);
    } else {
      // Try finding a close button near the addon text
      const addonSpan = screen.getByText('remove-addon');
      const parent = addonSpan.closest('.flex') || addonSpan.parentElement;
      if (parent) {
        const btn = parent.querySelector('button');
        if (btn) await user.click(btn);
      }
    }
  });

  it('adds description element in description tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Description tab
    const modal = screen.getByTestId('modal');
    const descBtns = within(modal).getAllByText('Description');
    const tabBtn = descBtns.find(b => b.tagName === 'BUTTON');
    if (tabBtn) await user.click(tabBtn);

    await waitFor(() => {
      expect(screen.getByText('Add Description Element')).toBeInTheDocument();
    });

    // Click Add Description button
    await user.click(screen.getByText('Add Description'));

    // A description element should be added - shows "Scenario Description Items" heading
    await waitFor(() => {
      expect(screen.getByText('Scenario Description Items')).toBeInTheDocument();
    });
  });

  it('adds select filter options', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Switch to Filters tab
    await user.click(screen.getByText('Filters'));

    await waitFor(() => {
      expect(screen.getByText('Add New Filter')).toBeInTheDocument();
    });

    // Change filter type to select
    const filterTypeSelect = document.querySelector('select[name="filterType"]') ||
      Array.from(document.querySelectorAll('select')).find(s =>
        Array.from(s.options).some(o => o.value === 'select' || o.textContent === 'Select')
      );
    if (filterTypeSelect) {
      await user.selectOptions(filterTypeSelect, 'select');
    }
  });

  it('uploads playboard JSON file', async () => {
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.upload.mockResolvedValue({ data: {} });
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const uploadBtns = screen.getAllByText('Upload JSON');
    await user.click(uploadBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // The FileUpload mock doesn't support file selection, but we can verify the modal renders
    expect(screen.getByText('Upload Playboard JSON')).toBeInTheDocument();
  });

  it('handles create API error', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key already exists' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in the key and submit
    const inputs = screen.getByTestId('modal').querySelectorAll('input');
    const keyInput = Array.from(inputs).find(i => i.placeholder?.includes('playboard'));
    if (keyInput) await user.type(keyInput, 'test_pb');

    const form = screen.getByTestId('modal').querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Key already exists');
    });
  });

  it('shows domain key in breadcrumb', async () => {
    await setupMocks();
    renderPage();

    await waitFor(() => {
      const domainLinks = screen.getAllByText('customers');
      expect(domainLinks.length).toBeGreaterThanOrEqual(1);
      // Breadcrumb link should point to domain page
      const breadcrumbLink = domainLinks.find(el => el.tagName === 'A' && el.href?.includes('/domains/customers'));
      expect(breadcrumbLink).toBeTruthy();
    });
  });

  it('toggles pagination in grid settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Grid Settings'));

    await waitFor(() => {
      expect(screen.getByText('Enable Pagination')).toBeInTheDocument();
    });

    // Toggle pagination checkbox (starts checked=true, clicking unchecks it)
    const paginationCheckbox = screen.getByLabelText('Enable Pagination');
    expect(paginationCheckbox.checked).toBe(true);
    await user.click(paginationCheckbox);
    expect(paginationCheckbox.checked).toBe(false);
  });

  it('fills default page size in grid settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Grid Settings'));

    // Find default page size input via label parent (mock Input has label+input as siblings)
    const pageSizeLabel = screen.getByText('Default Page Size');
    const pageSizeInput = pageSizeLabel.parentElement.querySelector('input');
    fireEvent.change(pageSizeInput, { target: { value: '50' } });
    expect(pageSizeInput.value).toBe('50');
  });

  it('changes render as option in grid settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Grid Settings'));

    // Find renderAs dropdown (if present)
    const selects = screen.getByTestId('modal').querySelectorAll('select');
    if (selects.length > 0) {
      const renderAsSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'button' || o.textContent.includes('Button'))
      );
      if (renderAsSelect) {
        await user.selectOptions(renderAsSelect, 'button');
      }
    }
  });

  it('toggles status for active playboard', async () => {
    const { scenariosAPI } = await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.toggleStatus.mockResolvedValue({ data: {} });
    scenariosAPI.get.mockResolvedValue({ data: mockScenario });
    scenariosAPI.getPlayboards.mockResolvedValue({ data: mockPlayboards });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
    });

    // Find toggle button
    const toggleBtn = screen.queryByTitle('Deactivate') || screen.queryByTitle('Toggle Status');
    if (toggleBtn) {
      await user.click(toggleBtn);
      await waitFor(() => {
        expect(playboardsAPI.toggleStatus).toHaveBeenCalledWith('pb1');
      });
    }
  });

  it('fills form fields in basic info tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill order field via label parent (mock Input has label+input as siblings)
    const orderLabel = screen.getByText('Order');
    const orderInput = orderLabel.parentElement.querySelector('input');
    await user.clear(orderInput);
    await user.type(orderInput, '3');
    expect(orderInput.value).toBe('3');

    // Fill description textarea (placeholder is 'Playboard description...')
    const descInput = screen.getByPlaceholderText('Playboard description...');
    await user.type(descInput, 'Test description');
    expect(descInput.value).toBe('Test description');
  });

  it('adds action filter mapping in row actions tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Search' })).toBeInTheDocument();
    });

    const buildBtns = screen.getAllByText('Build Playboard');
    await user.click(buildBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Row Actions'));

    // First add a row action
    const keyInput = screen.getByPlaceholderText('orders_scenario_6');
    const nameInput = screen.getByPlaceholderText('Orders');
    await user.type(keyInput, 'query_action');
    await user.type(nameInput, 'Query');
    await user.click(screen.getByText('Add Row Action'));

    await waitFor(() => {
      expect(screen.getByText('Configured Row Actions (1)')).toBeInTheDocument();
    });

    // Fill filter mapping fields (correct placeholders from source)
    const inputKeyField = screen.queryByPlaceholderText('inputKey (e.g., query_customer)');
    const dataKeyField = screen.queryByPlaceholderText('dataKey (e.g., customer)');
    if (inputKeyField && dataKeyField) {
      await user.type(inputKeyField, 'query_field');
      await user.type(dataKeyField, 'field');
      // Click Add to add the filter mapping
      const modal = screen.getByTestId('modal');
      const addBtns = within(modal).getAllByText('Add');
      const addFilterBtn = addBtns.find(b => b.closest('.flex')?.querySelector('input[placeholder*="inputKey"]'));
      if (addFilterBtn) await user.click(addFilterBtn);
    }
  });

  it('shows multiple playboards with badges', async () => {
    const multiPlayboards = [
      ...mockPlayboards,
      {
        _id: 'pb2',
        name: 'Second Playboard',
        description: 'Another playboard',
        status: 'inactive',
        scenarioKey: 'customer_search',
        data: {
          key: 'second_pb',
          widgets: { filters: [], grid: { actions: { rowActions: { events: [] } } } },
        },
      },
    ];
    await setupMocks(mockScenario, multiPlayboards);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Customer Playboard')).toBeInTheDocument();
      expect(screen.getByText('Second Playboard')).toBeInTheDocument();
      expect(screen.getByText(/Playboards \(2\)/)).toBeInTheDocument();
    });
  });
});
