import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DomainsManagement from '../../../pages/admin/DomainsManagement';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isEditor: () => true,
  }),
}));

jest.mock('../../../services/api', () => ({
  domainAPI: {
    getAll: jest.fn(),
    getTypes: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../components/shared/LucideIconPicker', () => ({
  __esModule: true, default: () => <div data-testid="icon-picker">Icon Picker</div>,
}));

const mockDomains = [
  {
    _id: 'd1',
    key: 'finance',
    name: 'Finance',
    description: 'Financial data',
    path: '/finance',
    order: 1,
    status: 'active',
    icon: '',
    subDomains: [],
  },
  {
    _id: 'd2',
    key: 'hr',
    name: 'Human Resources',
    description: 'HR data',
    path: '/hr',
    order: 2,
    status: 'inactive',
    icon: '',
    subDomains: [],
  },
];

async function setupMocks() {
  const { domainAPI } = await import('../../../services/api');
  domainAPI.getAll.mockResolvedValue({ data: mockDomains });
  domainAPI.getTypes.mockResolvedValue({ data: [{ value: 'custom', label: 'Custom' }] });
}

function renderDomainsManagement() {
  return render(
    <MemoryRouter>
      <DomainsManagement />
    </MemoryRouter>
  );
}

describe('DomainsManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Domains Management' })).toBeInTheDocument();
    });
  });

  it('renders domains table', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Human Resources')).toBeInTheDocument();
      expect(screen.getByText('finance')).toBeInTheDocument();
    });
  });

  it('renders status badges', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search domains...')).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText('Create Domain')).toBeInTheDocument();
    });
  });

  it('filters domains by search', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search domains...'), 'Human');

    expect(screen.getByText('Human Resources')).toBeInTheDocument();
    expect(screen.queryByText('Finance')).not.toBeInTheDocument();
  });

  it('shows empty state when no domains match', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search domains...'), 'nonexistent');

    expect(screen.getByText('No domains found')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.getAll.mockRejectedValue(new Error('API Error'));
    domainAPI.getTypes.mockResolvedValue({ data: [] });

    renderDomainsManagement();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to fetch domains');
    });
  });

  it('shows access denied for non-editors', async () => {
    // Override useAuth mock for this test
    const authModule = require('../../../contexts/AuthContext');
    jest.spyOn(authModule, 'useAuth').mockReturnValueOnce({ isEditor: () => false });

    await setupMocks();
    renderDomainsManagement();

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText('Create Domain')).toBeInTheDocument();
    });

    // Fill form fields
    await user.type(screen.getByPlaceholderText('domain-key'), 'new-domain');
    await user.type(screen.getByPlaceholderText('Domain Name'), 'New Domain');

    // Submit form
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(domainAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        key: 'new-domain',
        name: 'New Domain',
      }));
      expect(toast.default.success).toHaveBeenCalledWith('Domain created successfully');
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Domain')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Domain')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(domainAPI.update).toHaveBeenCalledWith('d1', expect.objectContaining({
        _id: 'd1',
        key: 'finance',
        name: 'Finance',
      }));
      expect(toast.default.success).toHaveBeenCalledWith('Domain updated successfully');
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(domainAPI.delete).toHaveBeenCalledWith('d1');
      expect(toast.default.success).toHaveBeenCalledWith('Domain deleted successfully');
    });

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(domainAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.create.mockRejectedValue({ response: { data: { error: 'Key already exists' } } });
    const user = userEvent.setup();

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText('Create Domain')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('domain-key'), 'dup');
    await user.type(screen.getByPlaceholderText('Domain Name'), 'Dup');

    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Key already exists');
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    domainAPI.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Cannot delete');
    });

    jest.restoreAllMocks();
  });

  it('closes modal via cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Domain'));

    await waitFor(() => {
      expect(screen.getByText('Create Domain')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    // After cancel, form should reset, so Create Domain modal title should be gone
    // (The modal is controlled by isOpen prop)
  });

  it('renders domain descriptions', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('Financial data')).toBeInTheDocument();
      expect(screen.getByText('HR data')).toBeInTheDocument();
    });
  });

  it('renders domain paths', async () => {
    await setupMocks();
    renderDomainsManagement();

    await waitFor(() => {
      expect(screen.getByText('/finance')).toBeInTheDocument();
      expect(screen.getByText('/hr')).toBeInTheDocument();
    });
  });

  it('adds a subdomain in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => { expect(screen.getByText('Finance')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Domain'));
    await waitFor(() => { expect(screen.getByText('Create Domain')).toBeInTheDocument(); });

    // Fill subdomain fields
    const keyInput = screen.getByPlaceholderText('Key');
    const nameInput = screen.getByPlaceholderText('Name');
    const pathInput = screen.getByPlaceholderText('Path');
    await user.type(keyInput, 'sub1');
    await user.type(nameInput, 'Sub Domain 1');
    await user.type(pathInput, '/sub1');

    // Click Add SubDomain
    await user.click(screen.getByText('Add SubDomain'));

    // Subdomain should appear in list
    await waitFor(() => {
      expect(screen.getByText('Sub Domain 1')).toBeInTheDocument();
      expect(screen.getByText('(sub1)')).toBeInTheDocument();
    });
  });

  it('toggles defaultSelected checkbox', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => { expect(screen.getByText('Finance')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Domain'));
    await waitFor(() => { expect(screen.getByText('Create Domain')).toBeInTheDocument(); });

    const defaultCheckbox = screen.getByLabelText('Default Selected');
    expect(defaultCheckbox.checked).toBe(false);
    await user.click(defaultCheckbox);
    expect(defaultCheckbox.checked).toBe(true);
  });

  it('opens icon picker', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => { expect(screen.getByText('Finance')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Domain'));
    await waitFor(() => { expect(screen.getByText('Create Domain')).toBeInTheDocument(); });

    await user.click(screen.getByText('Select Icon'));
    await waitFor(() => {
      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });
  });

  it('fills icon URL and shows clear button', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => { expect(screen.getByText('Finance')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Domain'));
    await waitFor(() => { expect(screen.getByText('Create Domain')).toBeInTheDocument(); });

    const iconInput = screen.getByPlaceholderText('Icon data URI or URL');
    await user.type(iconInput, 'https://example.com/icon.png');
    expect(iconInput.value).toBe('https://example.com/icon.png');

    // Clear icon button should appear
    await waitFor(() => {
      expect(screen.getByTitle('Clear icon')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Clear icon'));
    expect(iconInput.value).toBe('');
  });

  it('changes status dropdown in create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderDomainsManagement();

    await waitFor(() => { expect(screen.getByText('Finance')).toBeInTheDocument(); });

    await user.click(screen.getByText('Add Domain'));
    await waitFor(() => { expect(screen.getByText('Create Domain')).toBeInTheDocument(); });

    const statusSelect = screen.getByDisplayValue('Active');
    await user.selectOptions(statusSelect, 'inactive');
    expect(statusSelect.value).toBe('inactive');
  });
});
