import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DomainDetailPage from '../../../pages/user/DomainDetailPage';

jest.mock('../../../services/api', () => ({
  domainAPI: {
    get: jest.fn(),
  },
  scenarioAPI: {
    getByDomain: jest.fn(),
  },
}));

function renderDomainDetailPage(domainKey = 'finance') {
  return render(
    <MemoryRouter initialEntries={[`/domains/${domainKey}`]}>
      <Routes>
        <Route path="/domains/:domainKey" element={<DomainDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DomainDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    let resolveApi;
    domainAPI.get.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));
    scenarioAPI.getByDomain.mockResolvedValueOnce({ data: [] });

    renderDomainDetailPage();
    // Loading spinner shown
    expect(screen.queryByText('Domain Not Found')).not.toBeInTheDocument();
  });

  it('shows domain not found', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockRejectedValueOnce(new Error('Not found'));
    scenarioAPI.getByDomain.mockRejectedValueOnce(new Error('Not found'));

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Domain Not Found')).toBeInTheDocument();
      expect(screen.getByText("The domain you're looking for doesn't exist.")).toBeInTheDocument();
    });
  });

  it('renders domain details', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockResolvedValueOnce({
      data: { key: 'finance', name: 'Finance', description: 'Financial analytics', status: 'active' },
    });
    scenarioAPI.getByDomain.mockResolvedValueOnce({ data: [] });

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Finance' })).toBeInTheDocument();
      expect(screen.getByText('Financial analytics')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('renders scenarios list', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockResolvedValueOnce({
      data: { key: 'finance', name: 'Finance', status: 'active' },
    });
    scenarioAPI.getByDomain.mockResolvedValueOnce({
      data: [
        { key: 's1', name: 'Revenue Report', description: 'Monthly revenue' },
        { key: 's2', name: 'Expense Tracker' },
      ],
    });

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Revenue Report')).toBeInTheDocument();
      expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
      expect(screen.getByText('Scenarios (2)')).toBeInTheDocument();
    });
  });

  it('shows empty scenarios message', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockResolvedValueOnce({
      data: { key: 'finance', name: 'Finance', status: 'active' },
    });
    scenarioAPI.getByDomain.mockResolvedValueOnce({ data: [] });

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Scenarios (0)')).toBeInTheDocument();
      expect(screen.getByText('No scenarios available for this domain.')).toBeInTheDocument();
    });
  });

  it('renders breadcrumb navigation', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockResolvedValueOnce({
      data: { key: 'finance', name: 'Finance', status: 'active' },
    });
    scenarioAPI.getByDomain.mockResolvedValueOnce({ data: [] });

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Domains')).toBeInTheDocument();
    });
  });

  it('renders domain info section', async () => {
    const { domainAPI, scenarioAPI } = await import('../../../services/api');
    domainAPI.get.mockResolvedValueOnce({
      data: { key: 'finance', name: 'Finance', status: 'A', path: '/finance', order: 1 },
    });
    scenarioAPI.getByDomain.mockResolvedValueOnce({ data: [] });

    renderDomainDetailPage();

    await waitFor(() => {
      expect(screen.getByText('Domain Information')).toBeInTheDocument();
      expect(screen.getByText('/finance')).toBeInTheDocument();
    });
  });
});
