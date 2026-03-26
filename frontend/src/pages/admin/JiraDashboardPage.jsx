import { lazy, Suspense } from 'react';
import { getAccessToken } from '../../services/api';

const JiraDashboard = lazy(() =>
  import('jira-dashboard').then(mod => ({ default: mod.JiraDashboard }))
);

const JIRA_API_URL = window.__ENV__?.JIRA_API_URL || 'http://localhost:8001/api/v1';

const JiraDashboardPage = () => {
  // Return the in-memory access token directly — no network call needed.
  // The token is already managed by api.js interceptors (login/refresh).
  const getToken = () => getAccessToken();

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
