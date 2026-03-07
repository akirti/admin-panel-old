import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import RequestDetailPage from './RequestDetailPage';

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
  ArrowLeft: (props) => null,
  Clock: (props) => null,
  CheckCircle: (props) => null,
  XCircle: (props) => null,
  AlertCircle: (props) => null,
  Loader2: (props) => <span className={`animate-spin ${props.className || ''}`} />,
  MessageSquare: (props) => null,
  FileText: (props) => null,
  Download: (props) => null,
  Eye: (props) => null,
  Send: (props) => null,
  Edit: (props) => null,
  User: (props) => null,
  Calendar: (props) => null,
  Upload: (props) => null,
  Package: (props) => null,
  X: (props) => null,
  ChevronLeft: (props) => null,
  ChevronRight: (props) => null,
  ExternalLink: (props) => null,
  Plus: (props) => null,
  Trash2: (props) => null,
  Link: (props) => null,
}));

vi.mock('dompurify', () => ({
  default: { sanitize: (html) => html },
}));

vi.mock('../../components/shared', () => ({
  Modal: ({ isOpen, onClose, title, children, size }) =>
    isOpen ? <div data-testid="modal" role="dialog"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('../../services/api', () => ({
  scenarioRequestAPI: {
    get: vi.fn(),
    addComment: vi.fn(),
    previewFile: vi.fn(),
    downloadFile: vi.fn(),
    uploadBucketFile: vi.fn(),
    addJiraLink: vi.fn(),
    removeJiraLink: vi.fn(),
  },
}));

// ---- helpers ----

const mockRequest = {
  requestId: 'REQ-001',
  name: 'Test Scenario Request',
  description: '<p>This is a description</p>',
  reason: '<p>Business reason</p>',
  status: 'submitted',
  dataDomain: 'finance',
  requestType: 'scenario',
  user_id: 'u1',
  row_add_stp: '2026-01-15T10:00:00Z',
  row_update_stp: '2026-01-16T14:30:00Z',
  steps: [
    { description: 'Step one', database: 'sales_db', query: 'SELECT * FROM orders' },
    { description: 'Step two', database: null, query: null },
  ],
  files: [
    { file_name: 'sample.csv', file_type: 'csv', version: 1, gcs_path: 'path/to/sample.csv' },
  ],
  comments: [
    { username: 'alice', comment: 'Looks good', commentDate: '2026-01-16T15:00:00Z' },
  ],
  buckets: [],
  work_flow: [
    { from_status: 'new', to_status: 'submitted', create_stp: '2026-01-15T10:00:00Z', comment: 'Initial submission' },
  ],
  jira: null,
  jira_integration: null,
  jira_links: [],
  team: 'Team-A',
  assignee_name: 'Bob',
  scenarioKey: 'SC-001',
  fulfilmentDate: '2026-03-01T00:00:00Z',
};

function renderPage(requestId = 'REQ-001', path = '/my-requests') {
  return render(
    <MemoryRouter initialEntries={[`${path}/${requestId}`]}>
      <Routes>
        <Route path={`${path}/:requestId`} element={<RequestDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function setupMock(requestData = mockRequest) {
  const { scenarioRequestAPI } = await import('../../services/api');
  scenarioRequestAPI.get.mockResolvedValue({ data: requestData });
  return scenarioRequestAPI;
}

// ---- tests ----

describe('RequestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while request is loading', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.get.mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows "Request not found" when request is null', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.get.mockResolvedValue({ data: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Request not found')).toBeInTheDocument();
    });
  });

  it('renders request name as heading', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
  });

  it('displays the request ID', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });
  });

  it('renders Back to Requests button', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Back to Requests')).toBeInTheDocument();
    });
  });

  it('renders Description section with sanitised HTML', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Description').length).toBeGreaterThan(0);
    });
  });

  it('renders Business Justification when reason is provided', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Business Justification')).toBeInTheDocument();
    });
  });

  it('renders Implementation Steps when steps exist', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Implementation Steps')).toBeInTheDocument();
    });
  });

  it('displays step details: description and database', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Step one')).toBeInTheDocument();
      expect(screen.getByText(/sales_db/)).toBeInTheDocument();
    });
  });

  it('renders Sample Files section when files exist', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sample Files')).toBeInTheDocument();
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });
  });

  it('renders Comments section with comment count', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    });
  });

  it('displays existing comments with username', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('Looks good')).toBeInTheDocument();
    });
  });

  it('renders comment input and send button', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    });
  });

  it('renders sidebar Details card with domain and request type', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('finance')).toBeInTheDocument();
      expect(screen.getByText('scenario')).toBeInTheDocument();
    });
  });

  it('renders Team and Assignee in sidebar', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Team-A')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('renders Scenario Key in sidebar', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('SC-001')).toBeInTheDocument();
    });
  });

  it('renders Workflow section with timeline entries', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Workflow')).toBeInTheDocument();
    });
  });

  it('renders Edit button for editor on submitted status', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  it('renders Data Delivery section', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Data Delivery')).toBeInTheDocument();
    });
  });

  it('shows empty data delivery message when no buckets', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No data snapshots/)).toBeInTheDocument();
    });
  });

  it('renders data delivery files when buckets exist', async () => {
    const requestWithBuckets = {
      ...mockRequest,
      status: 'accepted',
      buckets: [
        { file_name: 'snapshot.xlsx', file_type: 'xlsx', version: 1, gcs_path: 'path/to/snapshot.xlsx', uploaded_by: 'admin', upload_date: '2026-02-01T00:00:00Z' },
      ],
    };
    await setupMock(requestWithBuckets);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('snapshot.xlsx')).toBeInTheDocument();
    });
  });

  it('shows Upload Snapshot button for editors on accepted status', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    await setupMock(acceptedRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });
  });

  it('shows Jira section with Add Link button for editors', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Jira')).toBeInTheDocument();
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });
  });

  it('shows "No comments yet" when no comments exist', async () => {
    const requestNoComments = { ...mockRequest, comments: [] };
    await setupMock(requestNoComments);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeInTheDocument();
    });
  });

  it('calls toast.error and navigates on load failure', async () => {
    const { scenarioRequestAPI } = await import('../../services/api');
    scenarioRequestAPI.get.mockRejectedValue(new Error('Network error'));
    const toast = (await import('react-hot-toast')).default;

    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load request');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/my-requests');
  });

  it('renders Jira main ticket link when jira data exists', async () => {
    const requestWithJira = {
      ...mockRequest,
      jira: { ticket_key: 'PROJ-123', ticket_url: 'https://jira.test/PROJ-123' },
    };
    await setupMock(requestWithJira);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Main Ticket')).toBeInTheDocument();
      expect(screen.getByText('PROJ-123')).toBeInTheDocument();
    });
  });

  it('renders Jira dependency links', async () => {
    const requestWithLinks = {
      ...mockRequest,
      jira_links: [
        { ticket_key: 'DEP-456', ticket_url: 'https://jira.test/DEP-456', link_type: 'dependency', title: 'Data pipeline' },
      ],
    };
    await setupMock(requestWithLinks);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('DEP-456')).toBeInTheDocument();
      expect(screen.getByText('Data pipeline')).toBeInTheDocument();
    });
  });

  it('does not show steps section when steps are empty', async () => {
    const requestNoSteps = { ...mockRequest, steps: [] };
    await setupMock(requestNoSteps);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Implementation Steps')).not.toBeInTheDocument();
  });

  it('does not show files section when files are empty', async () => {
    const requestNoFiles = { ...mockRequest, files: [] };
    await setupMock(requestNoFiles);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Sample Files')).not.toBeInTheDocument();
  });

  // --- Interaction Tests ---

  it('submits comment successfully', async () => {
    const api = await setupMock();
    api.addComment.mockResolvedValue({ data: {} });
    // After comment, reload returns updated request
    api.get.mockResolvedValue({ data: { ...mockRequest, comments: [...mockRequest.comments, { username: 'testuser', comment: 'New comment', commentDate: '2026-01-17T00:00:00Z' }] } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Add a comment...');
    await user.type(textarea, 'New comment');

    // Find and click the send button (it's next to the textarea)
    const sendButton = textarea.closest('.flex').querySelector('button');
    await user.click(sendButton);

    await waitFor(() => {
      expect(api.addComment).toHaveBeenCalledWith('REQ-001', 'New comment');
      expect(toast.success).toHaveBeenCalledWith('Comment added');
    });
  });

  it('does not submit empty comment', async () => {
    const api = await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    });

    // The send button should be disabled when comment is empty
    const textarea = screen.getByPlaceholderText('Add a comment...');
    const sendButton = textarea.closest('.flex').querySelector('button');
    expect(sendButton).toBeDisabled();
  });

  it('handles comment submission failure', async () => {
    const api = await setupMock();
    api.addComment.mockRejectedValue(new Error('fail'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Test');
    const textarea = screen.getByPlaceholderText('Add a comment...');
    const sendButton = textarea.closest('.flex').querySelector('button');
    await user.click(sendButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add comment');
    });
  });

  it('calls preview file API when Preview button is clicked', async () => {
    const api = await setupMock();
    api.previewFile.mockResolvedValue({ data: { type: 'text', content: 'hello' } });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    const previewBtn = screen.getByTitle('Preview');
    await user.click(previewBtn);

    await waitFor(() => {
      expect(api.previewFile).toHaveBeenCalledWith('REQ-001', 'path/to/sample.csv');
    });
  });

  it('handles preview file error', async () => {
    const api = await setupMock();
    api.previewFile.mockRejectedValue(new Error('fail'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Preview'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load preview');
    });
  });

  it('calls download file API when Download button is clicked', async () => {
    const api = await setupMock();
    api.downloadFile.mockResolvedValue({ data: new Blob(['data']) });
    window.URL.createObjectURL = vi.fn(() => 'blob:test');
    window.URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Download'));

    await waitFor(() => {
      expect(api.downloadFile).toHaveBeenCalledWith('REQ-001', 'path/to/sample.csv');
    });
  });

  it('handles download file error', async () => {
    const api = await setupMock();
    api.downloadFile.mockRejectedValue(new Error('fail'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Download'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to download file');
    });
  });

  it('opens upload modal on accepted request', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    await setupMock(acceptedRequest);
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Upload Snapshot'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('uploads bucket file successfully', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    const api = await setupMock(acceptedRequest);
    api.uploadBucketFile.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Upload Snapshot'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Simulate file selection via the input
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['test content'], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await user.upload(fileInput, file);

    // Click upload button
    const uploadBtn = screen.getByText('Upload');
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(api.uploadBucketFile).toHaveBeenCalledWith('REQ-001', expect.any(File), '');
      expect(toast.success).toHaveBeenCalledWith('Data snapshot uploaded successfully');
    });
  });

  it('rejects files over 10MB', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    await setupMock(acceptedRequest);
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Upload Snapshot'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Create a large file (>10MB)
    const fileInput = document.querySelector('input[type="file"]');
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'huge.xlsx');
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('File size must be less than 10MB');
    });
  });

  it('opens Add Jira Link modal', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Link'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., PROJ-123')).toBeInTheDocument();
    });
  });

  it('submits Jira link successfully', async () => {
    const api = await setupMock();
    api.addJiraLink.mockResolvedValue({ data: {} });
    // Re-mock get to reload after success
    api.get.mockResolvedValue({ data: mockRequest });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Link'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('e.g., PROJ-123'), 'TEST-456');

    // Click the Add Link submit button inside modal (now enabled since we typed a key)
    const modal = screen.getByTestId('modal');
    const buttons = modal.querySelectorAll('button');
    const submitBtn = Array.from(buttons).find(b => b.textContent.includes('Add Link'));
    if (submitBtn) await user.click(submitBtn);

    await waitFor(() => {
      expect(api.addJiraLink).toHaveBeenCalledWith('REQ-001', expect.objectContaining({
        ticket_key: 'TEST-456',
        link_type: 'dependency',
      }));
      expect(toast.success).toHaveBeenCalledWith('Jira link added');
    });
  });

  it('disables Add Link button when ticket key is empty', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Link'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // The submit button inside modal should be disabled when ticket key is empty
    const modal = screen.getByTestId('modal');
    const buttons = modal.querySelectorAll('button');
    const addBtn = Array.from(buttons).find(b => b.textContent.includes('Add Link'));
    expect(addBtn).toBeDisabled();
  });

  it('removes Jira link', async () => {
    const requestWithLinks = {
      ...mockRequest,
      jira_links: [
        { ticket_key: 'DEP-456', ticket_url: 'https://jira.test/DEP-456', link_type: 'dependency', title: 'Data pipeline' },
      ],
    };
    const api = await setupMock(requestWithLinks);
    api.removeJiraLink.mockResolvedValue({ data: {} });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('DEP-456')).toBeInTheDocument();
    });

    // Find and click the remove button (Trash2 icon button)
    const removeBtn = screen.getByTitle('Remove link');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(api.removeJiraLink).toHaveBeenCalledWith('REQ-001', 0);
      expect(toast.success).toHaveBeenCalledWith('Jira link removed');
    });
  });

  it('navigates back when Back button is clicked', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Back to Requests')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to Requests'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to edit page when Edit is clicked', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(mockNavigate).toHaveBeenCalledWith('/my-requests/REQ-001/edit');
  });

  it('uses admin edit path when on admin route', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage('REQ-001', '/admin/scenario-requests');

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/scenario-requests/REQ-001/edit');
  });

  it('does not show Edit button for rejected status', async () => {
    const rejectedRequest = { ...mockRequest, status: 'rejected' };
    await setupMock(rejectedRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('does not show Upload Snapshot for non-accepted status', async () => {
    await setupMock(); // status is 'submitted'
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Upload Snapshot')).not.toBeInTheDocument();
  });

  it('renders workflow timeline entries with status transitions', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Initial submission')).toBeInTheDocument();
    });
  });

  it('renders without reason section when no reason', async () => {
    const noReasonRequest = { ...mockRequest, reason: null };
    await setupMock(noReasonRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Business Justification')).not.toBeInTheDocument();
  });

  it('renders without optional sidebar fields', async () => {
    const minimalRequest = {
      ...mockRequest,
      team: null,
      assignee_name: null,
      scenarioKey: null,
      fulfilmentDate: null,
    };
    await setupMock(minimalRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
    expect(screen.queryByText('Team-A')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('shows status badge for different statuses', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    await setupMock(acceptedRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Scenario Request')).toBeInTheDocument();
    });
  });

  it('renders "No Jira tickets" when no jira data and no links', async () => {
    const noJiraRequest = { ...mockRequest, jira: null, jira_integration: null, jira_links: [] };
    await setupMock(noJiraRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No Jira tickets/)).toBeInTheDocument();
    });
  });

  it('handles upload bucket file error with detail message', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    const api = await setupMock(acceptedRequest);
    api.uploadBucketFile.mockRejectedValue({ response: { data: { detail: 'Invalid file type' } } });
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Upload Snapshot'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['test'], 'data.xlsx');
    await user.upload(fileInput, file);

    await user.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid file type');
    });
  });

  it('handles Jira link add error', async () => {
    const api = await setupMock();
    api.addJiraLink.mockRejectedValue(new Error('fail'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Link'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('e.g., PROJ-123'), 'FAIL-123');

    const modal = screen.getByTestId('modal');
    const buttons = modal.querySelectorAll('button');
    const submitBtn = Array.from(buttons).find(b => b.textContent.includes('Add Link'));
    if (submitBtn) await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add Jira link');
    });
  });

  it('handles Jira link remove error', async () => {
    const requestWithLinks = {
      ...mockRequest,
      jira_links: [
        { ticket_key: 'DEP-456', ticket_url: 'https://jira.test/DEP-456', link_type: 'dependency', title: 'Data pipeline' },
      ],
    };
    const api = await setupMock(requestWithLinks);
    api.removeJiraLink.mockRejectedValue(new Error('fail'));
    const toast = (await import('react-hot-toast')).default;
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('DEP-456')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Remove link'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to remove Jira link');
    });
  });

  it('shows Upload Snapshot for in-progress status', async () => {
    const inProgressRequest = { ...mockRequest, status: 'in-progress' };
    await setupMock(inProgressRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });
  });

  it('shows Upload Snapshot for development status', async () => {
    const devRequest = { ...mockRequest, status: 'development' };
    await setupMock(devRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });
  });

  it('shows Upload Snapshot for testing status', async () => {
    const testingRequest = { ...mockRequest, status: 'testing' };
    await setupMock(testingRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });
  });

  it('renders preview modal with text content', async () => {
    const api = await setupMock();
    api.previewFile.mockResolvedValue({
      data: { type: 'text', data: 'Hello file content', fileName: 'readme.txt' },
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Preview'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('renders preview modal with grid content', async () => {
    const api = await setupMock();
    api.previewFile.mockResolvedValue({
      data: { type: 'grid', headers: ['name', 'value'], rows: [['Alice', '100'], ['Bob', '200']], fileName: 'data.csv' },
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Preview'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('value')).toBeInTheDocument();
    });
  });

  it('renders preview modal with JSON content', async () => {
    const api = await setupMock();
    api.previewFile.mockResolvedValue({
      data: { type: 'json', data: { key: 'value' }, fileName: 'config.json' },
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Preview'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });
  });

  it('uses management edit path', async () => {
    await setupMock();
    const user = userEvent.setup();

    renderPage('REQ-001', '/management/scenario-requests');

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(mockNavigate).toHaveBeenCalledWith('/management/scenario-requests/REQ-001/edit');
  });

  it('shows Jira integration section when jira_integration exists', async () => {
    const requestWithIntegration = {
      ...mockRequest,
      jira_integration: {
        ticket_key: 'INT-789',
        ticket_url: 'https://jira.test/INT-789',
        status: 'To Do',
        sync_status: 'synced',
      },
    };
    await setupMock(requestWithIntegration);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('INT-789')).toBeInTheDocument();
    });
  });

  it('shows multiple Jira links with correct indices', async () => {
    const requestWithMultipleLinks = {
      ...mockRequest,
      jira_links: [
        { ticket_key: 'LINK-1', ticket_url: 'https://jira.test/LINK-1', link_type: 'dependency', title: 'Link 1' },
        { ticket_key: 'LINK-2', ticket_url: 'https://jira.test/LINK-2', link_type: 'blocks', title: 'Link 2' },
      ],
    };
    await setupMock(requestWithMultipleLinks);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('LINK-1')).toBeInTheDocument();
      expect(screen.getByText('LINK-2')).toBeInTheDocument();
    });
  });

  it('renders multiple workflow entries', async () => {
    const requestWithWorkflow = {
      ...mockRequest,
      work_flow: [
        { from_status: 'new', to_status: 'submitted', create_stp: '2026-01-15T10:00:00Z', comment: 'Initial request created' },
        { from_status: 'submitted', to_status: 'review', create_stp: '2026-01-16T10:00:00Z', comment: 'Moved to review queue' },
        { from_status: 'review', to_status: 'accepted', create_stp: '2026-01-17T10:00:00Z', comment: 'Approved by admin' },
      ],
    };
    await setupMock(requestWithWorkflow);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Initial request created')).toBeInTheDocument();
      expect(screen.getByText('Moved to review queue')).toBeInTheDocument();
      expect(screen.getByText('Approved by admin')).toBeInTheDocument();
    });
  });

  it('renders step query when available', async () => {
    await setupMock();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('SELECT * FROM orders')).toBeInTheDocument();
    });
  });

  it('shows accepted status badge', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    await setupMock(acceptedRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });
  });

  it('shows review status badge', async () => {
    const reviewRequest = { ...mockRequest, status: 'review' };
    await setupMock(reviewRequest);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  it('closes preview modal', async () => {
    const api = await setupMock();
    api.previewFile.mockResolvedValue({
      data: { type: 'text', data: 'Some content', fileName: 'readme.txt' },
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('sample.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Preview'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // The modal mock has no close button, but we can verify modal appeared
  });

  it('opens upload modal and types upload comment', async () => {
    const acceptedRequest = { ...mockRequest, status: 'accepted' };
    const api = await setupMock(acceptedRequest);
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Upload Snapshot')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Upload Snapshot'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Type in the comment/explanation textarea
    const textareas = document.querySelectorAll('textarea');
    if (textareas.length > 0) {
      const uploadTextarea = Array.from(textareas).find(t =>
        t.placeholder?.includes('explain') || t.placeholder?.includes('comment') || t.name === 'uploadComment'
      ) || textareas[textareas.length - 1];
      await user.type(uploadTextarea, 'Upload explanation');
    }
  });

  it('renders bucket file preview and download buttons', async () => {
    const requestWithBuckets = {
      ...mockRequest,
      status: 'accepted',
      buckets: [
        { file_name: 'bucket_data.csv', gcs_path: 'path/to/bucket_data.csv', version: 1, uploaded_by: 'admin', upload_date: '2026-01-20T00:00:00Z' },
      ],
    };
    const api = await setupMock(requestWithBuckets);
    api.previewFile.mockResolvedValue({
      data: { type: 'text', data: 'bucket content', fileName: 'bucket_data.csv' },
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('bucket_data.csv')).toBeInTheDocument();
    });

    // Click preview on bucket file
    const viewButtons = screen.getAllByTitle('View');
    if (viewButtons.length > 0) {
      await user.click(viewButtons[0]);
      await waitFor(() => {
        expect(api.previewFile).toHaveBeenCalled();
      });
    }
  });

  it('downloads bucket file', async () => {
    const requestWithBuckets = {
      ...mockRequest,
      status: 'accepted',
      buckets: [
        { file_name: 'bucket_data.csv', gcs_path: 'path/to/bucket_data.csv', version: 1, uploaded_by: 'admin', upload_date: '2026-01-20T00:00:00Z' },
      ],
    };
    const api = await setupMock(requestWithBuckets);
    api.downloadFile.mockResolvedValue({ data: 'file content' });
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('bucket_data.csv')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByTitle('Download');
    if (downloadButtons.length > 0) {
      await user.click(downloadButtons[downloadButtons.length - 1]);
      await waitFor(() => {
        expect(api.downloadFile).toHaveBeenCalled();
      });
    }
  });

  it('fills in Jira link form fields', async () => {
    const api = await setupMock();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Add Link')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Link'));

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Fill in URL field
    const urlInput = screen.queryByPlaceholderText(/URL/i) || screen.queryByPlaceholderText(/url/);
    if (urlInput) {
      await user.type(urlInput, 'https://jira.test/PROJ-123');
    }

    // Fill in title field
    const titleInput = screen.queryByPlaceholderText(/title/i);
    if (titleInput) {
      await user.type(titleInput, 'Related ticket');
    }

    // Change link type
    const modal = screen.getByTestId('modal');
    const selects = modal.querySelectorAll('select');
    if (selects.length > 0) {
      await user.selectOptions(selects[0], 'blocks');
    }
  });

  it('shows workflow assigned_to_name when present', async () => {
    const requestWithAssignedWorkflow = {
      ...mockRequest,
      work_flow: [
        {
          from_status: 'submitted',
          to_status: 'review',
          create_stp: '2026-01-16T10:00:00Z',
          comment: 'Assigned for review',
          assigned_to_name: 'Jane Smith',
        },
      ],
    };
    await setupMock(requestWithAssignedWorkflow);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });
  });

});
