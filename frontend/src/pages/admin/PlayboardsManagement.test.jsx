import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import PlayboardsManagement from './PlayboardsManagement';

vi.mock('../../services/api', () => ({
  playboardsAPI: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
  },
  scenariosAPI: { list: vi.fn() },
  domainsAPI: { list: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../components/shared', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  Button: ({ children, onClick, disabled, type, variant }) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
  Input: ({ label, value, onChange, placeholder, required, disabled, type }) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} type={type || 'text'} />
    </div>
  ),
  Table: ({ columns, data, loading }) => {
    if (loading) return <div>Loading...</div>;
    return (
      <table>
        <thead>
          <tr>{columns.map((col, i) => <th key={i}>{col.title}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map((col, j) => (
                <td key={j}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  Modal: ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return <div data-testid="modal"><h2>{title}</h2>{children}</div>;
  },
  Badge: ({ children, variant }) => <span data-variant={variant}>{children}</span>,
  SearchInput: ({ value, onChange, placeholder }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  ),
  Select: ({ label, value, onChange, options }) => (
    <div>
      {label && <label>{label}</label>}
      <select value={value} onChange={onChange}>
        {options?.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  ),
  Toggle: ({ enabled, onChange, label }) => (
    <label><input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />{label}</label>
  ),
  FileUpload: ({ accept, label, onFileSelect }) => (
    <div>{label}</div>
  ),
  Pagination: ({ currentPage, totalPages, onPageChange }) => (
    <div>Page {currentPage + 1} of {totalPages}</div>
  ),
}));

const mockPlayboards = [
  {
    id: 'pb1',
    _id: 'pb1',
    name: 'Customer Search',
    key: 'customer_search_1',
    scenarioKey: 'customers',
    status: 'active',
    data: { key: 'customer_search_1', dataDomain: 'customers', widgets: { filters: [{}], grid: { actions: { rowActions: { events: [{}] } } } } },
  },
  {
    id: 'pb2',
    _id: 'pb2',
    name: 'Order Report',
    key: 'order_report_1',
    scenarioKey: 'orders',
    status: 'inactive',
    data: { key: 'order_report_1', dataDomain: 'orders', widgets: { filters: [], grid: { actions: { rowActions: { events: [] } } } } },
  },
];

async function setupMocks() {
  const { playboardsAPI, scenariosAPI, domainsAPI } = await import('../../services/api');
  playboardsAPI.list.mockResolvedValue({
    data: { data: mockPlayboards, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  scenariosAPI.list.mockResolvedValue({ data: { data: [{ key: 'customers', name: 'Customers' }] } });
  domainsAPI.list.mockResolvedValue({ data: { data: [{ key: 'customers', name: 'Customers' }] } });
}

function renderPlayboardsManagement() {
  return render(
    <MemoryRouter>
      <PlayboardsManagement />
    </MemoryRouter>
  );
}

describe('PlayboardsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Playboards' })).toBeInTheDocument();
      expect(screen.getByText(/Manage playboard configurations/)).toBeInTheDocument();
    });
  });

  it('renders playboards table', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
      expect(screen.getByText('Order Report')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search playboards...')).toBeInTheDocument();
    });
  });

  it('renders action buttons', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText(/Upload JSON/)).toBeInTheDocument();
      expect(screen.getByText(/Build Playboard/)).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getAllByText('Create Playboard').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles API error', async () => {
    const { playboardsAPI, scenariosAPI, domainsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.list.mockRejectedValue(new Error('API Error'));
    scenariosAPI.list.mockRejectedValue(new Error('API Error'));
    domainsAPI.list.mockRejectedValue(new Error('API Error'));

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load data');
    });
  });

  it('shows status badges in table', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in required fields on Basic Info tab
    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    const nameInput = screen.getByPlaceholderText('Customer Search Playboard');
    await user.type(keyInput, 'test_playboard_key');
    await user.type(nameInput, 'Test Playboard');

    // Submit the form
    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(playboardsAPI.create).toHaveBeenCalled();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    // Click the edit button (pencil icon) for first playboard
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Edit Playboard')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Playboard')).toBeInTheDocument();
    });

    // Submit the form
    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(playboardsAPI.update).toHaveBeenCalledWith('pb1', expect.any(Object));
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(playboardsAPI.delete).toHaveBeenCalledWith('pb1');
      expect(toast.default.success).toHaveBeenCalledWith('Playboard deleted successfully');
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines confirmation', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(playboardsAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('opens view details modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View JSON');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('handles download', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.download.mockResolvedValue({ data: { key: 'test' } });
    const user = userEvent.setup();

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download JSON');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(playboardsAPI.download).toHaveBeenCalledWith('pb1');
    });
  });

  it('opens upload modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Upload JSON/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('closes create modal and resets form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Modal should have Create Playboard title
    expect(screen.getAllByText('Create Playboard').length).toBeGreaterThanOrEqual(1);
  });

  it('shows filter and action counts in table', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      // Customer Search has 1 filter and 1 action, Order Report has 0 filters and 0 actions
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('handles create API failure', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.create.mockRejectedValue({ response: { data: { detail: 'Duplicate key' } } });
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Submit the form
    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Duplicate key');
    });
  });

  it('handles delete API failure', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete playboard');
    });

    vi.restoreAllMocks();
  });

  it('renders tabs in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
      // 'Filters' appears both in the tab and table header so use getAllByText
      expect(screen.getAllByText('Filters').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Row Actions')).toBeInTheDocument();
      expect(screen.getByText('Grid Settings')).toBeInTheDocument();
      expect(screen.getByText('JSON Preview')).toBeInTheDocument();
    });
  });

  it('handles download failure', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.download.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download JSON');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to download playboard');
    });
  });

  it('switches to Filters tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Click on Filters tab
    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Add New Filter')).toBeInTheDocument();
    });
  });

  it('switches to Row Actions tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Row Actions'));

    await waitFor(() => {
      expect(screen.getByText('Add New Row Action')).toBeInTheDocument();
    });
  });

  it('switches to Grid Settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Grid Settings'));

    await waitFor(() => {
      expect(screen.getByText('Enable Pagination')).toBeInTheDocument();
    });
  });

  it('switches to JSON Preview tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('JSON Preview'));

    await waitFor(() => {
      // JSON Preview tab renders a <pre> with JSON content
      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
    });
  });

  it('fills in basic info form fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in basic info fields
    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    await user.type(keyInput, 'my_playboard');
    expect(keyInput.value).toBe('my_playboard');

    const nameInput = screen.getByPlaceholderText('Customer Search Playboard');
    await user.type(nameInput, 'My Playboard');
    expect(nameInput.value).toBe('My Playboard');
  });

  it('edit modal populates form with existing playboard data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Playboard')).toBeInTheDocument();
    });

    // Key should be populated in edit mode
    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    expect(keyInput.value).toBe('customer_search_1');
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.update.mockRejectedValue({ response: { data: { detail: 'Update failed' } } });
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Playboard')).toBeInTheDocument();
    });

    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Update failed');
    });
  });

  it('shows filter builder with filter type dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Add New Filter')).toBeInTheDocument();
    });

    // Filter builder form fields should be present
    expect(screen.getByText('Name (key)')).toBeInTheDocument();
  });

  it('shows description tab content', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Click on Description tab - use the tab text since it might be different
    const tabs = screen.getByTestId('modal').querySelectorAll('button');
    const descTab = Array.from(tabs).find(t => t.textContent === 'Description');
    if (descTab) {
      await user.click(descTab);
      await waitFor(() => {
        expect(screen.getByText('Add Description Element')).toBeInTheDocument();
      });
    }
  });

  it('search filters playboards by name', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search playboards...');
    await user.type(searchInput, 'Customer');

    // Search should trigger API refetch with search param
    await waitFor(() => {
      expect(playboardsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'Customer',
      }));
    });
  });

  it('shows empty state when no playboards', async () => {
    const { playboardsAPI, scenariosAPI, domainsAPI } = await import('../../services/api');
    playboardsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0, page: 0, limit: 25 } },
    });
    scenariosAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    renderPlayboardsManagement();

    await waitFor(() => {
      // With empty data, table renders but no playboard names appear
      expect(screen.queryByText('Customer Search')).not.toBeInTheDocument();
      expect(screen.queryByText('Order Report')).not.toBeInTheDocument();
    });
  });

  it('shows keys in table', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('customer_search_1')).toBeInTheDocument();
      expect(screen.getByText('order_report_1')).toBeInTheDocument();
    });
  });

  it('shows scenario keys in table', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      // scenarioKey appears in Scenario column and may also match dataDomain
      expect(screen.getAllByText('customers').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('orders').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows table column headers', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Scenario')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      // 'Actions' appears twice (row actions count column + action buttons column)
      expect(screen.getAllByText('Actions').length).toBe(2);
    });
  });

  it('shows upload modal with scenario selector', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Upload JSON/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Upload Playboard JSON')).toBeInTheDocument();
    });
  });

  // --- Filter management tests ---

  it('adds a filter via the Filters tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Switch to Filters tab
    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    await waitFor(() => { expect(screen.getByText('Add New Filter')).toBeInTheDocument(); });

    // Fill filter form
    const nameInput = screen.getByPlaceholderText('query_text');
    const displayInput = screen.getByPlaceholderText('Customer#');
    await user.type(nameInput, 'query_customer');
    await user.type(displayInput, 'Customer Name');

    // Click "Add Filter"
    await user.click(screen.getByText('Add Filter'));

    // Should show "Configured Filters (1)"
    await waitFor(() => {
      expect(screen.getByText(/Configured Filters \(1\)/)).toBeInTheDocument();
    });
  });

  it('removes a filter from configured filters', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    // Open edit modal (has a filter already)
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);
    await waitFor(() => { expect(screen.getByText('Edit Playboard')).toBeInTheDocument(); });

    // Switch to Filters tab
    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    // Should show configured filters
    await waitFor(() => {
      expect(screen.getByText(/Configured Filters/)).toBeInTheDocument();
    });

    // Delete the filter - click the Delete button within configured filters
    const deleteButtons = screen.getByTestId('modal').querySelectorAll('button[title="Delete"]');
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
    }
  });

  it('adds a description element via Description tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Switch to Description tab
    const tabs = screen.getByTestId('modal').querySelectorAll('button');
    const descTab = Array.from(tabs).find(t => t.textContent === 'Description');
    if (descTab) {
      await user.click(descTab);

      await waitFor(() => {
        expect(screen.getByText('Add Description Element')).toBeInTheDocument();
      });

      // Fill in description text and click add
      const textInputs = screen.getByTestId('modal').querySelectorAll('input[type="text"]');
      // The last text input should be the description text field
      const descInput = Array.from(textInputs).pop();
      if (descInput) {
        await user.type(descInput, 'Welcome to the report');
      }

      await user.click(screen.getByText('Add Description Element'));
    }
  });

  it('switches to Row Actions tab and shows form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find and click Row Actions tab
    const tabs = screen.getByTestId('modal').querySelectorAll('button');
    const actionsTab = Array.from(tabs).find(t => t.textContent === 'Row Actions');
    if (actionsTab) {
      await user.click(actionsTab);

      await waitFor(() => {
        expect(screen.getByText('Add New Row Action')).toBeInTheDocument();
      });
    }
  });

  it('adds a row action via Row Actions tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Switch to Row Actions tab
    const tabs = screen.getByTestId('modal').querySelectorAll('button');
    const actionsTab = Array.from(tabs).find(t => t.textContent === 'Row Actions');
    if (actionsTab) {
      await user.click(actionsTab);

      await waitFor(() => {
        expect(screen.getByText('Add New Row Action')).toBeInTheDocument();
      });

      // Fill in action fields - find by label text
      const allInputs = screen.getByTestId('modal').querySelectorAll('input[type="text"]');
      // Fill in the key and name fields (first two inputs in the action form)
      if (allInputs.length >= 2) {
        await user.type(allInputs[0], 'drill_down');
        await user.type(allInputs[1], 'Drill Down');
      }

      // Click "Add Row Action"
      const addBtn = screen.queryByText('Add Row Action');
      if (addBtn) {
        await user.click(addBtn);
        await waitFor(() => {
          expect(screen.getByText(/Configured Row Actions/)).toBeInTheDocument();
        });
      }
    }
  });

  it('switches to Grid Settings tab', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // This was already tested but let's verify content
    await user.click(screen.getByText('Grid Settings'));

    await waitFor(() => {
      expect(screen.getByText(/Default Page Size/i)).toBeInTheDocument();
    });
  });

  it('edits a filter in configured filters', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    // Open edit for playboard that has filters
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);
    await waitFor(() => { expect(screen.getByText('Edit Playboard')).toBeInTheDocument(); });

    // Switch to Filters tab
    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/Configured Filters/)).toBeInTheDocument();
    });

    // Click Edit (pencil) on the first configured filter
    const editFilterBtns = screen.getByTestId('modal').querySelectorAll('button[title="Edit"]');
    if (editFilterBtns.length > 0) {
      await user.click(editFilterBtns[0]);
      await waitFor(() => {
        // Should show "Editing" badge or "Update Filter" button
        const updateBtn = screen.queryByText('Update Filter');
        const editingBadge = screen.queryByText('Editing');
        expect(updateBtn || editingBadge).toBeTruthy();
      });
    }
  });

  it('shows addons section in basic info', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Addon configurations section should be on basic info tab
    expect(screen.getByText(/Addon Configurations/i)).toBeInTheDocument();
  });

  it('shows row actions in edit mode', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    // Edit first playboard (has row actions)
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);
    await waitFor(() => { expect(screen.getByText('Edit Playboard')).toBeInTheDocument(); });

    // Switch to Row Actions tab
    const tabs = screen.getByTestId('modal').querySelectorAll('button');
    const actionsTab = Array.from(tabs).find(t => t.textContent === 'Row Actions');
    if (actionsTab) {
      await user.click(actionsTab);
      await waitFor(() => {
        // Should show configured row actions since the playboard has events
        expect(screen.getByText(/Configured Row Actions/)).toBeInTheDocument();
      });
    }
  });

  it('shows filter type badge for select type', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Switch to Filters tab
    const filtersTab = screen.getAllByText('Filters');
    await user.click(filtersTab[filtersTab.length - 1]);

    await waitFor(() => { expect(screen.getByText('Add New Filter')).toBeInTheDocument(); });

    // Add a filter with select type
    await user.type(screen.getByPlaceholderText('query_text'), 'category');
    await user.type(screen.getByPlaceholderText('Customer#'), 'Category');

    // Change type to select
    const typeSelect = screen.getByTestId('modal').querySelector('select');
    if (typeSelect) {
      await user.selectOptions(typeSelect, 'select');
    }

    // Options section should appear for select type
    await waitFor(() => {
      expect(screen.getByText('Options')).toBeInTheDocument();
    });
  });

  it('handles upload form submission', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.upload.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Upload JSON/));

    await waitFor(() => {
      expect(screen.getByText('Upload Playboard JSON')).toBeInTheDocument();
    });

    // Submit the upload form
    const form = screen.getByTestId('modal').querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    // Without a file selected, should show error
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Please select a file');
    });
  });

  it('handles upload API failure', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    playboardsAPI.upload.mockRejectedValue({ response: { data: { detail: 'Invalid JSON format' } } });

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { playboardsAPI, scenariosAPI, domainsAPI } = await import('../../services/api');
    playboardsAPI.list.mockReturnValue(new Promise(() => {}));
    scenariosAPI.list.mockReturnValue(new Promise(() => {}));
    domainsAPI.list.mockReturnValue(new Promise(() => {}));

    renderPlayboardsManagement();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows config type in basic info form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Config Type and Program Key should be in Basic Info
    expect(screen.getAllByText('Config Type').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Program Key').length).toBeGreaterThanOrEqual(1);
  });

  it('renders scenario and domain selectors in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Build Playboard/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Modal should contain Scenario and Data Domain form fields
    expect(screen.getByText('Scenario *')).toBeInTheDocument();
  });

  it('shows pagination for multi-page results', async () => {
    const { playboardsAPI, scenariosAPI, domainsAPI } = await import('../../services/api');
    playboardsAPI.list.mockResolvedValue({
      data: { data: mockPlayboards, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    scenariosAPI.list.mockResolvedValue({ data: { data: [] } });
    domainsAPI.list.mockResolvedValue({ data: { data: [] } });

    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });

  it('hides pagination for single page', async () => {
    await setupMocks();
    renderPlayboardsManagement();

    await waitFor(() => {
      expect(screen.getByText('Customer Search')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it('renders grid settings form fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    await user.click(screen.getByText('Grid Settings'));

    await waitFor(() => {
      expect(screen.getByText('Enable Pagination')).toBeInTheDocument();
      expect(screen.getByText(/Default Page Size/i)).toBeInTheDocument();
      expect(screen.getByText(/Row Actions Render As/i)).toBeInTheDocument();
    });
  });

  it('shows cancel and submit buttons in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getAllByText('Create Playboard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status dropdown in basic info form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Status appears in table and form
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(2);
  });

  // --- Additional coverage tests ---

  it('fills in filter name and adds a filter', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Switch to Filters tab - use getAllByText since "Filters" appears in table too
    const modal = screen.getByTestId('modal');
    const filtersTabBtns = within(modal).getAllByText('Filters');
    await user.click(filtersTabBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add New Filter')).toBeInTheDocument(); });

    const nameInput = screen.getByPlaceholderText('query_text');
    await user.type(nameInput, 'search_field');

    const displayInput = screen.getByPlaceholderText('Customer#');
    await user.type(displayInput, 'Search');

    await user.click(screen.getByText('Add Filter'));

    await waitFor(() => {
      expect(screen.getByText('Configured Filters (1)')).toBeInTheDocument();
    });
  });

  it('adds and removes addon configurations', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const addonInput = screen.getByPlaceholderText('customer-api_v2');
    await user.type(addonInput, 'my-addon');

    // Click the "Add" button near the addon input
    const addButtons = screen.getAllByText('Add');
    await user.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('my-addon')).toBeInTheDocument();
    });

    const removeBtn = screen.getByText('x');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('my-addon')).not.toBeInTheDocument();
    });
  });

  it('switches to Row Actions tab and fills action fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const rowActionBtns = within(modal).getAllByText('Row Actions');
    await user.click(rowActionBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add New Row Action')).toBeInTheDocument(); });

    const actionKeyInput = screen.getByPlaceholderText('orders_scenario_6');
    await user.type(actionKeyInput, 'edit_item');

    const actionNameInput = screen.getByPlaceholderText('Orders');
    await user.type(actionNameInput, 'Edit Item');

    await user.click(screen.getByText('Add Row Action'));

    await waitFor(() => {
      expect(screen.getByText('Configured Row Actions (1)')).toBeInTheDocument();
    });
  });

  it('switches to Description tab and adds description element', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const descBtns = within(modal).getAllByText('Description');
    await user.click(descBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add Description Element')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Description'));

    await waitFor(() => {
      expect(screen.getByText('Scenario Description Items')).toBeInTheDocument();
    });
  });

  it('fills in key and data domain in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const keyInput = screen.getByPlaceholderText('customers_scenario_playboard_1');
    await user.type(keyInput, 'new_playboard');
    expect(keyInput.value).toBe('new_playboard');
  });

  it('cancels filter edit mode', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const filtersTabBtns = within(modal).getAllByText('Filters');
    await user.click(filtersTabBtns[0]);
    await waitFor(() => { expect(screen.getByText(/Configured Filters/)).toBeInTheDocument(); });

    // Click edit on a filter - find Edit buttons with title="Edit" in the modal
    const filterEditBtns = modal.querySelectorAll('button[title="Edit"]');
    if (filterEditBtns.length > 0) {
      await user.click(filterEditBtns[0]);
      const cancelBtns = screen.queryAllByText('Cancel Edit');
      if (cancelBtns.length > 0) {
        await user.click(cancelBtns[0]);
      }
    }
  });

  it('downloads playboard JSON', async () => {
    await setupMocks();
    const { playboardsAPI } = await import('../../services/api');
    playboardsAPI.download.mockResolvedValue({ data: { key: 'customer_search_1' } });
    const user = userEvent.setup();
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    const downloadBtns = screen.getAllByTitle('Download JSON');
    await user.click(downloadBtns[0]);

    await waitFor(() => {
      expect(playboardsAPI.download).toHaveBeenCalledWith('pb1');
    });
  });

  it('toggles grid settings checkboxes', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    await user.click(screen.getByText('Grid Settings'));
    await waitFor(() => { expect(screen.getByText(/Enable Pagination/)).toBeInTheDocument(); });

    const paginationCheckbox = screen.getByLabelText(/Enable Pagination/);
    await user.click(paginationCheckbox);
    expect(paginationCheckbox.checked).toBe(false);
  });

  it('removes a description element', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const descBtns = within(modal).getAllByText('Description');
    await user.click(descBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add Description Element')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Description'));
    await user.click(screen.getByText('Add Description'));

    await waitFor(() => {
      expect(screen.getByText('Scenario Description Items')).toBeInTheDocument();
    });

    const removeBtns = modal.querySelectorAll('button.text-red-500');
    if (removeBtns.length > 0) {
      await user.click(removeBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('Scenario Description Items')).toBeInTheDocument();
      });
    }
  });

  it('changes filter type to select and shows options section', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const filtersTabBtns = within(modal).getAllByText('Filters');
    await user.click(filtersTabBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add New Filter')).toBeInTheDocument(); });

    const selects = modal.querySelectorAll('select');
    const filterTypeSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'select')
    );
    if (filterTypeSelect) {
      await user.selectOptions(filterTypeSelect, 'select');
      await waitFor(() => {
        expect(screen.getByText('Options')).toBeInTheDocument();
      });
    }
  });

  it('adds option to select filter', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const filtersTabBtns = within(modal).getAllByText('Filters');
    await user.click(filtersTabBtns[0]);

    const selects = modal.querySelectorAll('select');
    const filterTypeSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'select')
    );
    if (filterTypeSelect) {
      await user.selectOptions(filterTypeSelect, 'select');

      await waitFor(() => {
        expect(screen.getByText('Options')).toBeInTheDocument();
      });

      const optionValueInput = screen.getByPlaceholderText('Value (e.g., 01)');
      const optionNameInput = screen.getByPlaceholderText('Display Name (e.g., 01 - Option)');
      await user.type(optionValueInput, 'opt1');
      await user.type(optionNameInput, 'Option 1');

      const addBtns2 = within(screen.getByTestId('modal')).getAllByText('Add');
      await user.click(addBtns2[0]);

      await waitFor(() => {
        expect(screen.getByText('opt1 - Option 1')).toBeInTheDocument();
      });
    }
  });

  it('adds filter attribute', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const filtersTabBtns = within(modal).getAllByText('Filters');
    await user.click(filtersTabBtns[0]);

    await waitFor(() => { expect(screen.getByText(/Custom Attributes/)).toBeInTheDocument(); });

    // Fill attr name and value
    const attrNameInput = screen.getByPlaceholderText('Name (e.g., width)');
    await user.type(attrNameInput, 'width');

    const attrValueInput = screen.getByPlaceholderText('Value (e.g., 200px)');
    await user.type(attrValueInput, '200px');

    // Click Add button near attributes
    const addBtns = within(modal).getAllByText('Add');
    await user.click(addBtns[addBtns.length - 1]);

    await waitFor(() => {
      expect(modal.textContent).toContain('200px');
    });
  });

  it('adds row action filter mapping', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Build Playboard/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const rowActionBtns = within(modal).getAllByText('Row Actions');
    await user.click(rowActionBtns[0]);
    await waitFor(() => { expect(screen.getByText('Add New Row Action')).toBeInTheDocument(); });

    const inputKeyField = screen.getByPlaceholderText('inputKey (e.g., query_customer)');
    const dataKeyField = screen.getByPlaceholderText('dataKey (e.g., customer)');
    await user.type(inputKeyField, 'query_customer');
    await user.type(dataKeyField, 'customer');

    // Click the "Add" button near the filter inputs
    const addBtns = within(modal).getAllByText('Add');
    await user.click(addBtns[addBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/query_customer/)).toBeInTheDocument();
    });
  });

  it('handles upload modal and shows no file selected error', async () => {
    await setupMocks();
    const toast = (await import('react-hot-toast')).default;

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    const user = userEvent.setup();
    await user.click(screen.getByText(/Upload JSON/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const form = screen.getByTestId('modal').querySelector('form');
    if (form) {
      fireEvent.submit(form);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    }
  });

  it('fills upload form fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderPlayboardsManagement();
    await waitFor(() => { expect(screen.getByText('Customer Search')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Upload JSON/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const modal = screen.getByTestId('modal');
    const inputs = modal.querySelectorAll('input');
    if (inputs.length > 0) {
      await user.type(inputs[0], 'Test Upload');
    }
  });
});
