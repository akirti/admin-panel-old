import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { scenarioRequestAPI } from '../services/api';

const useRequestData = (requestId) => {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scenarioRequestAPI.get(requestId);
      setRequest(response.data);
    } catch {
      toast.error('Failed to load request');
      navigate('/my-requests');
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  return { request, loading, loadRequest };
};

export default useRequestData;
