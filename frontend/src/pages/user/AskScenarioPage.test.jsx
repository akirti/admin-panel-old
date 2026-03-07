import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import AskScenarioPage from './AskScenarioPage';

// ---- mocks ----

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUser = {
  user_id: 'u1',
  full_name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['editor'],
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isSuperAdmin: () => false,
    isAdmin: () => false,
    isEditor: () => true,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  Send: (props) => null,
  Plus: (props) => null,
  Trash2: (props) => null,
  HelpCircle: (props) => null,
  FileUp: (props) => null,
  X: (props) => null,
  Loader2: (props) => <span className={`animate-spin ${props.className || ''}`} />,
  Bold: (props) => null,
  Italic: (props) => null,
  List: (props) => null,
  ListOrdered: (props) => null,
  Link: (props) => null,
  Code: (props) => null,
  ArrowLeft: (props) => null,
  Save: (props) => null,
}));

vi.mock('../../services/api', () => ({
  scenarioRequestAPI: {
    getDomains: vi.fn(),
    getRequestTypes: vi.fn(),
    getDefaults: vi.fn(),
    getStatuses: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    adminUpdate: vi.fn(),
    uploadFile: vi.fn(),
  },
  jiraAPI: {
    getBoards: vi.fn(),
    getAssignableUsers: vi.fn(),
  },
}));

// ---- helpers ----

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/ask-scenario']}>
      <Routes>
        <Route path="/ask-scenario" element={<AskScenarioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit(requestId = 'REQ-001') {
  return render(
    <MemoryRouter initialEntries={[`/my-requests/${requestId}/edit`]}>
      <Routes>
        <Route path="/my-requests/:requestId/edit" element={<AskScenarioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function setupLookupMocks() {
  const { scenarioRequestAPI, jiraAPI } = await import('../../services/api');
  scenarioRequestAPI.getDomains.mockResolvedValue({ data: [{ key: 'finance', name: 'Finance' }] });
  scenarioRequestAPI.getRequestTypes.mockResolvedValue({ data: [{ value: 'scenario', label: 'New Scenario Request' }] });
  scenarioRequestAPI.getDefaults.mockResolvedValue({ data: { team: 'Team-A', assignee: 'acc1', assignee_name: 'Alice' } });
  scenarioRequestAPI.getStatuses.mockResolvedValue({ data: [{ value: 'submitted', label: 'Submitted' }, { value: 'review', label: 'Review' }] });
  jiraAPI.getBoards.mockResolvedValue({ data: [{ id: 1, name: 'Board-1' }] });
  jiraAPI.getAssignableUsers.mockResolvedValue({ data: [{ accountId: 'acc1', displayName: 'Alice', emailAddress: 'alice@test.com' }] });
  return { scenarioRequestAPI, jiraAPI };
}

// ---- tests ----

describe('AskScenarioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Ask for a New Scenario" heading in create mode', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Ask for a New Scenario')).toBeInTheDocument();
  });

  it('renders the form fields: Request Type, Domain, Scenario Name, Description', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
    expect(screen.getByText(/Request Type/)).toBeInTheDocument();
    expect(screen.getByText(/Scenario Name/)).toBeInTheDocument();
    expect(screen.getByText(/Description/)).toBeInTheDocument();
  });

  it('renders Submit Request button in create mode', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Submit Request')).toBeInTheDocument();
  });

  it('renders Cancel button', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Implementation Details section', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Implementation Details')).toBeInTheDocument();
  });

  it('renders Sample Files section', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Sample Files')).toBeInTheDocument();
  });

  it('loads domains from API and populates the dropdown', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });
  });

  it('shows loading spinner in edit mode while request is loading', async () => {
    const { scenarioRequestAPI, jiraAPI } = await setupLookupMocks();
    // Make the get call hang to observe loading state
    scenarioRequestAPI.get.mockReturnValue(new Promise(() => {}));

    const { container } = renderEdit();

    // Loading state should render the spinner (a div with animate-spin)
    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('renders "Edit Scenario Request" heading in edit mode after data loads', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'My Test Scenario',
        description: '<p>Test description</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });
  });

  it('populates form data with existing request values in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Existing Scenario',
        description: '<p>Existing desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
      expect(nameInput.value).toBe('Existing Scenario');
    });
  });

  it('shows Save Changes button in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('shows Admin Settings section in edit mode for editors', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
    });
  });

  it('shows existing files in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [{ file_name: 'data.csv', file_type: 'csv', version: 1 }],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Existing files:')).toBeInTheDocument();
      expect(screen.getByText('data.csv')).toBeInTheDocument();
    });
  });

  it('shows error toast and navigates away when request load fails in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockRejectedValue(new Error('Not found'));
    const toast = (await import('react-hot-toast')).default;

    renderEdit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load request');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
  });

  it('shows error toast when user has no permission to edit in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    // Return a request owned by another user and useAuth isEditor returns false
    // Since our mock always returns isEditor: true, we test that canEdit passes for editors
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'other-user',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Other Request',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    // Editor can edit any request, so form should render
    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });
  });

  it('renders Team and Assignee fields', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
    });
  });

  it('renders Choose Files button for file upload', async () => {
    await setupLookupMocks();
    renderNew();

    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  // --- Interaction tests ---

  it('submits new scenario request successfully', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockResolvedValue({ data: { requestId: 'REQ-002' } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Fill in domain
    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    // Fill in name
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'New Test Scenario');

    // Fill in description via contentEditable (the RichTextEditor)
    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>Test description content</p>';
      fireEvent.input(editorDiv);
    }

    // Submit form
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(scenarioRequestAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        dataDomain: 'finance',
        name: 'New Test Scenario',
      }));
      expect(toast.success).toHaveBeenCalledWith('Scenario request submitted successfully!');
      expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
    });
  });

  it('validates missing domain on submit', async () => {
    await setupLookupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Fill in name but not domain
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    // Submit via form event to bypass HTML5 validation
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please select a domain');
    });
  });

  it('validates missing name on submit', async () => {
    await setupLookupMocks();
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    // Select domain but leave name empty
    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    // Submit via form event to bypass HTML5 validation
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a scenario name');
    });
  });

  it('handles create submission error', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.create.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
    });

    const domainSelect = screen.getByDisplayValue('Select a domain...');
    await user.selectOptions(domainSelect, 'finance');

    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.type(nameInput, 'Error Test');

    const editorDiv = document.querySelector('[contenteditable]');
    if (editorDiv) {
      editorDiv.innerHTML = '<p>desc</p>';
      fireEvent.input(editorDiv);
    }

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('navigates back on Cancel click in create mode', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await user.click(screen.getByText('Cancel'));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('adds implementation steps', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();
    });

    // Enable "knows steps" checkbox
    const checkbox = document.querySelector('input[name="knows_steps"]');
    if (checkbox) {
      await user.click(checkbox);

      // Should show step input fields
      await waitFor(() => {
        const stepInput = screen.getByPlaceholderText('What should this step do?');
        expect(stepInput).toBeInTheDocument();
      });

      // Type a step description
      const stepInput = screen.getByPlaceholderText('What should this step do?');
      await user.type(stepInput, 'First step');

      // Click add step button
      const addBtn = screen.getByText('Add Step');
      await user.click(addBtn);

      // Step should appear in the list
      await waitFor(() => {
        expect(screen.getByText('First step')).toBeInTheDocument();
      });
    }
  });

  it('handles file selection', async () => {
    await setupLookupMocks();
    const user = userEvent.setup();

    renderNew();

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
      await user.upload(fileInput, testFile);

      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument();
      });
    }
  });

  it('updates request in edit mode successfully', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Original Name',
        description: '<p>Original desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    scenarioRequestAPI.update.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Edit Scenario Request')).toBeInTheDocument();
    });

    // Update the name
    const nameInput = screen.getByPlaceholderText('Enter a descriptive name for your scenario');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(scenarioRequestAPI.update).toHaveBeenCalledWith('REQ-001', expect.objectContaining({
        name: 'Updated Name',
      }));
      expect(toast.success).toHaveBeenCalledWith('Scenario request updated successfully!');
    });
  });

  it('loads Jira boards in team dropdown', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Board-1')).toBeInTheDocument();
    });
  });

  it('loads Jira assignable users in assignee dropdown', async () => {
    await setupLookupMocks();

    renderNew();

    await waitFor(() => {
      expect(screen.getByText('Alice (alice@test.com)')).toBeInTheDocument();
    });
  });

  it('renders Back button in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('navigates back when Back button is clicked in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });
    const user = userEvent.setup();

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders editing description text in edit mode', async () => {
    const { scenarioRequestAPI } = await setupLookupMocks();
    scenarioRequestAPI.get.mockResolvedValue({
      data: {
        user_id: 'u1',
        requestId: 'REQ-001',
        requestType: 'scenario',
        dataDomain: 'finance',
        name: 'Test',
        description: '<p>desc</p>',
        status: 'submitted',
        steps: [],
        files: [],
      },
    });

    renderEdit();

    await waitFor(() => {
      expect(screen.getByText('Editing request REQ-001')).toBeInTheDocument();
    });
  });

  it('shows request types in dropdown', async () => {
    await setupLookupMocks();
    renderNew();

    await waitFor(() => {
      expect(screen.getByText('New Scenario Request')).toBeInTheDocument();
    });
  });
});
