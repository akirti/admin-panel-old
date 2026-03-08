import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportButton from './ExportButton';

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import toast from 'react-hot-toast';

describe('ExportButton', () => {
  let mockExportFn;
  let mockClick;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExportFn = jest.fn();
    mockClick = jest.fn();

    // Mock URL APIs
    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/test');
    global.URL.revokeObjectURL = jest.fn();

    // Mock anchor click to avoid jsdom navigation error
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockClick);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders with default label', () => {
    render(<ExportButton exportFn={mockExportFn} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<ExportButton exportFn={mockExportFn} label="Download CSV" />);
    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument();
  });

  it('calls exportFn with filters on click', async () => {
    const user = userEvent.setup();
    const filters = { status: 'active' };
    mockExportFn.mockResolvedValue({
      data: 'col1,col2\nval1,val2',
      headers: {},
    });

    render(<ExportButton exportFn={mockExportFn} filters={filters} />);
    await user.click(screen.getByRole('button'));

    expect(mockExportFn).toHaveBeenCalledWith(filters);
  });

  it('shows loading state during export', async () => {
    const user = userEvent.setup();
    let resolveExport;
    mockExportFn.mockReturnValue(new Promise((resolve) => { resolveExport = resolve; }));

    render(<ExportButton exportFn={mockExportFn} />);
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Exporting...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    resolveExport({ data: 'data', headers: {} });
    await waitFor(() => {
      expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
    });
  });

  it('shows success toast after successful export', async () => {
    const user = userEvent.setup();
    mockExportFn.mockResolvedValue({ data: 'data', headers: {} });

    render(<ExportButton exportFn={mockExportFn} format="csv" />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Data exported successfully as CSV');
    });
  });

  it('shows error toast on export failure', async () => {
    const user = userEvent.setup();
    const error = new Error('Export failed');
    error.response = { data: { detail: 'Server error' } };
    mockExportFn.mockRejectedValue(error);

    render(<ExportButton exportFn={mockExportFn} />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows generic error when no detail provided', async () => {
    const user = userEvent.setup();
    mockExportFn.mockRejectedValue(new Error('Network error'));

    render(<ExportButton exportFn={mockExportFn} />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to export data');
    });
  });

  it('creates blob and triggers download on success', async () => {
    const user = userEvent.setup();
    mockExportFn.mockResolvedValue({
      data: 'col1,col2',
      headers: { 'content-disposition': 'attachment; filename="report.csv"' },
    });

    render(<ExportButton exportFn={mockExportFn} />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  it('re-enables button after export completes', async () => {
    const user = userEvent.setup();
    mockExportFn.mockResolvedValue({ data: 'data', headers: {} });

    render(<ExportButton exportFn={mockExportFn} />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('applies custom className', () => {
    render(<ExportButton exportFn={mockExportFn} className="custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
});
