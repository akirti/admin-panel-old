import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import ThemeSwitcher from '../shared/ThemeSwitcher';
import Breadcrumbs from '../shared/Breadcrumbs';
import {
  LayoutDashboard,
  Users,
  Shield,
  Layers,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Home,
  MessageSquarePlus,
  MessageSquare,
  ClipboardList,
  UsersRound,
  Activity,
  AlertTriangle,
  Upload,
  Key,
  Cog,
  LayoutGrid,
  Building2,
  Plug,
  Mail,
  Compass,
  LayoutTemplate
} from 'lucide-react';
import { Badge } from '../shared';
import FontSizeControl from '../shared/FontSizeControl';

const ADMIN_NAV = [
  { path: '/dashboard', icon: Home, label: 'User Dashboard' },
  { path: '/explorer', icon: Compass, label: 'Explorer', dividerAfter: true, featureFlag: 'explorer' },
  { path: '/admin', icon: LayoutDashboard, label: 'Admin Dashboard', exact: true },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/roles', icon: Shield, label: 'Roles' },
  { path: '/admin/groups', icon: UsersRound, label: 'Groups' },
  { path: '/admin/permissions', icon: Key, label: 'Permissions' },
  { path: '/admin/customers', icon: Building2, label: 'Customers' },
  { path: '/admin/domains', icon: Layers, label: 'Domains' },
  { path: '/admin/scenarios', icon: FileText, label: 'Scenarios' },
  { path: '/admin/playboards', icon: LayoutGrid, label: 'Playboards' },
  { path: '/admin/configurations', icon: Cog, label: 'Configurations' },
  { path: '/admin/api-configs', icon: Plug, label: 'API Configs', featureFlag: 'apiConfigs' },
  { path: '/admin/scenario-requests', icon: ClipboardList, label: 'Scenario Requests' },
  { path: '/admin/feedback', icon: MessageSquare, label: 'Feedback', featureFlag: 'feedback' },
  { path: '/admin/activity-logs', icon: Activity, label: 'Activity Logs', featureFlag: 'activityLogs' },
  { path: '/admin/error-logs', icon: AlertTriangle, label: 'Error Logs', featureFlag: 'errorLogs' },
  { path: '/admin/bulk-upload', icon: Upload, label: 'Bulk Upload', featureFlag: 'bulkUpload' },
  { path: '/admin/distribution-lists', icon: Mail, label: 'Distribution Lists', featureFlag: 'distributionLists' },
  { path: '/admin/jira-dashboard', icon: LayoutDashboard, label: 'Jira Dashboard', featureFlag: 'jiraIntegration' },
  { path: '/admin/ui-schemas', icon: LayoutTemplate, label: 'UI Schemas', dividerBefore: true, featureFlag: 'uiSchemas' },
];

const GROUP_ADMIN_NAV_BASE = [
  { path: '/dashboard', icon: Home, label: 'User Dashboard' },
  { path: '/explorer', icon: Compass, label: 'Explorer', dividerAfter: true },
  { path: '/management', icon: LayoutDashboard, label: 'Management Dashboard', exact: true },
  { path: '/management/users', icon: Users, label: 'Users Management' },
  { path: '/management/domains', icon: Layers, label: 'Domains' },
  { path: '/management/scenario-requests', icon: ClipboardList, label: 'Scenario Requests' },
];

const getGroupAdminNav = (hasGroup) => {
  const items = [...GROUP_ADMIN_NAV_BASE];
  if (hasGroup && hasGroup('ui-management')) {
    items.push({ path: '/management/ui-schemas', icon: LayoutTemplate, label: 'UI Schemas' });
  }
  return items;
};

const USER_NAV = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/domains', icon: Layers, label: 'My Domains' },
  { path: '/ask-scenario', icon: MessageSquarePlus, label: 'Ask Scenario' },
  { path: '/my-requests', icon: ClipboardList, label: 'My Requests' },
  { path: '/explorer', icon: Compass, label: 'Explorer', featureFlag: 'explorer' },
  { path: '/profile', icon: User, label: 'Profile' },
  { path: '/feedback', icon: MessageSquare, label: 'Feedback', featureFlag: 'feedback' },
];

const getUserNav = (isSuperAdmin, canManageUsers, canAccessUISchemas) => {
  const items = [...USER_NAV];
  if (canAccessUISchemas()) {
    items.push({ path: '/ui-schemas', icon: LayoutTemplate, label: 'UI Schemas', dividerBefore: true });
  }
  if (isSuperAdmin()) {
    items.push({ path: '/admin', icon: Settings, label: 'Admin Panel' });
  } else if (canManageUsers()) {
    items.push({ path: '/management', icon: Settings, label: 'Management' });
  }
  return items;
};

function getNavItems(isAdmin, isGroupAdmin, isSuperAdmin, canManageUsers, hasGroup, canAccessUISchemas) {
  if (isAdmin) return ADMIN_NAV;
  if (isGroupAdmin) return getGroupAdminNav(hasGroup);
  return getUserNav(isSuperAdmin, canManageUsers, canAccessUISchemas);
}

function getPanelTitle(isAdmin, isGroupAdmin) {
  if (isAdmin) return 'Admin Panel';
  if (isGroupAdmin) return 'Management';
  return 'EasyLife';
}

function getHeaderTitle(isAdmin, isGroupAdmin) {
  if (isAdmin) return 'Administration';
  if (isGroupAdmin) return 'Management';
  return 'Welcome';
}

const ENV_LABELS = {
  dev: 'Development', development: 'Development',
  qa: 'QA',
  stg: 'Stage', stage: 'Stage',
  prd: 'Production', prod: 'Production', production: 'Production',
  local: 'Local',
};

const ENV_COLORS = {
  Development: 'bg-amber-100 text-amber-800 border-amber-300',
  QA: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  Stage: 'bg-purple-100 text-purple-800 border-purple-300',
  Production: 'bg-red-100 text-red-800 border-red-300',
  Local: 'bg-green-100 text-green-800 border-green-300',
};

function EnvironmentBadge() {
  const raw = (window.__env?.ENV || '').toLowerCase().trim();
  if (!raw) return null;
  const label = ENV_LABELS[raw] || raw;
  const color = ENV_COLORS[label] || 'bg-surface-hover text-content-muted border-edge';
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${color}`}>
      {label}
    </span>
  );
}

function NavItem({ item, isActive, sidebarOpen, iconSize }) {
  const Icon = item.icon;
  const active = item.path ? isActive(item.path, item.exact) : false;

  const linkContent = (
    <>
      <Icon size={iconSize} className="shrink-0" />
      {sidebarOpen && <span>{item.label}</span>}
    </>
  );

  const activeClass = active ? 'active' : '';
  const alignClass = !sidebarOpen ? 'justify-center' : '';

  return (
    <li key={item.path || item.label}>
      {item.dividerBefore && (
        <div className="my-3 border-t border-edge"></div>
      )}
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`sidebar-link ${alignClass}`}
          title={!sidebarOpen ? item.label : undefined}
        >
          {linkContent}
        </a>
      ) : (
        <Link
          to={item.path}
          className={`sidebar-link ${activeClass} ${alignClass}`}
          aria-current={active ? "page" : undefined}
          title={!sidebarOpen ? item.label : undefined}
        >
          {linkContent}
        </Link>
      )}
      {item.dividerAfter && (
        <div className="my-3 border-t border-edge"></div>
      )}
    </li>
  );
}

function SidebarUserMenu({ user, sidebarOpen, iconSize, userMenuOpen, setUserMenuOpen, onLogout }) {
  return (
    <div className="p-4 border-t border-edge">
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          aria-label="User menu"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
          className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover min-w-0 ${!sidebarOpen ? 'justify-center' : ''}`}
        >
          <div className="avatar shrink-0">
            <User size={iconSize} />
          </div>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-content truncate">
                  {user?.full_name || user?.username || 'User'}
                </p>
                <p className="text-xs text-content-muted truncate">{user?.email}</p>
              </div>
              <ChevronDown size={16} className={`shrink-0 text-content-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-0 w-full mb-2 bg-surface rounded-lg shadow-lg border border-edge py-2" role="menu" aria-label="User options">
            <Link
              to="/profile"
              className="flex items-center gap-2 px-4 py-2 hover:bg-surface-hover text-content-secondary"
              onClick={() => setUserMenuOpen(false)}
              role="menuitem"
            >
              <User size={16} />
              <span>Profile</span>
            </Link>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600"
              role="menuitem"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MainLayout({ isAdmin = false, isGroupAdmin = false }) {
  const { user, logout, isSuperAdmin, canManageUsers, hasGroup, hasAnyPermission, hasAccessToDomain, hasAnyRole } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const canAccessUISchemas = () => {
    const hasRole = hasAnyRole(['super-administrator', 'administrator', 'group-administrator']);
    const hasPerm = hasAnyPermission(['ui_template.read', 'ui_template.write', 'ui_template.edit', 'ui_template.delete']);
    const hasDomain = hasAccessToDomain('ui_template');
    return hasRole && hasPerm && hasDomain;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = getNavItems(isAdmin, isGroupAdmin, isSuperAdmin, canManageUsers, hasGroup, canAccessUISchemas);
  const filteredNavItems = navItems.filter((item) => !item.featureFlag || isEnabled(item.featureFlag));

  // Auto-collapse main sidebar when Explorer is active (Explorer has its own domain sidebar)
  const isExplorerActive = location.pathname.startsWith('/explorer');
  const effectiveSidebarOpen = isExplorerActive ? mobileMenuOpen : sidebarOpen;
  const iconSize = effectiveSidebarOpen ? 20 : 24;

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary-600 focus:text-white focus:top-0 focus:left-0">
      Skip to main content
    </a>
    <div className="flex h-screen bg-base-secondary">
      {/* Sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className={`fixed inset-0 bg-black/50 z-40 ${isExplorerActive ? '' : 'md:hidden'}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${effectiveSidebarOpen ? 'w-64' : 'w-20'}
          bg-sidebar-bg shadow-sm border-r border-edge transition-all duration-300 flex flex-col
          fixed ${isExplorerActive ? '' : 'md:static'} inset-y-0 left-0 z-50
          ${mobileMenuOpen ? 'translate-x-0' : isExplorerActive ? '-translate-x-full' : '-translate-x-full md:translate-x-0'}
        `}
        role="complementary"
        aria-label="Sidebar"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-edge">
          {effectiveSidebarOpen && (
            <span className="text-xl font-bold text-primary-600">
              {getPanelTitle(isAdmin, isGroupAdmin)}
            </span>
          )}
          {!isExplorerActive && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-surface-hover text-content-secondary"
              aria-label={effectiveSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={effectiveSidebarOpen}
              aria-controls="sidebar-nav"
            >
              {effectiveSidebarOpen ? <X size={20} /> : <Menu size={24} />}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav id="sidebar-nav" className="flex-1 py-4 px-3 overflow-y-auto" aria-label="Main navigation">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavItem
                key={item.path || item.label}
                item={item}
                isActive={isActive}
                sidebarOpen={effectiveSidebarOpen}
                iconSize={iconSize}
              />
            ))}
          </ul>
        </nav>

        {/* Theme Switcher */}
        <div className="px-4 py-2 border-t border-edge">
          <ThemeSwitcher compact={!effectiveSidebarOpen} />
        </div>

        {/* User Info */}
        <SidebarUserMenu
          user={user}
          sidebarOpen={effectiveSidebarOpen}
          iconSize={iconSize}
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto" id="main-content">
        {/* Header */}
        <header className="h-16 bg-header-bg shadow-sm border-b border-edge flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              className={`${isExplorerActive ? '' : 'md:hidden '}p-2 rounded-lg hover:bg-surface-hover text-content-secondary`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-semibold text-content">
              {getHeaderTitle(isAdmin, isGroupAdmin)}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <EnvironmentBadge />
            <FontSizeControl compact />
            {/* Role badges */}
            <div className="flex gap-2">
              {user?.roles?.slice(0, 2).map((role) => (
                <Badge key={role} variant="primary">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
    </div>
    </>
  );
}

export default MainLayout;
