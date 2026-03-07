import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DashboardPage from './DashboardPage';

const mockUser = {
  full_name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  roles: ['user'],
  groups: ['group1'],
  domains: ['domain1'],
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isSuperAdmin: vi.fn(() => false),
    canManageUsers: vi.fn(() => false),
    isEditor: vi.fn(() => false),
  }),
}));

vi.mock('../../services/api', () => ({
  domainAPI: {
    getAll: vi.fn(),
  },
  scenarioRequestAPI: {
    getStats: vi.fn(),
  },
}));

function renderDashboardPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome message with user name', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText(/Welcome back, Test User!/)).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [{ key: 'd1', name: 'Domain 1' }] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 5, submitted: 2, inProgress: 1, deployed: 2, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getAllByText('My Requests').length).toBeGreaterThan(0);
    });
  });

  it('renders quick action links', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText('Ask Scenario')).toBeInTheDocument();
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
  });

  it('shows no domains message when empty', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No domains available. Contact your administrator.')).toBeInTheDocument();
    });
  });

  it('renders domain cards when domains exist', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [
      { key: 'd1', name: 'Finance' },
      { key: 'd2', name: 'HR' },
    ] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
    });
  });

  it('renders recent requests when available', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: {
      total: 1, submitted: 1, inProgress: 0, deployed: 0,
      recent: [{ requestId: 'REQ-001', name: 'Test Request', status: 'submitted' }]
    } });

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Recent Requests')).toBeInTheDocument();
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('Test Request')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockRejectedValueOnce(new Error('API Error'));
    scenarioRequestAPI.getStats.mockRejectedValueOnce(new Error('API Error'));

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No domains available. Contact your administrator.')).toBeInTheDocument();
    });
  });

  it('displays user access info', async () => {
    const { domainAPI, scenarioRequestAPI } = await import('../../services/api');
    domainAPI.getAll.mockResolvedValueOnce({ data: [] });
    scenarioRequestAPI.getStats.mockResolvedValueOnce({ data: { total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: [] } });

    renderDashboardPage();
    expect(screen.getByText('Your Access')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
