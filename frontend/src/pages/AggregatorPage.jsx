import React, { lazy, Suspense } from 'react';
import { getAccessToken } from '../services/api';

const EasyWeaverApp = lazy(() =>
  import('easyweaver-ui').then(mod => ({ default: mod.EasyWeaverApp }))
);

// Use nginx proxy path (same-origin) to avoid CORS issues.
// /weaver-api/* is rewritten to /api/v1/* by nginx and proxied to easyweaver-api.
const WEAVER_API_URL = window.__env?.EASYWEAVER_API_URL || '/weaver-api';

class AggregatorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-red-600">Aggregator failed to load</h2>
          <pre className="bg-surface-secondary p-4 rounded-lg text-sm overflow-auto whitespace-pre-wrap text-content">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const AggregatorPage = () => {
  const getToken = () => getAccessToken();

  return (
    <AggregatorErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      }>
        <EasyWeaverApp
          apiBaseUrl={WEAVER_API_URL}
          getToken={getToken}
          basePath="/aggregator"
        />
      </Suspense>
    </AggregatorErrorBoundary>
  );
};

export default AggregatorPage;
