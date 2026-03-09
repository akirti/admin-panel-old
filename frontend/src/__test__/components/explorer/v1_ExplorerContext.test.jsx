import { render, screen, waitFor } from '@testing-library/react';
import { ExplorerProvider, useExplorer } from '../../../components/explorer/v1_ExplorerContext';

jest.mock('../../../services/api', () => ({
  domainAPI: {
    getAll: jest.fn(),
  },
  scenarioAPI: {
    getAll: jest.fn(),
  },
}));

import { domainAPI, scenarioAPI } from '../../../services/api';

// Test component to consume context
function TestConsumer() {
  const { domains, scenarios, loading, error, getScenariosByDomain, getDomainByKey } = useExplorer();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div data-testid="domain-count">{domains.length}</div>
      <div data-testid="scenario-count">{scenarios.length}</div>
      {domains.map(d => (
        <div key={d.key} data-testid={`domain-${d.key}`}>{d.name}</div>
      ))}
      <div data-testid="domain-by-key">{getDomainByKey('d1')?.name || 'not found'}</div>
      <div data-testid="scenarios-by-domain">{getScenariosByDomain('d1').length}</div>
    </div>
  );
}

describe('ExplorerContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides loading state initially', () => {
    domainAPI.getAll.mockReturnValue(new Promise(Function.prototype)); // never resolves
    scenarioAPI.getAll.mockReturnValue(new Promise(Function.prototype));

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('loads domains and scenarios', async () => {
    domainAPI.getAll.mockResolvedValue({
      data: [
        { key: 'd1', name: 'Domain 1', order: 2 },
        { key: 'd2', name: 'Domain 2', order: 1 },
      ],
    });
    scenarioAPI.getAll.mockResolvedValue({
      data: [
        { key: 's1', name: 'Scenario 1', dataDomain: 'd1' },
        { key: 's2', name: 'Scenario 2', dataDomain: 'd2' },
      ],
    });

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('domain-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('scenario-count')).toHaveTextContent('2');
    // Domains should be sorted by order
    expect(screen.getByTestId('domain-d2')).toHaveTextContent('Domain 2');
  });

  it('handles getScenariosByDomain', async () => {
    domainAPI.getAll.mockResolvedValue({
      data: [{ key: 'd1', name: 'Domain 1' }],
    });
    scenarioAPI.getAll.mockResolvedValue({
      data: [
        { key: 's1', dataDomain: 'd1' },
        { key: 's2', dataDomain: 'd2' },
      ],
    });

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('scenarios-by-domain')).toHaveTextContent('1');
    });
  });

  it('handles getDomainByKey', async () => {
    domainAPI.getAll.mockResolvedValue({
      data: [{ key: 'd1', name: 'My Domain' }],
    });
    scenarioAPI.getAll.mockResolvedValue({ data: [] });

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('domain-by-key')).toHaveTextContent('My Domain');
    });
  });

  it('handles API error', async () => {
    domainAPI.getAll.mockRejectedValue(new Error('API failure'));
    scenarioAPI.getAll.mockRejectedValue(new Error('API failure'));

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Error: API failure')).toBeInTheDocument();
    });
  });

  it('throws error when useExplorer is used outside provider', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(Function.prototype);

    expect(() => render(<TestConsumer />)).toThrow(
      'useExplorer must be used within an ExplorerProvider'
    );

    spy.mockRestore();
  });

  it('handles nested data format (data.data)', async () => {
    domainAPI.getAll.mockResolvedValue({
      data: { data: [{ key: 'd1', name: 'Nested Domain' }] },
    });
    scenarioAPI.getAll.mockResolvedValue({
      data: { data: [] },
    });

    render(
      <ExplorerProvider>
        <TestConsumer />
      </ExplorerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('domain-d1')).toHaveTextContent('Nested Domain');
    });
  });
});
