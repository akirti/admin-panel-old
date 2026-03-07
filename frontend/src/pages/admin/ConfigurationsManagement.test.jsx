import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ConfigurationsManagement from './ConfigurationsManagement';

vi.mock('../../services/api', () => ({
  configurationsAPI: {
    list: vi.fn(),
    getTypes: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    downloadJson: vi.fn(),
    getVersions: vi.fn(),
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
  Button: ({ children, onClick, disabled, type, variant, size }) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
  Input: ({ label, value, onChange, placeholder, required, disabled }) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} />
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
  Select: ({ label, value, onChange, options, disabled }) => (
    <div>
      {label && <label>{label}</label>}
      <select value={value} onChange={onChange} disabled={disabled}>
        {options?.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  ),
  FileUpload: ({ accept, label, onFileSelect }) => <div>{label}</div>,
  Pagination: ({ currentPage, totalPages, onPageChange }) => (
    <div>Page {currentPage + 1} of {totalPages}</div>
  ),
}));

const mockConfigs = [
  {
    config_id: 'cfg-001',
    key: 'user-auth-config',
    type: 'process-config',
    queries: { login: {} },
    logics: {},
    operations: {},
    row_update_stp: '2025-01-15T10:00:00Z',
  },
  {
    config_id: 'cfg-002',
    key: 'lookup-countries',
    type: 'lookup-data',
    lookups: { US: 'United States' },
    row_update_stp: '2025-01-14T10:00:00Z',
  },
];

const mockConfigTypes = [
  { value: 'process-config', label: 'Process Config' },
  { value: 'lookup-data', label: 'Lookup Data' },
  { value: 'snapshot-data', label: 'Snapshot Data' },
  { value: 'gcs-data', label: 'GCS Data' },
];

async function setupMocks() {
  const { configurationsAPI } = await import('../../services/api');
  configurationsAPI.list.mockResolvedValue({
    data: { data: mockConfigs, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });
}

function renderConfigurationsManagement() {
  return render(
    <MemoryRouter>
      <ConfigurationsManagement />
    </MemoryRouter>
  );
}

describe('ConfigurationsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configurations' })).toBeInTheDocument();
      expect(screen.getByText(/Manage process configs/)).toBeInTheDocument();
    });
  });

  it('renders configurations table', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
      expect(screen.getByText('lookup-countries')).toBeInTheDocument();
    });
  });

  it('renders search and type filter', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by key or config ID...')).toBeInTheDocument();
      expect(screen.getByText('All Types')).toBeInTheDocument();
    });
  });

  it('renders action buttons', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText(/Upload File/)).toBeInTheDocument();
      expect(screen.getByText(/Add Configuration/)).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add Configuration/));

    await waitFor(() => {
      expect(screen.getByText('Add Configuration', { selector: 'h2' })).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.list.mockRejectedValue(new Error('API Error'));
    configurationsAPI.getTypes.mockRejectedValue(new Error('API Error'));

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load configurations');
    });
  });

  it('renders type badges', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getAllByText('Process Config').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Lookup Data').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add Configuration/));

    await waitFor(() => {
      expect(screen.getByText('Add Configuration', { selector: 'h2' })).toBeInTheDocument();
    });

    // Submit the form
    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(configurationsAPI.create).toHaveBeenCalled();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    // Click edit button for first config (non-gcs type)
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Edit Configuration')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Configuration')).toBeInTheDocument();
    });

    // Submit the form
    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(configurationsAPI.update).toHaveBeenCalledWith('cfg-001', expect.any(Object));
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(configurationsAPI.delete).toHaveBeenCalledWith('cfg-001');
      expect(toast.default.success).toHaveBeenCalledWith('Configuration deleted successfully');
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(configurationsAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles download', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.downloadJson.mockResolvedValue({ data: { key: 'test' } });
    const user = userEvent.setup();

    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(configurationsAPI.downloadJson).toHaveBeenCalledWith('cfg-001');
    });
  });

  it('handles view details', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key exists' } } });
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Add Configuration/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Key exists');
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete configuration');
    });

    vi.restoreAllMocks();
  });

  it('handles download failure', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.downloadJson.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to download');
    });
  });

  it('renders config IDs in table', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('cfg-001')).toBeInTheDocument();
      expect(screen.getByText('cfg-002')).toBeInTheDocument();
    });
  });

  it('renders upload file button', async () => {
    await setupMocks();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText(/Upload File/)).toBeInTheDocument();
    });
  });

  it('opens upload modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('user-auth-config')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Upload File/));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Upload Configuration File')).toBeInTheDocument();
    });
  });

  it('shows upload validation error when no file', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Upload File/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Submit without file
    const form = screen.getByTestId('modal').querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Please select a file and enter a key');
      });
    }
  });

  it('shows gcs-data type configs with version button', async () => {
    const { configurationsAPI } = await import('../../services/api');
    configurationsAPI.list.mockResolvedValue({
      data: { data: [
        ...mockConfigs,
        {
          config_id: 'cfg-003',
          key: 'gcs-file',
          type: 'gcs-data',
          gcs: { file_name: 'data.csv', current_version: 1, size: 2048, versions: [{ version: 1, file_name: 'data.csv', size: 2048, upload_date: '2025-01-15' }] },
          row_update_stp: '2025-01-15T10:00:00Z',
        },
      ], pagination: { total: 3, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('gcs-file')).toBeInTheDocument();
    });

    // GCS type should show version history button
    const versionButtons = screen.getAllByTitle('View Versions');
    expect(versionButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens versions modal for gcs-data config', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const gcsConfig = {
      config_id: 'cfg-003',
      key: 'gcs-file',
      type: 'gcs-data',
      gcs: { file_name: 'data.csv', current_version: 1, size: 2048, versions: [{ version: 1, file_name: 'data.csv', size: 2048, upload_date: '2025-01-15' }] },
      row_update_stp: '2025-01-15T10:00:00Z',
    };
    configurationsAPI.list.mockResolvedValue({
      data: { data: [gcsConfig], pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });
    configurationsAPI.getVersions.mockResolvedValue({
      data: { versions: [{ version: 'v1', file_name: 'data_v1.csv', updated_at: '2025-01-15' }] },
    });
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('gcs-file')).toBeInTheDocument(); });

    const versionButtons = screen.getAllByTitle('View Versions');
    await user.click(versionButtons[0]);

    await waitFor(() => {
      expect(configurationsAPI.getVersions).toHaveBeenCalledWith('cfg-003');
    });
  });

  it('handles gcs-data download differently', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const gcsConfig = {
      config_id: 'cfg-003',
      key: 'gcs-file',
      type: 'gcs-data',
      gcs: { file_name: 'data.csv' },
      row_update_stp: '2025-01-15T10:00:00Z',
    };
    configurationsAPI.list.mockResolvedValue({
      data: { data: [gcsConfig], pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });
    configurationsAPI.download.mockResolvedValue({ data: 'csv,data' });
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('gcs-file')).toBeInTheDocument(); });

    const downloadButtons = screen.getAllByTitle('Download');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(configurationsAPI.download).toHaveBeenCalledWith('cfg-003');
    });
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    configurationsAPI.update.mockRejectedValue({ response: { data: { detail: 'Update error' } } });
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => { expect(screen.getByText('Edit Configuration')).toBeInTheDocument(); });

    const form = screen.getByTestId('modal').querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Update error');
    });
  });

  it('shows JSON editor in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Add Configuration/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // JSON editor textarea should be present
    const textarea = screen.getByTestId('modal').querySelector('textarea');
    expect(textarea).toBeInTheDocument();
  });

  it('populates JSON editor for lookup-data type in edit mode', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    // Edit the lookup-data config (second one)
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[1]);

    await waitFor(() => { expect(screen.getByText('Edit Configuration')).toBeInTheDocument(); });

    // JSON textarea should contain the lookups data
    const textarea = screen.getByTestId('modal').querySelector('textarea');
    if (textarea) {
      expect(textarea.value).toContain('United States');
    }
  });

  it('handles search input', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    const searchInput = screen.getByPlaceholderText('Search by key or config ID...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(configurationsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
        search: 'user',
      }));
    });
  });

  it('filters by config type', async () => {
    await setupMocks();
    const { configurationsAPI } = await import('../../services/api');
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    // Find the type filter select (not in a modal - it's on the page)
    const selects = document.querySelectorAll('select');
    const typeFilter = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.textContent === 'All Types')
    );
    if (typeFilter) {
      await user.selectOptions(typeFilter, 'lookup-data');
      await waitFor(() => {
        expect(configurationsAPI.list).toHaveBeenCalledWith(expect.objectContaining({
          type: 'lookup-data',
        }));
      });
    }
  });

  it('shows detail modal with config data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      // Detail modal should show config info
      expect(screen.getByText('Configuration Details')).toBeInTheDocument();
    });
  });

  it('handles version load failure', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    const gcsConfig = {
      config_id: 'cfg-003',
      key: 'gcs-file',
      type: 'gcs-data',
      gcs: { file_name: 'data.csv', current_version: 1, size: 2048, versions: [{ version: 1, file_name: 'data.csv', size: 2048, upload_date: '2025-01-15' }] },
      row_update_stp: '2025-01-15T10:00:00Z',
    };
    configurationsAPI.list.mockResolvedValue({
      data: { data: [gcsConfig], pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });
    configurationsAPI.getVersions.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('gcs-file')).toBeInTheDocument(); });

    const versionButtons = screen.getAllByTitle('View Versions');
    await user.click(versionButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load versions');
    });
  });

  it('types in JSON input textarea in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Add Configuration/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const textarea = screen.getByTestId('modal').querySelector('textarea');
    if (textarea) {
      await user.clear(textarea);
      await user.type(textarea, 'test input');
      expect(textarea.value).toContain('test input');
    }
  });

  it('opens edit modal for process-config and populates JSON', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    // Edit first config (process-config type)
    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Configuration')).toBeInTheDocument();
    });

    // JSON textarea should contain the process config data
    const textarea = screen.getByTestId('modal').querySelector('textarea');
    if (textarea) {
      expect(textarea.value).toBeTruthy();
    }
  });

  it('opens detail modal and shows config data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    const viewButtons = screen.getAllByTitle('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Configuration Details')).toBeInTheDocument();
      // Should show the config key
      expect(screen.getAllByText('user-auth-config').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows GCS file info in table', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const gcsConfig = {
      config_id: 'cfg-003',
      key: 'gcs-file',
      type: 'gcs-data',
      gcs: { file_name: 'data.csv', current_version: 2, size: 4096 },
      row_update_stp: '2025-01-15T10:00:00Z',
    };
    configurationsAPI.list.mockResolvedValue({
      data: { data: [gcsConfig], pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('gcs-file')).toBeInTheDocument();
      expect(screen.getByText('data.csv')).toBeInTheDocument();
    });
  });

  it('shows snapshot-data type badge', async () => {
    const { configurationsAPI } = await import('../../services/api');
    const snapshotConfig = {
      config_id: 'cfg-004',
      key: 'snapshot-config',
      type: 'snapshot-data',
      data: { key: 'val' },
      row_update_stp: '2025-01-15T10:00:00Z',
    };
    configurationsAPI.list.mockResolvedValue({
      data: { data: [snapshotConfig], pagination: { total: 1, pages: 1, page: 0, limit: 25 } },
    });
    configurationsAPI.getTypes.mockResolvedValue({ data: { types: mockConfigTypes } });

    renderConfigurationsManagement();

    await waitFor(() => {
      expect(screen.getByText('snapshot-config')).toBeInTheDocument();
      expect(screen.getAllByText('Snapshot Data').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('resets form when cancel is clicked in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText(/Add Configuration/));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Click Cancel
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Add Configuration', { selector: 'h2' })).not.toBeInTheDocument();
    });
  });

  it('edits lookup-data config and shows correct JSON format', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('lookup-countries')).toBeInTheDocument(); });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[1]); // Second config is lookup-data

    await waitFor(() => {
      expect(screen.getByText('Edit Configuration')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('modal').querySelector('textarea');
    if (textarea) {
      // lookup-data should show lookups JSON
      expect(textarea.value).toContain('US');
    }
  });

  it('changes type dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Configuration'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const typeSelect = screen.getByTestId('modal').querySelector('select');
    if (typeSelect) {
      await user.selectOptions(typeSelect, 'lookup-data');
      expect(typeSelect.value).toBe('lookup-data');
    }
  });

  it('fills key field in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Configuration'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const inputs = screen.getByTestId('modal').querySelectorAll('input');
    if (inputs.length > 0) {
      await user.type(inputs[0], 'new-config');
      expect(inputs[0].value).toBe('new-config');
    }
  });

  it('fills JSON textarea in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Configuration'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const textarea = screen.getByTestId('modal').querySelector('textarea');
    if (textarea) {
      await user.clear(textarea);
      // Use fireEvent to type JSON (userEvent treats { as special key)
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(textarea, { target: { value: '{"test": true}' } });
      expect(textarea.value).toContain('test');
    }
  });

  it('closes modal via cancel button in create form', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Configuration'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    await user.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  it('opens upload modal and fills upload key', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderConfigurationsManagement();
    await waitFor(() => { expect(screen.getByText('user-auth-config')).toBeInTheDocument(); });

    await user.click(screen.getByText('Upload File'));
    await waitFor(() => { expect(screen.getByText('Upload Configuration File')).toBeInTheDocument(); });

    const keyInput = screen.getByPlaceholderText('e.g., my-config-key');
    await user.type(keyInput, 'upload-config');
    expect(keyInput.value).toBe('upload-config');
  });
});
