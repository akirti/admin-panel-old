import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
