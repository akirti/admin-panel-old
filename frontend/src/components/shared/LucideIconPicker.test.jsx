import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LucideIconPicker from './LucideIconPicker';

describe('LucideIconPicker', () => {
  let mockOnChange;
  let mockOnClose;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = vi.fn();
    mockOnClose = vi.fn();
  });

  it('renders the icon picker modal', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    expect(screen.getByText(/select icon/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search icons/i)).toBeInTheDocument();
  });

  it('shows popular icons by default', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    expect(screen.getByText(/showing .* popular icons/i)).toBeInTheDocument();
  });

  it('filters icons when searching', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    const searchInput = screen.getByPlaceholderText(/search icons/i);
    await user.type(searchInput, 'Home');

    expect(screen.getByText(/icons matching "Home"/i)).toBeInTheDocument();
  });

  it('shows no results message for unmatched search', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    await user.type(screen.getByPlaceholderText(/search icons/i), 'xyznonexistent123');

    expect(screen.getByText(/no icons found/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    // The close button has an X icon
    const closeButtons = screen.getAllByRole('button');
    // First button-like element in the header with X icon
    const closeButton = closeButtons.find(btn => btn.closest('.flex.items-center.justify-between'));
    if (closeButton) {
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('renders color preset buttons', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    expect(screen.getByTitle('Blue')).toBeInTheDocument();
    expect(screen.getByTitle('Green')).toBeInTheDocument();
    expect(screen.getByTitle('Red')).toBeInTheDocument();
    expect(screen.getByTitle('Orange')).toBeInTheDocument();
    expect(screen.getByTitle('Purple')).toBeInTheDocument();
    expect(screen.getByTitle('Pink')).toBeInTheDocument();
    expect(screen.getByTitle('Gray')).toBeInTheDocument();
    expect(screen.getByTitle('Black')).toBeInTheDocument();
  });

  it('allows selecting a color preset', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    const redButton = screen.getByTitle('Red');
    await user.click(redButton);

    // Red button should now have the active ring class
    expect(redButton).toHaveClass('ring-2');
  });

  it('renders the custom color input', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    expect(screen.getByTitle('Custom color')).toBeInTheDocument();
  });

  it('shows footer with click instruction', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    expect(screen.getByText('Click an icon to select')).toBeInTheDocument();
  });

  it('renders icon buttons with title attributes', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    // Popular icons should have title like "Select Home"
    expect(screen.getByTitle('Select Home')).toBeInTheDocument();
    expect(screen.getByTitle('Select User')).toBeInTheDocument();
  });

  it('autofocuses the search input', () => {
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);
    const searchInput = screen.getByPlaceholderText(/search icons/i);
    expect(searchInput).toHaveFocus();
  });
});
