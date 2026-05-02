import { lazy, Suspense } from 'react';
import { getAccessToken, setAccessToken, authAPI } from '../../services/api';
import { JIRA_API_URL } from '../../config/env';

const JiraDashboard = lazy(() =>
  import('jira-dashboard').then(mod => ({ default: mod.JiraDashboard }))
);

const JiraDashboardPage = () => {
  // Async token provider: returns in-memory token if available,
  // otherwise fetches a fresh one via login session cookies.
  const getToken = async () => {
    const existing = getAccessToken();
    if (existing) return existing;

    // No in-memory token (page was reloaded) — get a fresh one
    try {
      const response = await authAPI.getProfile();
      // Profile endpoint doesn't return a token, but if we got here
      // the session cookies are valid. Try refresh.
      const refreshResp = await authAPI.refresh();
      if (refreshResp.data?.access_token) {
        setAccessToken(refreshResp.data.access_token);
        return refreshResp.data.access_token;
      }
    } catch {
      // Fall through — token unavailable
    }
    return null;
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
