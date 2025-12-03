import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI, domainAPI, scenarioAPI } from '../../services/api';
import { Users, Layers, FileText, Shield, ArrowRight, TrendingUp } from 'lucide-react';

function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({
    users: 0,
    domains: 0,
    scenarios: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, domainsRes, scenariosRes] = await Promise.all([
          adminAPI.getUsers({ limit: 10 }),
          domainAPI.getAll(),
          scenarioAPI.getAll(),
        ]);

        setStats({
          users: usersRes.data.pagination?.total || 0,
          domains: domainsRes.data.length,
          scenarios: scenariosRes.data.length,
        });

        setRecentUsers(usersRes.data.data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.users,
      icon: Users,
      link: isSuperAdmin() ? '/admin/users' : '/management/users',
    },
    {
      title: 'Domains',
      value: stats.domains,
      icon: Layers,
      link: isSuperAdmin() ? '/admin/domains' : '/management/domains',
    },
    {
      title: 'Scenarios',
      value: stats.scenarios,
      icon: FileText,
      link: isSuperAdmin() ? '/admin/scenarios' : null,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">
          {isSuperAdmin() ? 'Admin Dashboard' : 'Management Dashboard'}
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          const content = (
            <div className="stat-card hover:shadow-md hover:border-red-200 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">{stat.title}</p>
                  <p className="stat-value">{stat.value}</p>
                </div>
                <div className="stat-icon">
                  <Icon size={24} />
                </div>
              </div>
              {stat.link && (
                <div className="mt-4 pt-4 border-t border-neutral-200 flex items-center justify-between text-sm">
                  <span className="text-neutral-500">View all</span>
                  <ArrowRight size={16} className="text-neutral-400" />
                </div>
              )}
            </div>
          );

          return stat.link ? (
            <Link key={stat.title} to={stat.link}>
              {content}
            </Link>
          ) : (
            <div key={stat.title}>{content}</div>
          );
        })}
      </div>

      {/* Recent Users */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="section-title">Recent Users</h2>
          <Link
            to={isSuperAdmin() ? '/admin/users' : '/management/users'}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            View all →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Roles</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user._id} className="table-row">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        {(user.full_name || user.username || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-800">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-sm text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.slice(0, 2).map((role) => (
                        <span key={role} className="badge badge-primary">
                          {role}
                        </span>
                      ))}
                      {user.roles?.length > 2 && (
                        <span className="badge badge-neutral">
                          +{user.roles.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${user.is_active ? 'badge-success' : 'bg-red-100 text-red-700'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to={isSuperAdmin() ? '/admin/users' : '/management/users'}
          className="card hover:shadow-md hover:border-red-200 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-800 group-hover:text-red-600 transition-colors">
                Manage Users
              </h3>
              <p className="text-sm text-neutral-500">Add, edit, or deactivate users</p>
            </div>
            <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
          </div>
        </Link>

        {isSuperAdmin() && (
          <Link
            to="/admin/roles"
            className="card hover:shadow-md hover:border-red-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                <Shield size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-800 group-hover:text-red-600 transition-colors">
                  Manage Roles
                </h3>
                <p className="text-sm text-neutral-500">Configure role permissions</p>
              </div>
              <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
