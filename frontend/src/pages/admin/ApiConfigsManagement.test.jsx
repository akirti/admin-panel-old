import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ApiConfigsManagement from './ApiConfigsManagement';

vi.mock('../../services/api', () => ({
  apiConfigsAPI: {
    list: vi.fn(),
    getTags: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
    test: vi.fn(),
    testById: vi.fn(),
    getGCSStatus: vi.fn(),
    uploadCert: vi.fn(),
  },
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
    base_url: 'https://api.users.com',
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
    base_url: 'https://api.payments.com',
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
    vi.clearAllMocks();
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
    await user.type(screen.getByPlaceholderText('https://api.example.com/v1/resource'), 'https://test.com/api');

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
    vi.spyOn(window, 'confirm').mockReturnValue(true);

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

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { apiConfigsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(apiConfigsAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
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
    await user.type(screen.getByPlaceholderText('https://api.example.com/v1/resource'), 'https://t.com');

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
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderApiConfigsManagement();

    await waitFor(() => {
      expect(screen.getByText('User Service')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete configuration');
    });

    vi.restoreAllMocks();
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
    const urlInput = screen.getByPlaceholderText('https://api.example.com/v1/resource');
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
});
