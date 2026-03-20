import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// Route-to-label mapping
const ROUTE_LABELS = {
  'dashboard': 'Dashboard',
  'admin': 'Admin',
  'management': 'Management',
  'users': 'Users',
  'roles': 'Roles',
  'groups': 'Groups',
  'permissions': 'Permissions',
  'customers': 'Customers',
  'domains': 'Domains',
  'scenarios': 'Scenarios',
  'playboards': 'Playboards',
  'configurations': 'Configurations',
  'api-configs': 'API Configs',
  'scenario-requests': 'Scenario Requests',
  'feedback': 'Feedback',
  'activity-logs': 'Activity Logs',
  'error-logs': 'Error Logs',
  'bulk-upload': 'Bulk Upload',
  'distribution-lists': 'Distribution Lists',
  'ui-schemas': 'UI Schemas',
  'explorer': 'Explorer',
  'profile': 'Profile',
  'ask-scenario': 'Ask Scenario',
  'my-requests': 'My Requests',
  'edit': 'Edit',
};

function buildCrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = [{ label: 'Home', path: '/dashboard' }];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = ROUTE_LABELS[segment] || decodeURIComponent(segment);
    crumbs.push({ label, path: currentPath });
  }

  return crumbs;
}

const Breadcrumbs = memo(function Breadcrumbs() {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);

  // Don't show on dashboard or explorer (explorer has its own domain sidebar nav)
  if (location.pathname === '/dashboard') return null;
  if (location.pathname.startsWith('/explorer')) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-content-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {index > 0 && <ChevronRight size={14} className="text-content-muted" aria-hidden="true" />}
              {isLast ? (
                <span className="font-medium text-content" aria-current="page">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="hover:text-primary-600 transition-colors">
                  {index === 0 ? <Home size={14} className="inline" /> : crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

export default Breadcrumbs;
