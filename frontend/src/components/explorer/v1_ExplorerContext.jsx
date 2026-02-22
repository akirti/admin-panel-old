import React, { createContext, useContext, useState, useEffect } from 'react';
import { domainAPI, scenarioAPI } from '../../services/api';

const ExplorerContext = createContext(null);

export function ExplorerProvider({ children }) {
  const [domains, setDomains] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [domainsRes, scenariosRes] = await Promise.all([
          domainAPI.getAll(),
          scenarioAPI.getAll(),
        ]);

        const domainData = domainsRes.data?.data || domainsRes.data || [];
        const scenarioData = scenariosRes.data?.data || scenariosRes.data || [];

        // Sort domains by order
        const sortedDomains = [...domainData].sort((a, b) => (a.order || 0) - (b.order || 0));

        setDomains(sortedDomains);
        setScenarios(scenarioData);
      } catch (err) {
        console.error('Failed to load explorer data:', err);
        setError(err.message || 'Failed to load explorer data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getScenariosByDomain = (domainKey) => {
    return scenarios.filter(
      (s) => s.dataDomain?.toLowerCase() === domainKey?.toLowerCase()
    );
  };

  const getDomainByKey = (key) => {
    return domains.find((d) => d.key === key);
  };

  return (
    <ExplorerContext.Provider
      value={{
        domains,
        scenarios,
        loading,
        error,
        getScenariosByDomain,
        getDomainByKey,
      }}
    >
      {children}
    </ExplorerContext.Provider>
  );
}

export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error('useExplorer must be used within an ExplorerProvider');
  }
  return context;
}

export default ExplorerContext;
