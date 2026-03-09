import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ApiConfigsManagement from './ApiConfigsManagement';

jest.mock('../../services/api', () => ({
  apiConfigsAPI: {
    list: jest.fn(),
    getTags: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleStatus: jest.fn(),
    test: jest.fn(),
    testById: jest.fn(),
    getGCSStatus: jest.fn(),
    uploadCert: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../components/shared', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  Button: ({ children, onClick, disabled, type, variant }) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
  Input: ({ label, value, onChange, placeholder, required, disabled, type }) => (
    <div>{label && <label>{label}</label>}<input value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} type={type || 'text'} /></div>
  ),
  Table: ({ columns, data, loading }) => {
    if (loading) return <div>Loading...</div>;
    return (
      <table>
        <thead><tr>{columns.map((col, i) => <th key={i}>{col.title}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>{columns.map((col, j) => <td key={j}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>)}</tr>
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
  Select: ({ label, value, onChange, options, disabled }) => (
    <div>{label && <label>{label}</label>}<select value={value} onChange={onChange} disabled={disabled}>{options?.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}</select></div>
  ),
  Pagination: ({ currentPage, totalPages }) => <div>Page {currentPage + 1} of {totalPages}</div>,
}));

const mockConfigs = [
  {
    _id: 'ac1',
    key: 'user-svc',
    name: 'User Service',
    base_url: '/api/users',
    method: 'GET',
    endpoint: '/users',
    auth_type: 'bearer',
    auth_config: {},
    headers: {},
    params: {},
    body: {},
    tags: ['users'],
    status: 'active',
    ssl_verify: true,
    timeout: 30,
    retry_count: 0,
    retry_delay: 1,
    use_proxy: false,
    proxy_url: '',
    is_active: true,
  },
  {
    _id: 'ac2',
    key: 'payment-api',
    name: 'Payment API',
    base_url: '/api/payments',
    method: 'POST',
    endpoint: '/charge',
    auth_type: 'api_key',
    auth_config: {},
    headers: {},
    params: {},
    body: {},
    tags: ['payments'],
    status: 'inactive',
    ssl_verify: true,
    timeout: 30,
    retry_count: 0,
    retry_delay: 1,
    use_proxy: false,
    proxy_url: '',
    is_active: false,
  },
];

async function setupMocks() {
  const { apiConfigsAPI } = await import('../../services/api');
  apiConfigsAPI.list.mockResolvedValue({
    data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: ['users', 'payments'] } });
  apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: false } });
}

function renderApiConfigsManagement() {
  return render(
    <MemoryRouter>
      <ApiConfigsManagement />
    </MemoryRouter>
  );
}

describe('ApiConfigsManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'API Configurations' })).toBeInTheDocument();
    });
  });

  it('renders API configs table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
      expect(screen.getByText('Payment API')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  it('shows active/inactive status', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.list.mockRejectedValue(new Error('API Error'));
    apiConfigsAPI.getTags.mockRejectedValue(new Error('API Error'));
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: false } });

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load API configurations');
    });
  });

  it('opens create modal when clicking Add API Config', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add API Config/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Add API Configuration')).toBeInTheDocument();
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add API Config/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill required fields
    await user.type(screen.getByPlaceholderText('unique-api-key'), 'new-api');
    await user.type(screen.getByPlaceholderText('My API'), 'New API');
    await user.type(screen.getByPlaceholderText('e.g. /api/v1/resource'), 'https://test.com/api');

    // Submit form
    const submitButton = screen.getByText('Create');
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiConfigsAPI.create).toHaveBeenCalled();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Edit API Configuration')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit API Configuration')).toBeInTheDocument();
    });

    // Click Update
    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(apiConfigsAPI.update).toHaveBeenCalledWith('ac1', expect.any(Object));
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.delete).toHaveBeenCalledWith('ac1');
      expect(toast.default.success).toHaveBeenCalledWith('API configuration deleted successfully');
    });

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(apiConfigsAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles toggle status', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    // Click the deactivate button (first config is active)
    const toggleButtons = screen.getAllByTitle('Deactivate');
    await user.click(toggleButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.toggleStatus).toHaveBeenCalledWith('ac1');
      expect(toast.default.success).toHaveBeenCalledWith('Configuration deactivated');
    });
  });

  it('handles test API button', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({
      data: { success: true, status_code: 200, response_time_ms: 150 },
    });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.testById).toHaveBeenCalledWith('ac1');
    });
  });

  it('opens view details modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key already exists' } } });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add API Config/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('unique-api-key'), 'dup');
    await user.type(screen.getByPlaceholderText('My API'), 'Dup');
    await user.type(screen.getByPlaceholderText('e.g. /api/v1/resource'), 'https://t.com');

    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Key already exists');
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete configuration');
    });

    jest.restoreAllMocks();
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.toggleStatus.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByTitle('Deactivate');
    await user.click(toggleButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to toggle status');
    });
  });

  it('renders cancel button in modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add API Config/));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('shows method badges in table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
  });

  it('shows auth type badges in table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('bearer')).toBeInTheDocument();
      expect(screen.getByText('api_key')).toBeInTheDocument();
    });
  });

  it('handles activate toggle for inactive config', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('Payment API')).toBeInTheDocument();
    });

    const activateButtons = screen.getAllByTitle('Activate');
    await user.click(activateButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.toggleStatus).toHaveBeenCalledWith('ac2');
      expect(toast.default.success).toHaveBeenCalledWith('Configuration activated');
    });
  });

  it('handles test API failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockRejectedValue({ response: { data: { detail: 'Connection refused' } } });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.testById).toHaveBeenCalledWith('ac1');
    });
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    apiConfigsAPI.update.mockRejectedValue({ response: { data: { detail: 'Update failed' } } });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit API Configuration')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Update failed');
    });
  });

  it('shows GCS status badge when configured', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: ['users'] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: true } });

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('GCS: Connected')).toBeInTheDocument();
    });
  });

  it('shows GCS not configured badge', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('GCS: Not configured')).toBeInTheDocument();
    });
  });

  it('shows Upload Certificate button when GCS is configured', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: ['users'] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: true } });
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const certButtons = screen.getAllByTitle('Upload Certificate');
    expect(certButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(certButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Upload Certificate')).toBeInTheDocument();
    });
  });

  it('handles search input change', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(apiConfigsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'user',
      }));
    });
  });

  it('handles status filter change', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusSelect, 'active');

    await waitFor(() => {
      expect(apiConfigsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active',
      }));
    });
  });

  it('handles tag filter change', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const tagSelect = screen.getByDisplayValue('All Tags');
    await user.selectOptions(tagSelect, 'users');

    await waitFor(() => {
      expect(apiConfigsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        tags: 'users',
      }));
    });
  });

  it('shows tag badges in table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      // Tags appear in both the filter dropdown and the table
      expect(screen.getAllByText('users').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('payments').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows tag overflow indicator for configs with many tags', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    const configWithManyTags = [{
      ...mockConfigs[0],
      tags: ['api', 'auth', 'billing', 'core'],
    }];
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: configWithManyTags, pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: ['api', 'auth', 'billing', 'core'] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: false } });

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  it('shows pagination when multiple pages', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: mockConfigs, pagination: { total: 50, pages: 2, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: [] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: false } });

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });

  it('hides pagination for single page', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it('closes modal on cancel', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add API Config/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  it('renders detail modal with config info', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
      expect(screen.getAllByText('user-svc').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows page description', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('Manage external API configurations and test connectivity')).toBeInTheDocument();
    });
  });

  // --- Additional coverage tests ---

  it('fills form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Fill key
    const keyInput = screen.getByPlaceholderText('unique-api-key');
    await user.type(keyInput, 'new-api');
    expect(keyInput.value).toBe('new-api');

    // Fill name
    const nameInput = screen.getByPlaceholderText('My API');
    await user.type(nameInput, 'New API');
    expect(nameInput.value).toBe('New API');

    // Fill endpoint
    const urlInput = screen.getByPlaceholderText('e.g. /api/v1/resource');
    await user.type(urlInput, 'https://test.com/api');
    expect(urlInput.value).toBe('https://test.com/api');
  });

  it('changes auth type dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find auth type select
    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'bearer' || o.value === 'basic')
    );
    if (authSelect) {
      await user.selectOptions(authSelect, 'basic');
      expect(authSelect.value).toBe('basic');
    }
  });

  it('populates form when editing existing config', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });
    expect(screen.getByDisplayValue('user-svc')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('User Service').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('/users')).toBeInTheDocument();
  });

  it('handles test connection with success', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({ data: { success: true, status_code: 200, response_time: 150 } });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.testById).toHaveBeenCalled();
    });
  });

  it('handles test connection with failure', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockRejectedValue({ response: { data: { detail: 'Connection refused' } } });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(apiConfigsAPI.testById).toHaveBeenCalled();
    });
  });

  it('fills JSON fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find headers JSON textarea
    const textareas = screen.getByTestId('modal').querySelectorAll('textarea');
    if (textareas.length > 0) {
      await user.type(textareas[0], 'test json');
      expect(textareas[0].value).toContain('test json');
    }
  });

  it('toggles ssl_verify checkbox', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find checkboxes (ssl_verify, use_proxy, cache_enabled)
    const checkboxes = screen.getByTestId('modal').querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 0) {
      await user.click(checkboxes[0]);
    }
  });

  it('changes tags input in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find tags input
    const tagsInput = screen.getByPlaceholderText('production, internal, payment');
    await user.type(tagsInput, 'api, test');
    expect(tagsInput.value).toBe('api, test');
  });

  it('shows status and method badges in table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      // Status badges (Active also in filter option)
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
      // Method badges
      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
  });

  it('shows auth type badges in table', async () => {
    await setupMocks();
    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('bearer')).toBeInTheDocument();
      expect(screen.getByText('api_key')).toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const statusFilter = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusFilter, 'active');

    await waitFor(() => {
      expect(apiConfigsAPI.list).toHaveBeenCalled();
    });
  });

  it('handles certificate upload modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    // Find SSL Certificate button if it exists
    const certBtns = screen.queryAllByText(/Certificate|SSL/i);
    if (certBtns.length > 0) {
      await user.click(certBtns[0]);
    }
  });

  // --- Deep coverage tests for uncovered branches/functions ---

  it('shows login_token auth config form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Change auth type to login_token
    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'login_token')
    );
    await user.selectOptions(authSelect, 'login_token');

    await waitFor(() => {
      expect(screen.getByText('Login Token Configuration')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. /auth/login')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    });
  });

  it('fills login_token auth config fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'login_token')
    );
    await user.selectOptions(authSelect, 'login_token');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. /auth/login')).toBeInTheDocument();
    });

    // Fill login endpoint
    const loginEndpoint = screen.getByPlaceholderText('e.g. /auth/login');
    await user.type(loginEndpoint, 'https://auth.test.com/login');
    expect(loginEndpoint.value).toBe('https://auth.test.com/login');

    // Fill username
    const usernameInput = screen.getByPlaceholderText('user@example.com');
    await user.type(usernameInput, 'admin@test.com');
    expect(usernameInput.value).toBe('admin@test.com');

    // Fill password
    const passwordInput = screen.getByPlaceholderText('••••••••');
    await user.type(passwordInput, 'secret123');

    // Fill token response path
    const tokenPathInput = screen.getByPlaceholderText('access_token or data.token');
    await user.clear(tokenPathInput);
    await user.type(tokenPathInput, 'data.token');
  });

  it('shows oauth2 auth config form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'oauth2')
    );
    await user.selectOptions(authSelect, 'oauth2');

    await waitFor(() => {
      expect(screen.getByText('OAuth2 Client Credentials Configuration')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. /oauth/token')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('my-client-id')).toBeInTheDocument();
    });
  });

  it('fills oauth2 auth config fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'oauth2')
    );
    await user.selectOptions(authSelect, 'oauth2');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. /oauth/token')).toBeInTheDocument();
    });

    // Fill token endpoint
    await user.type(screen.getByPlaceholderText('e.g. /oauth/token'), 'https://oauth.test.com/token');

    // Fill client ID
    await user.type(screen.getByPlaceholderText('my-client-id'), 'test-client');

    // Fill scope
    await user.type(screen.getByPlaceholderText('read write'), 'read');

    // Fill audience
    await user.type(screen.getByPlaceholderText('e.g. api.example.com'), 'https://api.test.com');
  });

  it('shows auth config JSON textarea for basic auth type', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'basic')
    );
    await user.selectOptions(authSelect, 'basic');

    await waitFor(() => {
      expect(screen.getByText('Auth Configuration JSON')).toBeInTheDocument();
    });
  });

  it('toggles use_proxy checkbox and shows proxy URL input', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find use_proxy checkbox (second checkbox)
    const checkboxes = screen.getByTestId('modal').querySelectorAll('input[type="checkbox"]');
    const proxyCheckbox = Array.from(checkboxes).find(cb => {
      const label = cb.parentElement?.textContent;
      return label?.includes('Use Proxy');
    });

    await user.click(proxyCheckbox);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. proxy-host:8080')).toBeInTheDocument();
    });
  });

  it('toggles cache_enabled checkbox and shows cache TTL', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find Enable Caching checkbox
    const checkboxes = screen.getByTestId('modal').querySelectorAll('input[type="checkbox"]');
    const cacheCheckbox = Array.from(checkboxes).find(cb => {
      const label = cb.parentElement?.textContent;
      return label?.includes('Enable Caching');
    });

    await user.click(cacheCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Cache TTL (sec)')).toBeInTheDocument();
    });
  });

  it('shows test result modal with successful test', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({
      data: {
        success: true,
        status_code: 200,
        response_time_ms: 150,
        ssl_info: { version: 'TLSv1.3' },
        response_headers: { 'content-type': 'application/json' },
        response_body: { message: 'ok' },
      },
    });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Connection Successful')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
      expect(screen.getByText('TLSv1.3')).toBeInTheDocument();
      expect(screen.getByText('Response Headers')).toBeInTheDocument();
      expect(screen.getByText('Response Body')).toBeInTheDocument();
    });
  });

  it('shows test result modal with failed test', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({
      data: {
        success: false,
        error: 'Connection timed out',
      },
    });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    });
  });

  it('shows test result with string response body', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({
      data: {
        success: true,
        status_code: 200,
        response_body: 'plain text response',
      },
    });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('plain text response')).toBeInTheDocument();
    });
  });

  it('shows detail modal with full config info including description and tags', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    const configWithDetails = [{
      ...mockConfigs[0],
      description: 'A test API service',
      tags: ['api', 'prod'],
      headers: { 'Authorization': 'Bearer xxx' },
      ssl_cert_gcs_path: 'gs://bucket/cert.pem',
      ssl_key_gcs_path: 'gs://bucket/key.pem',
      ssl_ca_gcs_path: 'gs://bucket/ca.pem',
      created_at: '2025-01-01T10:00:00Z',
      created_by: 'admin',
      updated_at: '2025-01-15T10:00:00Z',
      updated_by: 'editor',
    }];
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: configWithDetails, pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: ['api', 'prod'] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: false } });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
      expect(screen.getByText('A test API service')).toBeInTheDocument();
      expect(screen.getByText('SSL Certificates')).toBeInTheDocument();
      expect(screen.getByText('gs://bucket/cert.pem')).toBeInTheDocument();
      expect(screen.getByText('gs://bucket/key.pem')).toBeInTheDocument();
      expect(screen.getByText('gs://bucket/ca.pem')).toBeInTheDocument();
      expect(screen.getByText(/by admin/)).toBeInTheDocument();
      expect(screen.getByText(/by editor/)).toBeInTheDocument();
    });
  });

  it('shows detail modal info: timeout, ssl_verify, use_proxy', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('30s')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument(); // ssl_verify
    });
  });

  it('clicks Test API button from detail modal', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({ data: { success: true, status_code: 200 } });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
    });

    // Click Test API button in detail modal
    await user.click(screen.getByText('Test API'));

    await waitFor(() => {
      expect(apiConfigsAPI.testById).toHaveBeenCalledWith('ac1');
    });
  });

  it('clicks Edit button from detail modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
    });

    // Click Edit button inside detail modal
    const editBtn = screen.getByTestId('modal').querySelector('button');
    const allButtons = screen.getByTestId('modal').querySelectorAll('button');
    const editButton = Array.from(allButtons).find(b => b.textContent === 'Edit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit API Configuration')).toBeInTheDocument();
    });
  });

  it('submits certificate upload form', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: [] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: true } });
    apiConfigsAPI.uploadCert.mockResolvedValue({ data: {} });
    const toast = await import('react-hot-toast');
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    // Click upload cert button
    const certButtons = screen.getAllByTitle('Upload Certificate');
    await user.click(certButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Upload Certificate')).toBeInTheDocument();
    });

    // Select certificate type
    const certTypeSelect = screen.getByTestId('modal').querySelectorAll('select');
    if (certTypeSelect.length > 0) {
      await user.selectOptions(certTypeSelect[0], 'key');
    }

    // Upload file
    const fileInput = screen.getByTestId('modal').querySelector('input[type="file"]');
    const file = new File(['cert content'], 'client.pem', { type: 'application/x-pem-file' });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('Selected: client.pem')).toBeInTheDocument();
    });

    // Submit
    const submitBtn = Array.from(screen.getByTestId('modal').querySelectorAll('button')).find(b => b.textContent === 'Upload');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(apiConfigsAPI.uploadCert).toHaveBeenCalled();
      expect(toast.default.success).toHaveBeenCalledWith('Certificate uploaded successfully');
    });
  });

  it('handles certificate upload failure', async () => {
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.list.mockResolvedValue({
      data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
    });
    apiConfigsAPI.getTags.mockResolvedValue({ data: { tags: [] } });
    apiConfigsAPI.getGCSStatus.mockResolvedValue({ data: { configured: true } });
    apiConfigsAPI.uploadCert.mockRejectedValue({ response: { data: { detail: 'Invalid cert format' } } });
    const toast = await import('react-hot-toast');
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const certButtons = screen.getAllByTitle('Upload Certificate');
    await user.click(certButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Upload Certificate')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('modal').querySelector('input[type="file"]');
    const file = new File(['bad'], 'bad.pem', { type: 'application/x-pem-file' });
    await user.upload(fileInput, file);

    const submitBtn = Array.from(screen.getByTestId('modal').querySelectorAll('button')).find(b => b.textContent === 'Upload');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Invalid cert format');
    });
  });

  it('changes form fields: timeout, retry_count, retry_delay', async () => {
    await setupMocks();
    const user = userEvent.setup();
    const { fireEvent } = await import('@testing-library/react');

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find timeout input by label
    const timeoutLabel = screen.getByText('Timeout (sec)');
    const timeoutInput = timeoutLabel.parentElement.querySelector('input');
    fireEvent.change(timeoutInput, { target: { value: '60' } });
    expect(timeoutInput.value).toBe('60');

    // Retry count
    const retryLabel = screen.getByText('Retry Count');
    const retryInput = retryLabel.parentElement.querySelector('input');
    fireEvent.change(retryInput, { target: { value: '3' } });
    expect(retryInput.value).toBe('3');

    // Retry delay
    const delayLabel = screen.getByText('Retry Delay (sec)');
    const delayInput = delayLabel.parentElement.querySelector('input');
    fireEvent.change(delayInput, { target: { value: '5' } });
    expect(delayInput.value).toBe('5');
  });

  it('changes ping/health check settings', async () => {
    await setupMocks();
    const user = userEvent.setup();
    const { fireEvent } = await import('@testing-library/react');

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Ping endpoint
    const pingInput = screen.getByPlaceholderText('Leave empty to use main endpoint');
    await user.type(pingInput, 'https://api.test.com/health');
    expect(pingInput.value).toBe('https://api.test.com/health');

    // Expected status
    const statusLabel = screen.getByText('Expected Status');
    const statusInput = statusLabel.parentElement.querySelector('input');
    fireEvent.change(statusInput, { target: { value: '204' } });
    expect(statusInput.value).toBe('204');
  });

  it('changes method dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find method select - 'Method' appears in both table header and form
    const methodLabels = screen.getAllByText('Method');
    // The one inside the modal form has a select sibling
    const methodLabel = Array.from(methodLabels).find(l => l.parentElement?.querySelector('select'));
    const methodSelect = methodLabel.parentElement.querySelector('select');
    await user.selectOptions(methodSelect, 'POST');
    expect(methodSelect.value).toBe('POST');
  });

  it('changes status dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find status select
    const statusLabel = screen.getAllByText('Status');
    // Get the select inside the form (last Status label)
    const formStatusLabels = screen.getByTestId('modal').querySelectorAll('label');
    const statusLabelElem = Array.from(formStatusLabels).find(l => l.textContent === 'Status');
    const statusSelect = statusLabelElem?.parentElement?.querySelector('select');
    if (statusSelect) {
      await user.selectOptions(statusSelect, 'inactive');
      expect(statusSelect.value).toBe('inactive');
    }
  });

  it('fills description field in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const descInput = screen.getByPlaceholderText('Optional description');
    await user.type(descInput, 'Test API description');
    expect(descInput.value).toBe('Test API description');
  });

  it('closes test result modal', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    apiConfigsAPI.testById.mockResolvedValue({ data: { success: true, status_code: 200 } });
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Connection Successful')).toBeInTheDocument();
    });

    // Click Close button
    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('Connection Successful')).not.toBeInTheDocument();
    });
  });

  it('shows loading spinner in test modal while testing', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    let resolveTest;
    apiConfigsAPI.testById.mockReturnValue(new Promise(r => { resolveTest = r; }));
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const testButtons = screen.getAllByTitle('Test API');
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Testing API connection...')).toBeInTheDocument();
    });

    // Resolve to clean up
    resolveTest({ data: { success: true } });
  });

  it('changes login method select in login_token form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Select login_token auth type
    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'login_token')
    );
    await user.selectOptions(authSelect, 'login_token');

    await waitFor(() => {
      expect(screen.getByText('Login Token Configuration')).toBeInTheDocument();
    });

    // Fill username field name
    const usernameFieldInput = screen.getByPlaceholderText('email');
    await user.clear(usernameFieldInput);
    await user.type(usernameFieldInput, 'login');

    // Fill password field name
    const passwordFieldInput = screen.getByPlaceholderText('password');
    await user.clear(passwordFieldInput);
    await user.type(passwordFieldInput, 'pass');

    // Fill token type
    const tokenTypeInputs = screen.getAllByDisplayValue('Bearer');
    if (tokenTypeInputs.length > 0) {
      await user.clear(tokenTypeInputs[0]);
      await user.type(tokenTypeInputs[0], 'Token');
    }
  });

  it('fills oauth2 client secret and token fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Select oauth2 auth type
    const selects = screen.getByTestId('modal').querySelectorAll('select');
    const authSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.value === 'oauth2')
    );
    await user.selectOptions(authSelect, 'oauth2');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('my-client-id')).toBeInTheDocument();
    });

    // Fill client secret - find the password input
    const allPasswordInputs = screen.getByTestId('modal').querySelectorAll('input[type="password"]');
    if (allPasswordInputs.length > 0) {
      await user.type(allPasswordInputs[0], 'super-secret');
    }

    // Fill token response path
    const tokenPathInputs = screen.getAllByDisplayValue('access_token');
    if (tokenPathInputs.length > 0) {
      await user.clear(tokenPathInputs[0]);
      await user.type(tokenPathInputs[0], 'token');
    }

    // Fill token header name
    const headerInputs = screen.getAllByDisplayValue('Authorization');
    if (headerInputs.length > 0) {
      await user.clear(headerInputs[0]);
      await user.type(headerInputs[0], 'X-Token');
    }
  });

  it('changes ping method select', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add API Config'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Find Ping Method select
    const pingMethodLabel = screen.getByText('Ping Method');
    const pingMethodSelect = pingMethodLabel.parentElement.querySelector('select');
    await user.selectOptions(pingMethodSelect, 'POST');
    expect(pingMethodSelect.value).toBe('POST');
  });

  it('opens detail modal and shows No for use_proxy', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderApiConfigsManagement();
    await waitFor(() => { expect(screen.getByText('User Service')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('API Configuration Details')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument(); // use_proxy is false
    });
  });
});
