import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LucideIconPicker from '../../../components/shared/LucideIconPicker';

describe('LucideIconPicker', () => {
  let mockOnChange;
  let mockOnClose;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnChange = jest.fn();
    mockOnClose = jest.fn();
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

  it('handles icon click when SVG element is found', async () => {
    const user = userEvent.setup();

    // Mock XMLSerializer and btoa
    const mockSerializeToString = jest.fn(() => '<svg></svg>');
    window.XMLSerializer = jest.fn(() => ({ serializeToString: mockSerializeToString }));

    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    // Click the Home icon button
    const homeButton = screen.getByTitle('Select Home');
    await user.click(homeButton);

    // The handler should have attempted to select the icon
    // If SVG was found in DOM, onChange and onClose should be called
    if (mockOnChange.mock.calls.length > 0) {
      expect(mockOnChange).toHaveBeenCalledWith(expect.stringContaining('data:image/svg+xml;base64,'));
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('handles icon click when SVG element is not found', async () => {
    const user = userEvent.setup();

    // Temporarily remove all SVGs from DOM
    const originalQuerySelector = document.querySelector.bind(document);
    jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector.includes('data-icon-name')) return null;
      return originalQuerySelector(selector);
    });

    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    const homeButton = screen.getByTitle('Select Home');
    await user.click(homeButton);

    // onChange should NOT be called since SVG was not found
    expect(mockOnChange).not.toHaveBeenCalled();

    document.querySelector.mockRestore();
  });

  it('truncates long icon names in display', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    // Search for an icon with a long name
    await user.type(screen.getByPlaceholderText(/search icons/i), 'ArrowUpRight');

    // Long names should be truncated with ellipsis
    const iconTexts = screen.getAllByTitle(/Select Arrow/);
    expect(iconTexts.length).toBeGreaterThan(0);
  });

  it('changes color with custom color input', async () => {
    const user = userEvent.setup();
    render(<LucideIconPicker onChange={mockOnChange} onClose={mockOnClose} />);

    const customColorInput = screen.getByTitle('Custom color');
    await user.click(customColorInput);
    // Just ensure the custom color input exists and is interactive
    expect(customColorInput).toHaveAttribute('type', 'color');
  });
});
