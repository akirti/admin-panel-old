import { useState, useEffect, useCallback, useRef } from 'react';
import { usersAPI } from '../services/api';

const useAssignedCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasAssigned, setHasAssigned] = useState(false);
  const allCustomersRef = useRef([]);
  const debounceRef = useRef(null);

  // Fetch all assigned customers and tags on mount
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [custRes, tagsRes] = await Promise.all([
          usersAPI.getAssignedCustomers(),
          usersAPI.getCustomerTags(),
        ]);
        if (cancelled) return;

        const custData = custRes.data?.customers || [];
        allCustomersRef.current = custData;
        setCustomers(custData);
        setHasAssigned(custData.length > 0);
        setTags(tagsRes.data?.tags || []);
      } catch {
        if (!cancelled) {
          setCustomers([]);
          setTags([]);
          setHasAssigned(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Search with debounce - filters from server for accuracy
  const search = useCallback((term) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!term || !term.trim()) {
      setCustomers(allCustomersRef.current);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await usersAPI.getAssignedCustomers({ search: term.trim() });
        setCustomers(res.data?.customers || []);
      } catch {
        // Keep current list on error
      }
    }, 300);
  }, []);

  // Filter by tag - client-side from cached list
  const filterByTag = useCallback((tag) => {
    if (!tag) {
      setCustomers(allCustomersRef.current);
      return;
    }
    setCustomers(
      allCustomersRef.current.filter((c) => c.tags && c.tags.includes(tag))
    );
  }, []);

  return { customers, tags, loading, hasAssigned, search, filterByTag };
};

export default useAssignedCustomers;
