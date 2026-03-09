import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { scenariosAPI, domainsAPI } from '../services/api';

const useScenarioData = (scenarioKey) => {
  const [scenario, setScenario] = useState(null);
  const [playboards, setPlayboards] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [scenarioRes, playboardsRes, domainsRes] = await Promise.all([
        scenariosAPI.get(scenarioKey),
        scenariosAPI.getPlayboards(scenarioKey),
        domainsAPI.list({ limit: 100 })
      ]);
      setScenario(scenarioRes.data);
      setPlayboards(playboardsRes.data || []);
      setDomains(domainsRes.data.data || domainsRes.data || []);
    } catch {
      toast.error('Failed to load scenario details');
    } finally {
      setLoading(false);
    }
  }, [scenarioKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { scenario, playboards, domains, loading, fetchData };
};

export default useScenarioData;
