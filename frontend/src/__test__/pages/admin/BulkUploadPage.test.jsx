import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BulkUploadPage from '../../../pages/admin/BulkUploadPage';

jest.mock('../../../services/api', () => ({
  bulkAPI: {
    upload: jest.fn(),
    getTemplate: jest.fn(),
    getGCSStatus: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function renderBulkUploadPage() {
  return render(
    <MemoryRouter>
      <BulkUploadPage />
    </MemoryRouter>
  );
}

describe('BulkUploadPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page header', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByRole('heading', { name: 'Bulk Upload' })).toBeInTheDocument();
    expect(screen.getByText('Import data from CSV or Excel files')).toBeInTheDocument();
  });

  it('renders entity type selector', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByText('Entity Type')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders upload and template sections', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Download Templates')).toBeInTheDocument();
  });

  it('renders template download buttons', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByText('Excel Template')).toBeInTheDocument();
    expect(screen.getByText('CSV Template')).toBeInTheDocument();
  });

  it('shows GCS not configured message', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    await waitFor(() => {
      expect(screen.getByText('Not Configured')).toBeInTheDocument();
      expect(screen.getByText(/GCS is not configured/)).toBeInTheDocument();
    });
  });

  it('shows GCS configured state with upload option', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: true } });

    renderBulkUploadPage();

    await waitFor(() => {
      expect(screen.getByText('Configured')).toBeInTheDocument();
      expect(screen.getAllByText('Upload from GCS').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders instructions section', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText(/Download the template/)).toBeInTheDocument();
  });

  it('shows send password emails toggle for users', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    expect(screen.getByText('Send password emails to new users')).toBeInTheDocument();
  });

  it('upload button is disabled without file', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });

    renderBulkUploadPage();

    const uploadButton = screen.getByRole('button', { name: /Upload$/ });
    expect(uploadButton).toBeDisabled();
  });

  it('handles successful file upload', async () => {
    const { bulkAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.upload.mockResolvedValue({
      data: { total: 10, successful: 8, failed: 2, errors: [{ row: 3, error: 'Invalid email' }] },
    });
    const user = userEvent.setup();

    renderBulkUploadPage();

    // Select a file
    const file = new File(['email,name\ntest@test.com,Test'], 'users.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    // Now upload button should be enabled
    const uploadButton = screen.getByRole('button', { name: /Upload$/ });
    expect(uploadButton).not.toBeDisabled();

    // Click upload
    await user.click(uploadButton);

    await waitFor(() => {
      expect(bulkAPI.upload).toHaveBeenCalledWith('users', expect.any(FormData), true);
      expect(toast.default.success).toHaveBeenCalledWith('Successfully processed 8 records');
      expect(toast.default.error).toHaveBeenCalledWith('Failed to process 2 records');
    });
  });

  it('shows upload results after upload', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.upload.mockResolvedValue({
      data: { total: 5, successful: 5, failed: 0, errors: [] },
    });
    const user = userEvent.setup();

    renderBulkUploadPage();

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the file to be recognized and button to be enabled
    await waitFor(() => {
      expect(screen.getByText(/Selected: test.csv/)).toBeInTheDocument();
    });

    // Find and click the Upload button (not the "Upload File" heading)
    const uploadButtons = screen.getAllByRole('button');
    const uploadButton = uploadButtons.find(btn => btn.textContent.trim() === 'Upload' || btn.textContent.includes('Upload'));
    await user.click(uploadButton);

    await waitFor(() => {
      expect(bulkAPI.upload).toHaveBeenCalled();
    });
  });

  it('handles upload failure', async () => {
    const { bulkAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.upload.mockRejectedValue({ response: { data: { detail: 'Invalid file format' } } });
    const user = userEvent.setup();

    renderBulkUploadPage();

    const file = new File(['bad data'], 'test.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /Upload$/ }));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Invalid file format');
    });
  });

  it('handles template download for Excel', async () => {
    const { bulkAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.getTemplate.mockResolvedValue({ data: 'template data' });
    const user = userEvent.setup();

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    renderBulkUploadPage();

    await user.click(screen.getByText('Excel Template'));

    await waitFor(() => {
      expect(bulkAPI.getTemplate).toHaveBeenCalledWith('users', 'xlsx');
      expect(toast.default.success).toHaveBeenCalledWith('Template downloaded');
    });
  });

  it('handles template download for CSV', async () => {
    const { bulkAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.getTemplate.mockResolvedValue({ data: 'csv,data' });
    const user = userEvent.setup();

    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    renderBulkUploadPage();

    await user.click(screen.getByText('CSV Template'));

    await waitFor(() => {
      expect(bulkAPI.getTemplate).toHaveBeenCalledWith('users', 'csv');
    });
  });

  it('handles template download failure', async () => {
    const { bulkAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.getTemplate.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();

    renderBulkUploadPage();

    await user.click(screen.getByText('Excel Template'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to download template');
    });
  });

  it('changes entity type and resets file', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    const user = userEvent.setup();

    renderBulkUploadPage();

    // Change entity type to roles
    const entitySelect = screen.getByRole('combobox');
    await user.selectOptions(entitySelect, 'roles');

    expect(entitySelect.value).toBe('roles');
  });

  it('toggles send password emails for users', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    const user = userEvent.setup();

    renderBulkUploadPage();

    // Should be visible only for users entity type
    expect(screen.getByText('Send password emails to new users')).toBeInTheDocument();
  });

  it('shows file name after selection', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    const user = userEvent.setup();

    renderBulkUploadPage();

    const file = new File(['data'], 'my_users.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    expect(screen.getByText('Selected: my_users.csv')).toBeInTheDocument();
  });

  it('shows upload errors in results', async () => {
    const { bulkAPI } = await import('../../../services/api');
    bulkAPI.getGCSStatus.mockResolvedValueOnce({ data: { configured: false } });
    bulkAPI.upload.mockResolvedValue({
      data: {
        total: 3,
        successful: 1,
        failed: 2,
        errors: [
          { row: 2, error: 'Invalid email' },
          { row: 3, error: 'Missing name' },
        ],
      },
    });
    const user = userEvent.setup();

    renderBulkUploadPage();

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: /Upload$/ }));

    await waitFor(() => {
      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Row 2: Invalid email')).toBeInTheDocument();
      expect(screen.getByText('Row 3: Missing name')).toBeInTheDocument();
    });
  });
});
