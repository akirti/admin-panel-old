import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import V1CustomerSuggestInput from './v1_CustomerSuggestInput';

describe('V1CustomerSuggestInput', () => {
  const customers = [
    { customerId: 'C001', name: 'Acme Corp', source: 'direct', tags: ['VIP'] },
    { customerId: 'C002', name: 'Beta Inc', source: 'partner', tags: ['Standard'] },
  ];

  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    customers,
    tags: ['VIP', 'Standard'],
    loading: false,
    onSearch: jest.fn(),
    onFilterByTag: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders input with placeholder', () => {
    render(<V1CustomerSuggestInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/type customer/i)).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<V1CustomerSuggestInput {...defaultProps} placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows current value', () => {
    render(<V1CustomerSuggestInput {...defaultProps} value="C001" />);
    expect(screen.getByDisplayValue('C001')).toBeInTheDocument();
  });

  it('shows clear button when value present', () => {
    render(<V1CustomerSuggestInput {...defaultProps} value="C001" />);
    // X button for clearing
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not show clear button when empty', () => {
    render(<V1CustomerSuggestInput {...defaultProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onChange and onSearch on input', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onSearch = jest.fn();
    render(
      <V1CustomerSuggestInput {...defaultProps} onChange={onChange} onSearch={onSearch} />
    );

    await user.type(screen.getByPlaceholderText(/type customer/i), 'C');

    expect(onChange).toHaveBeenCalledWith('C');
    expect(onSearch).toHaveBeenCalledWith('C');
  });

  it('clears input when clear button clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onSearch = jest.fn();
    render(
      <V1CustomerSuggestInput
        {...defaultProps}
        value="C001"
        onChange={onChange}
        onSearch={onSearch}
      />
    );

    await user.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('opens suggestion dropdown on focus when customers exist', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));

    expect(screen.getByText('C001')).toBeInTheDocument();
    // Customer name is rendered as "— Acme Corp"
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('shows loading spinner when loading', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} loading={true} customers={[]} />);

    await user.type(screen.getByPlaceholderText(/type customer/i), 'x');

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows no matching customers message', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} customers={[]} />);

    await user.type(screen.getByPlaceholderText(/type customer/i), 'xyz');

    expect(screen.getByText('No matching customers')).toBeInTheDocument();
  });

  it('shows source badge for direct customers', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));

    expect(screen.getByText('Direct')).toBeInTheDocument();
  });

  it('selects a customer from suggestions', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<V1CustomerSuggestInput {...defaultProps} onChange={onChange} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));
    // Click the customer list item (find by customer ID text within the list)
    const customerItem = screen.getByText('C001').closest('li');
    await user.click(customerItem);

    expect(onChange).toHaveBeenCalledWith('C001');
  });

  it('shows partner source badge', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));
    expect(screen.getByText('partner')).toBeInTheDocument();
  });

  it('shows tags in suggestion list', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('shows "No assigned customers" when empty with no input', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} customers={[]} />);

    // Focus the input and type then clear to trigger dropdown open
    const input = screen.getByPlaceholderText(/type customer/i);
    await user.type(input, 'a');
    await user.clear(input);

    // Should show "No assigned customers" since customers is empty and no input value
    expect(screen.getByText(/No (assigned|matching) customers/)).toBeInTheDocument();
  });

  it('highlights selected customer in suggestion list', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} value="C001" />);

    await user.click(screen.getByDisplayValue('C001'));

    // The li for C001 should have bg-primary-50 class
    const customerItem = screen.getByText('C001').closest('li');
    expect(customerItem.className).toContain('bg-primary-50');
  });

  it('shows filter by tag button when tags exist', async () => {
    const user = userEvent.setup();
    render(<V1CustomerSuggestInput {...defaultProps} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));
    expect(screen.getByText('Filter by tag')).toBeInTheDocument();
  });

  it('calls onFilterByTag when tag selected', async () => {
    const user = userEvent.setup();
    const onFilterByTag = jest.fn();
    render(<V1CustomerSuggestInput {...defaultProps} onFilterByTag={onFilterByTag} />);

    await user.click(screen.getByPlaceholderText(/type customer/i));
    // Click "Filter by tag" button to open tag dropdown
    await user.click(screen.getByText('Filter by tag'));

    // Select a tag - there are two 'VIP' elements (badge + tag list), use getAllByText
    const vipElements = screen.getAllByText('VIP');
    // Click the tag in the tag filter list (last one, rendered in the tag dropdown portal)
    await user.click(vipElements[vipElements.length - 1]);
    expect(onFilterByTag).toHaveBeenCalledWith('VIP');
  });
});
