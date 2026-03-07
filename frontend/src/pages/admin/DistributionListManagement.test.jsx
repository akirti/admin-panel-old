import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import DistributionListManagement from './DistributionListManagement';

vi.mock('../../services/api', () => ({
  distributionListsAPI: {
    list: vi.fn(),
    getTypes: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toggleStatus: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../components/shared', () => ({
  Input: ({ label, value, onChange, placeholder }) => (
    <div>{label && <label>{label}</label>}<input value={value} onChange={onChange} placeholder={placeholder} /></div>
  ),
  Modal: ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return <div data-testid="modal"><h2>{title}</h2>{children}</div>;
  },
  Toggle: ({ enabled, onChange, label }) => (
    <label><input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />{label}</label>
  ),
  Badge: ({ children, variant }) => <span data-variant={variant}>{children}</span>,
}));

const mockLists = [
  {
    _id: 'dl1',
    key: 'dev-team',
    name: 'Dev Team',
    description: 'Development team',
    type: 'custom',
    emails: ['dev1@test.com', 'dev2@test.com'],
    is_active: true,
  },
  {
    _id: 'dl2',
    key: 'qa-team',
    name: 'QA Team',
    description: 'QA team',
    type: 'system',
    emails: ['qa@test.com'],
    is_active: false,
  },
];

async function setupMocks() {
  const { distributionListsAPI } = await import('../../services/api');
  distributionListsAPI.list.mockResolvedValue({
    data: { data: mockLists, pagination: { total: 2, pages: 1, page: 0, limit: 25 } },
  });
  distributionListsAPI.getTypes.mockResolvedValue({
    data: { types: [{ value: 'custom', label: 'Custom' }, { value: 'system', label: 'System' }] },
  });
}

function renderDistributionListManagement() {
  return render(
    <MemoryRouter>
      <DistributionListManagement />
    </MemoryRouter>
  );
}

describe('DistributionListManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Distribution Lists' })).toBeInTheDocument();
    });
  });

  it('renders distribution lists', async () => {
    await setupMocks();
    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
      expect(screen.getByText('QA Team')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  it('shows active/inactive status', async () => {
    await setupMocks();
    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.list.mockRejectedValue(new Error('API Error'));
    distributionListsAPI.getTypes.mockRejectedValue(new Error('API Error'));

    renderDistributionListManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load distribution lists');
    });
  });

  it('opens create modal when clicking Add Distribution List', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Distribution List'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Create Distribution List')).toBeInTheDocument();
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Distribution List'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill form fields
    await user.type(screen.getByPlaceholderText('unique-key'), 'new-list');
    await user.type(screen.getByPlaceholderText('Distribution List Name'), 'New List');

    // Click Create button
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(distributionListsAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        key: 'new-list',
        name: 'New List',
      }));
      expect(toast.default.success).toHaveBeenCalledWith('Distribution list created successfully');
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Edit Distribution List')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Distribution List')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(distributionListsAPI.update).toHaveBeenCalledWith('dl1', expect.objectContaining({
        key: 'dev-team',
        name: 'Dev Team',
      }));
      expect(toast.default.success).toHaveBeenCalledWith('Distribution list updated successfully');
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(distributionListsAPI.delete).toHaveBeenCalledWith('dl1');
      expect(toast.default.success).toHaveBeenCalledWith('Distribution list deleted');
    });

    vi.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(distributionListsAPI.delete).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('handles toggle status', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.toggleStatus.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    // First item is active, so clicking toggle should disable
    const toggleButtons = screen.getAllByTitle('Disable');
    await user.click(toggleButtons[0]);

    await waitFor(() => {
      expect(distributionListsAPI.toggleStatus).toHaveBeenCalledWith('dl1');
      expect(toast.default.success).toHaveBeenCalledWith('Distribution list deactivated');
    });
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.create.mockRejectedValue({ response: { data: { detail: 'Key exists' } } });
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Distribution List'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('unique-key'), 'dup');
    await user.type(screen.getByPlaceholderText('Distribution List Name'), 'Dup');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Key exists');
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.delete.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to delete distribution list');
    });

    vi.restoreAllMocks();
  });

  it('handles toggle status failure', async () => {
    await setupMocks();
    const { distributionListsAPI } = await import('../../services/api');
    const toast = await import('react-hot-toast');
    distributionListsAPI.toggleStatus.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByTitle('Disable');
    await user.click(toggleButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to toggle status');
    });
  });

  it('shows email counts in table', async () => {
    await setupMocks();
    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Dev Team has 2 emails
      expect(screen.getAllByText('emails').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no lists', async () => {
    const { distributionListsAPI } = await import('../../services/api');
    distributionListsAPI.list.mockResolvedValue({
      data: { data: [], pagination: { total: 0, pages: 0, page: 0, limit: 25 } },
    });
    distributionListsAPI.getTypes.mockResolvedValue({
      data: { types: [{ value: 'custom', label: 'Custom' }] },
    });

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText(/No distribution lists found/)).toBeInTheDocument();
    });
  });

  it('closes modal via cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();

    await waitFor(() => {
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Distribution List'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  it('adds and removes email in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();
    await waitFor(() => { expect(screen.getByText('Dev Team')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Distribution List'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    // Type email and click Add
    const emailInput = screen.getByPlaceholderText('email@example.com');
    await user.type(emailInput, 'new@test.com');
    await user.click(screen.getByText('Add'));

    // Email should appear in list
    await waitFor(() => {
      expect(screen.getByText('new@test.com')).toBeInTheDocument();
    });
  });

  it('rejects invalid email format', async () => {
    await setupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderDistributionListManagement();
    await waitFor(() => { expect(screen.getByText('Dev Team')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Distribution List'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const emailInput = screen.getByPlaceholderText('email@example.com');
    await user.type(emailInput, 'notanemail');
    await user.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
    });
  });

  it('searches by name or key', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();
    await waitFor(() => { expect(screen.getByText('Dev Team')).toBeInTheDocument(); });

    const searchInput = screen.getByPlaceholderText('Search by name or key...');
    await user.type(searchInput, 'dev');
    expect(searchInput.value).toBe('dev');
  });

  it('filters by type dropdown', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();
    await waitFor(() => { expect(screen.getByText('Dev Team')).toBeInTheDocument(); });

    const typeSelect = screen.getByDisplayValue('All Types');
    await user.selectOptions(typeSelect, 'custom');
    expect(typeSelect.value).toBe('custom');
  });

  it('fills form fields in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDistributionListManagement();
    await waitFor(() => { expect(screen.getByText('Dev Team')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Distribution List'));
    await waitFor(() => { expect(screen.getByTestId('modal')).toBeInTheDocument(); });

    const keyInput = screen.getByPlaceholderText('unique-key');
    await user.type(keyInput, 'test-list');
    expect(keyInput.value).toBe('test-list');

    const nameInput = screen.getByPlaceholderText('Distribution List Name');
    await user.type(nameInput, 'Test List');
    expect(nameInput.value).toBe('Test List');

    const descInput = screen.getByPlaceholderText('Optional description');
    await user.type(descInput, 'A test list');
    expect(descInput.value).toBe('A test list');
  });
});
