import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Input, Select, Card, Badge, Modal, Table, Toggle, StatCard, SearchInput, Pagination, FileUpload } from '../../../components/shared/index';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Button variant="primary">Btn</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600');

    rerender(<Button variant="danger">Btn</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');

    rerender(<Button variant="success">Btn</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-green-600');
  });

  it('applies size classes', () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6');
  });

  it('disables when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loader and disables when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveClass('opacity-50');
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Username" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('applies error border class', () => {
    const { container } = render(<Input error="Error" />);
    const input = container.querySelector('input');
    expect(input).toHaveClass('border-red-500');
  });

  it('renders without label', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('label')).not.toBeInTheDocument();
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  it('renders select with options', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Select options={options} error="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="p-4">Content</Card>);
    expect(container.firstChild).toHaveClass('card', 'p-4');
  });
});

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { rerender } = render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(<Badge variant="danger">Error</Badge>);
    expect(screen.getByText('Error')).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('uses default variant when not specified', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('bg-neutral-100');
  });
});

describe('Modal', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test">
        Content
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title and children when open', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="My Modal">
        <p>Modal body</p>
      </Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Modal">
        Content
      </Modal>
    );
    // Close button is the X button
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Modal">
        Content
      </Modal>
    );
    const backdrop = container.querySelector('.bg-black\\/50');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Table', () => {
  const columns = [
    { key: 'name', title: 'Name' },
    { key: 'email', title: 'Email' },
  ];

  it('renders headers', () => {
    render(<Table columns={columns} data={[]} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    const data = [
      { _id: '1', name: 'Alice', email: 'alice@test.com' },
      { _id: '2', name: 'Bob', email: 'bob@test.com' },
    ];
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<Table columns={columns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    const { container } = render(<Table columns={columns} data={[]} loading />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    const data = [{ _id: '1', name: 'Alice', email: 'alice@test.com' }];
    render(<Table columns={columns} data={data} onRowClick={onRowClick} />);
    await user.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('supports custom render function in columns', () => {
    const columnsWithRender = [
      { key: 'name', title: 'Name', render: (val) => `**${val}**` },
    ];
    render(<Table columns={columnsWithRender} data={[{ _id: '1', name: 'Test' }]} />);
    expect(screen.getByText('**Test**')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('renders toggle switch', () => {
    render(<Toggle enabled={false} onChange={jest.fn()} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Toggle enabled={false} onChange={jest.fn()} label="Dark Mode" />);
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  it('calls onChange with toggled value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Toggle enabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('applies active class when enabled', () => {
    render(<Toggle enabled={true} onChange={jest.fn()} />);
    expect(screen.getByRole('switch')).toHaveClass('bg-primary-600');
  });

  it('applies inactive class when disabled', () => {
    render(<Toggle enabled={false} onChange={jest.fn()} />);
    expect(screen.getByRole('switch')).toHaveClass('bg-neutral-200');
  });
});

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Users" value="150" />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('shows up trend', () => {
    render(<StatCard title="Sales" value="100" trend="up" trendValue="12%" />);
    expect(screen.getByText(/12%/)).toBeInTheDocument();
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it('shows down trend', () => {
    render(<StatCard title="Bugs" value="5" trend="down" trendValue="3%" />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<StatCard title="Test" value="1" icon={<span data-testid="icon">I</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('renders input with placeholder', () => {
    render(<SearchInput value="" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('uses custom placeholder', () => {
    render(<SearchInput value="" onChange={jest.fn()} placeholder="Find users..." />);
    expect(screen.getByPlaceholderText('Find users...')).toBeInTheDocument();
  });

  it('calls onChange on input', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<SearchInput value="" onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Search...'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={0} totalPages={1} total={10} onPageChange={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders page buttons when multiple pages', () => {
    render(<Pagination currentPage={0} totalPages={3} total={75} onPageChange={jest.fn()} />);
    // Multiple elements may have "1" text (page button + "Showing 1 to..."), so use getAllByText
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('disables Previous button on first page', () => {
    render(<Pagination currentPage={0} totalPages={3} total={75} onPageChange={jest.fn()} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables Next button on last page', () => {
    render(<Pagination currentPage={2} totalPages={3} total={75} onPageChange={jest.fn()} />);
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls onPageChange when clicking page number', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<Pagination currentPage={0} totalPages={3} total={75} onPageChange={onPageChange} />);
    await user.click(screen.getByText('2'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange with next page', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<Pagination currentPage={0} totalPages={3} total={75} onPageChange={onPageChange} />);
    await user.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows item range info', () => {
    render(<Pagination currentPage={0} totalPages={3} total={75} onPageChange={jest.fn()} />);
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });
});

describe('FileUpload', () => {
  it('renders upload label', () => {
    render(<FileUpload onFileSelect={jest.fn()} />);
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<FileUpload onFileSelect={jest.fn()} label="Upload CSV" />);
    expect(screen.getByText('Upload CSV')).toBeInTheDocument();
  });

  it('calls onFileSelect when file is selected', async () => {
    const onFileSelect = jest.fn();
    const { container } = render(<FileUpload onFileSelect={onFileSelect} />);

    const input = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    // Use fireEvent since input is hidden and user.upload may not work
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });
});
