import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1ColumnFilterDropdown from './v1_ColumnFilterDropdown';

describe('V1ColumnFilterDropdown', () => {
  const defaultProps = {
    options: ['Active', 'Inactive', 'Pending'],
    selectedOptions: [],
    onChange: jest.fn(),
    columnLabel: 'Status',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter button with aria-label', () => {
    render(<V1ColumnFilterDropdown {...defaultProps} />);
    expect(screen.getByLabelText('Filter Status')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<V1ColumnFilterDropdown {...defaultProps} />);

    await user.click(screen.getByLabelText('Filter Status'));

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Apply and Clear buttons', async () => {
    const user = userEvent.setup();
    render(<V1ColumnFilterDropdown {...defaultProps} />);

    await user.click(screen.getByLabelText('Filter Status'));

    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('allows selecting options and applying', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1ColumnFilterDropdown {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByLabelText('Filter Status'));
    await user.click(screen.getByLabelText('Active'));
    await user.click(screen.getByText('Apply'));

    expect(onChange).toHaveBeenCalledWith(['Active']);
  });

  it('clears all selections', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <V1ColumnFilterDropdown
        {...defaultProps}
        selectedOptions={['Active']}
        onChange={onChange}
      />
    );

    await user.click(screen.getByLabelText('Filter Status'));
    await user.click(screen.getByText('Clear'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows "No values" when options is empty', async () => {
    const user = userEvent.setup();
    render(<V1ColumnFilterDropdown {...defaultProps} options={[]} />);

    await user.click(screen.getByLabelText('Filter Status'));
    expect(screen.getByText('No values')).toBeInTheDocument();
  });

  it('highlights filter button when active filter exists', () => {
    render(
      <V1ColumnFilterDropdown
        {...defaultProps}
        selectedOptions={['Active']}
      />
    );
    expect(screen.getByLabelText('Filter Status')).toHaveClass('text-blue-600');
  });

  it('shows default color when no active filter', () => {
    render(<V1ColumnFilterDropdown {...defaultProps} />);
    expect(screen.getByLabelText('Filter Status')).toHaveClass('text-content-muted');
  });
});
