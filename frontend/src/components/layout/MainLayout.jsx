import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  Home
} from 'lucide-react';

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
        { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { path: '/admin/users', icon: Users, label: 'Users Management' },
        { path: '/admin/roles', icon: Shield, label: 'Roles Management' },
        { path: '/admin/domains', icon: Layers, label: 'Domains Management' },
        { path: '/admin/scenarios', icon: FileText, label: 'Scenarios Management' },
      ];
    }

    if (isGroupAdmin) {
      // Group Admin Panel
      return [
        { path: '/management', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { path: '/management/users', icon: Users, label: 'Users Management' },
        { path: '/management/domains', icon: Layers, label: 'Domains' },
      ];
    }

    // Regular User Navigation
    const items = [
      { path: '/dashboard', icon: Home, label: 'Dashboard' },
      { path: '/domains', icon: Layers, label: 'My Domains' },
      { path: '/profile', icon: User, label: 'Profile' },
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
    <div className="flex h-screen bg-neutral-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white shadow-sm border-r border-neutral-200 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-200">
          {sidebarOpen && (
            <span className="text-xl font-bold text-red-600">
              {isAdmin ? 'Admin Panel' : isGroupAdmin ? 'Management' : 'EasyLife'}
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                  >
                    <Icon size={20} />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-neutral-200">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100"
            >
              <div className="avatar">
                <User size={20} />
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {user?.full_name || user?.username || 'User'}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown size={16} className={`text-neutral-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-lg shadow-lg border border-neutral-200 py-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-100 text-neutral-700"
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
        <header className="h-16 bg-white shadow-sm border-b border-neutral-200 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-neutral-800">
            {isAdmin ? 'Administration' : isGroupAdmin ? 'Management' : 'Welcome'}
          </h1>
          
          <div className="flex items-center gap-4">
            {/* Role badges */}
            <div className="flex gap-2">
              {user?.roles?.slice(0, 2).map((role) => (
                <span
                  key={role}
                  className="badge badge-primary"
                >
                  {role}
                </span>
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
