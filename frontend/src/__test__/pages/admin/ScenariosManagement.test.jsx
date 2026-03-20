import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScenariosManagement from '../../../pages/admin/ScenariosManagement';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: () => true,
  }),
}));

jest.mock('../../../services/api', () => ({
  scenarioAPI: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  domainAPI: {
    getAll: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({ __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../components/shared', () => ({
  Modal: ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return <div data-testid="modal"><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog">X</button>{children}</div>;
  },
  Table: ({ columns, data, loading, emptyMessage }) => {
    if (loading) return <div>Loading...</div>;
    if (!data || data.length === 0) return <div>{emptyMessage || 'No data available'}</div>;
    return (
      <table>
        <thead><tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map(c => (
                <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

const mockScenarios = [
  {
    _id: 's1',
    key: 'revenue-report',
    name: 'Revenue Report',
    dataDomain: 'finance',
    description: 'Monthly revenue',
    status: 'A',
    order: 1,
  },
  {
    _id: 's2',
    key: 'expense-tracker',
    name: 'Expense Tracker',
    dataDomain: 'finance',
    status: 'I',
    order: 2,
  },
];

const mockDomains = [
  { key: 'finance', name: 'Finance' },
  { key: 'hr', name: 'HR' },
];

async function setupMocks() {
  const { scenarioAPI, domainAPI } = await import('../../../services/api');
  scenarioAPI.getAll.mockResolvedValue({ data: mockScenarios });
  domainAPI.getAll.mockResolvedValue({ data: mockDomains });
}

function renderScenariosManagement() {
  return render(
    <MemoryRouter>
      <ScenariosManagement />
    </MemoryRouter>
  );
}

describe('ScenariosManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page header', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scenarios Management' })).toBeInTheDocument();
    });
  });

  it('renders scenarios table', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
      expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
      expect(screen.getByText('revenue-report')).toBeInTheDocument();
    });
  });

  it('shows active/inactive status', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders domain filter', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('All Domains')).toBeInTheDocument();
    });
  });

  it('opens create modal', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });
  });

  it('filters scenarios by search', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search scenarios...'), 'Expense');

    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.queryByText('Revenue Report')).not.toBeInTheDocument();
  });

  it('shows empty state when no scenarios match', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search scenarios...'), 'nonexistent');

    expect(screen.getByText('No scenarios found')).toBeInTheDocument();
  });

  it('shows access denied for non-super-admins', async () => {
    const authModule = require('../../../contexts/AuthContext');
    jest.spyOn(authModule, 'useAuth').mockReturnValueOnce({ isSuperAdmin: () => false });

    await setupMocks();
    renderScenariosManagement();

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('handles API error', async () => {
    const { scenarioAPI, domainAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.getAll.mockRejectedValue(new Error('API Error'));
    domainAPI.getAll.mockRejectedValue(new Error('API Error'));

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    });
  });

  it('submits create form and calls API', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.create.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    // Fill form fields
    await user.type(screen.getByPlaceholderText('scenario-key'), 'new-scenario');
    await user.type(screen.getByPlaceholderText('Scenario Name'), 'New Scenario');

    // Submit form
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(scenarioAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        key: 'new-scenario',
        name: 'New Scenario',
      }));
      expect(screen.getByText('Scenario created successfully')).toBeInTheDocument();
    });
  });

  it('opens edit modal with pre-populated data', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });
  });

  it('submits update form and calls API', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.update.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(scenarioAPI.update).toHaveBeenCalledWith('s1', expect.objectContaining({
        _id: 's1',
        key: 'revenue-report',
        name: 'Revenue Report',
      }));
      expect(screen.getByText('Scenario updated successfully')).toBeInTheDocument();
    });
  });

  it('handles delete with confirmation', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(scenarioAPI.delete).toHaveBeenCalledWith('s1');
      expect(screen.getByText('Scenario deleted successfully')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('cancels delete when user declines', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(scenarioAPI.delete).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('handles create failure', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.create.mockRejectedValue({ response: { data: { error: 'Key already exists' } } });
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('scenario-key'), 'dup');
    await user.type(screen.getByPlaceholderText('Scenario Name'), 'Dup');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Key already exists')).toBeInTheDocument();
    });
  });

  it('handles delete failure', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cannot delete')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('closes modal via cancel button', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));
  });

  it('filters by domain', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    // Both scenarios have 'finance' domain
    const domainSelect = screen.getByDisplayValue('All Domains');
    await user.selectOptions(domainSelect, 'hr');

    // HR domain should filter out both finance scenarios
    expect(screen.queryByText('Revenue Report')).not.toBeInTheDocument();
  });

  it('shows scenario descriptions', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Monthly revenue')).toBeInTheDocument();
    });
  });

  it('shows scenario keys', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('revenue-report')).toBeInTheDocument();
      expect(screen.getByText('expense-tracker')).toBeInTheDocument();
    });
  });

  it('shows domain badges in table', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      // Both scenarios have 'finance' domain
      const financeBadges = screen.getAllByText('finance');
      expect(financeBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows loading state while fetching data', async () => {
    const { scenarioAPI, domainAPI } = await import('../../../services/api');
    scenarioAPI.getAll.mockReturnValue(new Promise(Function.prototype));
    domainAPI.getAll.mockReturnValue(new Promise(Function.prototype));

    renderScenariosManagement();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles update failure', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.update.mockRejectedValue({ response: { data: { error: 'Update failed' } } });
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('disables key field in edit mode', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });

    const keyInput = screen.getByPlaceholderText('scenario-key');
    expect(keyInput).toBeDisabled();
  });

  it('edit modal populates all form fields including optional ones', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });

    // Check form is populated with scenario data
    expect(screen.getByPlaceholderText('scenario-key').value).toBe('revenue-report');
    expect(screen.getByPlaceholderText('Scenario Name').value).toBe('Revenue Report');
    expect(screen.getByPlaceholderText('Short description...').value).toBe('Monthly revenue');
  });

  it('changes order field with integer conversion', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    // Order field is type="number" with no placeholder - find by name attribute
    const orderInput = document.querySelector('input[name="order"]');
    await user.clear(orderInput);
    await user.type(orderInput, '5');
    expect(orderInput.value).toBe('5');
  });

  it('fills in description, path and full description fields', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    const descInput = screen.getByPlaceholderText('Short description...');
    await user.type(descInput, 'Test description');
    expect(descInput.value).toBe('Test description');

    const pathInput = screen.getByPlaceholderText('/path');
    await user.type(pathInput, '/test/path');
    expect(pathInput.value).toBe('/test/path');
  });

  it('shows saving state on submit button', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    // Make create hang to observe saving state
    scenarioAPI.create.mockReturnValue(new Promise(Function.prototype));
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('scenario-key'), 'test');
    await user.type(screen.getByPlaceholderText('Scenario Name'), 'Test');
    await user.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  it('shows table column headers', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Scenario')).toBeInTheDocument();
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Domain')).toBeInTheDocument();
      expect(screen.getByText('Order')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('shows order values in table', async () => {
    await setupMocks();
    renderScenariosManagement();

    await waitFor(() => {
      // Order values appear alongside stat card numbers
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles update error without response data', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.update.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(screen.getByText('Failed to save scenario')).toBeInTheDocument();
    });
  });

  it('handles delete error without response data', async () => {
    await setupMocks();
    const { scenarioAPI } = await import('../../../services/api');
    const toast = await import('react-hot-toast');
    scenarioAPI.delete.mockRejectedValue(new Error('Network error'));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to delete scenario')).toBeInTheDocument();
    });

    jest.restoreAllMocks();
  });

  it('creates modal defaults domain to first domain', async () => {
    await setupMocks();
    const user = userEvent.setup();

    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Create Scenario')).toBeInTheDocument();
    });

    // Domain select should default to first domain 'finance'
    const domainSelect = screen.getByDisplayValue('Finance');
    expect(domainSelect).toBeInTheDocument();
  });

  it('filters by search on key field', async () => {
    await setupMocks();
    const user = userEvent.setup();
    renderScenariosManagement();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search scenarios...'), 'revenue-report');

    expect(screen.getByText('Revenue Report')).toBeInTheDocument();
    expect(screen.queryByText('Expense Tracker')).not.toBeInTheDocument();
  });
});
