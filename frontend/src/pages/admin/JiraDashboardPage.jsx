import { lazy, Suspense } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const JiraDashboard = lazy(() =>
  import('jira-dashboard').then(mod => ({ default: mod.JiraDashboard }))
);

const JIRA_API_URL = window.__ENV__?.JIRA_API_URL || 'http://localhost:8001/api/v1';

const JiraDashboardPage = () => {
  const { user } = useAuth();

  // Pass the current access token - the cookie-based auth means we need to
  // get the token from the cookie or use a token endpoint
  const getToken = async () => {
    // The main frontend uses httpOnly cookies, so we extract from api interceptor
    // For jira-api (separate service), we need a Bearer token
    // Use the refresh endpoint to get a fresh access token
    try {
      const { default: api } = await import('../../services/api');
      const res = await api.post('/auth/token');
      return res.data?.access_token;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content">Jira Dashboard</h1>
        <p className="text-content-muted text-sm mt-1">Agile team activity and task management</p>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }>
        <JiraDashboard apiBaseUrl={JIRA_API_URL} getToken={getToken} />
      </Suspense>
    </div>
  );
};

export default JiraDashboardPage;
