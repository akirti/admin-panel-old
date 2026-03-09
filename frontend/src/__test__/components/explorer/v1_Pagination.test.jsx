import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1Pagination from '../../../components/explorer/v1_Pagination';

describe('V1Pagination', () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    pageSize: 10,
    totalRecords: 50,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page info', () => {
    render(<V1Pagination {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // current page
    expect(screen.getByText('5')).toBeInTheDocument(); // total pages
  });

  it('displays total records', () => {
    render(<V1Pagination {...defaultProps} />);
    expect(screen.getByText('50 total records')).toBeInTheDocument();
  });

  it('disables prev button on first page', () => {
    render(<V1Pagination {...defaultProps} page={1} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<V1Pagination {...defaultProps} page={5} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('enables both buttons on middle page', () => {
    render(<V1Pagination {...defaultProps} page={3} />);
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('calls onPageChange with prev page', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<V1Pagination {...defaultProps} page={3} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with next page', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<V1Pagination {...defaultProps} page={3} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('shows rows per page label', () => {
    render(<V1Pagination {...defaultProps} />);
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });

  it('shows current page size in dropdown button', () => {
    render(<V1Pagination {...defaultProps} pageSize={25} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('opens page size dropdown and selects new size', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = jest.fn();
    render(<V1Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    // Click the page size dropdown button
    await user.click(screen.getByText('10'));

    // Select 50
    await user.click(screen.getByText('50'));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('shows download button when onDownloadClick provided', () => {
    render(<V1Pagination {...defaultProps} onDownloadClick={jest.fn()} />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('does not show download button without onDownloadClick', () => {
    render(<V1Pagination {...defaultProps} />);
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('calls onDownloadClick when download clicked', async () => {
    const user = userEvent.setup();
    const onDownloadClick = jest.fn();
    render(<V1Pagination {...defaultProps} onDownloadClick={onDownloadClick} />);

    await user.click(screen.getByText('Download'));
    expect(onDownloadClick).toHaveBeenCalledWith(true);
  });

  it('does not show total records when undefined', () => {
    render(<V1Pagination {...defaultProps} totalRecords={undefined} />);
    expect(screen.queryByText(/total records/)).not.toBeInTheDocument();
  });
});
