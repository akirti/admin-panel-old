import { createContext, useContext, useState, useCallback } from 'react';

const defaultFlags = {
  jiraIntegration: true,
  bulkUpload: true,
  explorer: true,
  feedback: true,
  apiConfigs: true,
  distributionLists: true,
  uiSchemas: true,
  errorLogs: true,
  activityLogs: true,
  prevail: true,
};

const FeatureFlagContext = createContext(null);

export function FeatureFlagProvider({ children, initialFlags }) {
  const [flags, setFlags] = useState({ ...defaultFlags, ...initialFlags });

  const isEnabled = useCallback((flag) => flags[flag] !== false, [flags]);

  const setFlag = useCallback((flag, enabled) => {
    setFlags((prev) => ({ ...prev, [flag]: enabled }));
  }, []);

  const value = { flags, isEnabled, setFlag };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  return context;
}
