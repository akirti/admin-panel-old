import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import ThemeSwitcher from '../shared/ThemeSwitcher';
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
  Compass
} from 'lucide-react';
import { Badge } from '../shared';

function MainLayout({ isAdmin = false, isGroupAdmin = false }) {
  const { user, logout, isSuperAdmin, canManageUsers, isEditor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (isAdmin) {
      // Super Admin Panel
      return [
        { path: '/dashboard', icon: Home, label: 'User Dashboard' },
        { path: '/explorer', icon: Compass, label: 'Explorer', dividerAfter: true },
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
        { path: '/admin/api-configs', icon: Plug, label: 'API Configs' },
        { path: '/admin/scenario-requests', icon: ClipboardList, label: 'Scenario Requests' },
        { path: '/admin/feedback', icon: MessageSquare, label: 'Feedback' },
        { path: '/admin/activity-logs', icon: Activity, label: 'Activity Logs' },
        { path: '/admin/error-logs', icon: AlertTriangle, label: 'Error Logs' },
        { path: '/admin/bulk-upload', icon: Upload, label: 'Bulk Upload' },
        { path: '/admin/distribution-lists', icon: Mail, label: 'Distribution Lists' },
      ];
    }

    if (isGroupAdmin) {
      // Group Admin Panel
      return [
        { path: '/dashboard', icon: Home, label: 'User Dashboard' },
        { path: '/explorer', icon: Compass, label: 'Explorer', dividerAfter: true },
        { path: '/management', icon: LayoutDashboard, label: 'Management Dashboard', exact: true },
        { path: '/management/users', icon: Users, label: 'Users Management' },
        { path: '/management/domains', icon: Layers, label: 'Domains' },
        { path: '/management/scenario-requests', icon: ClipboardList, label: 'Scenario Requests' },
      ];
    }

    // Regular User Navigation
    const items = [
      { path: '/dashboard', icon: Home, label: 'Dashboard' },
      { path: '/domains', icon: Layers, label: 'My Domains' },
      { path: '/ask-scenario', icon: MessageSquarePlus, label: 'Ask Scenario' },
      { path: '/my-requests', icon: ClipboardList, label: 'My Requests' },
      { path: '/explorer', icon: Compass, label: 'Explorer' },
      { path: '/profile', icon: User, label: 'Profile' },
      { path: '/feedback', icon: MessageSquare, label: 'Feedback' },
    ];

    // Add admin link for super admins
    if (isSuperAdmin()) {
      items.push({ path: '/admin', icon: Settings, label: 'Admin Panel' });
    } else if (canManageUsers()) {
      items.push({ path: '/management', icon: Settings, label: 'Management' });
    }

    return items;
  };

  const navItems = getNavItems();

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-base-secondary">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-sidebar-bg shadow-sm border-r border-edge transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-edge">
          {sidebarOpen && (
            <span className="text-xl font-bold text-primary-600">
              {isAdmin ? 'Admin Panel' : isGroupAdmin ? 'Management' : 'EasyLife'}
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-surface-hover text-content-secondary"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.path ? isActive(item.path, item.exact) : false;

              return (
                <li key={item.path || item.label}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sidebar-link"
                    >
                      <Icon size={20} />
                      {sidebarOpen && <span>{item.label}</span>}
                    </a>
                  ) : (
                    <Link
                      to={item.path}
                      className={`sidebar-link ${active ? 'active' : ''}`}
                    >
                      <Icon size={20} />
                      {sidebarOpen && <span>{item.label}</span>}
                    </Link>
                  )}
                  {item.dividerAfter && (
                    <div className="my-3 border-t border-edge"></div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Theme Switcher */}
        <div className="px-4 py-2 border-t border-edge">
          <ThemeSwitcher compact={!sidebarOpen} />
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-edge">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover"
            >
              <div className="avatar">
                <User size={20} />
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-content truncate">
                      {user?.full_name || user?.username || 'User'}
                    </p>
                    <p className="text-xs text-content-muted truncate">{user?.email}</p>
                  </div>
                  <ChevronDown size={16} className={`text-content-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-surface rounded-lg shadow-lg border border-edge py-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2 hover:bg-surface-hover text-content-secondary"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User size={16} />
                  <span>Profile</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-16 bg-header-bg shadow-sm border-b border-edge flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-content">
            {isAdmin ? 'Administration' : isGroupAdmin ? 'Management' : 'Welcome'}
          </h1>

          <div className="flex items-center gap-4">
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
