import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, scenarioRequestAPI } from '../../services/api';
import {
  Users, Layers, FileText, Shield, ArrowRight, TrendingUp,
  ClipboardList, Clock, CheckCircle, XCircle, Settings,
  Upload, Database, Key, Building
} from 'lucide-react';
import toast from 'react-hot-toast';

function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentLogins, setRecentLogins] = useState([]);
  const [requestStats, setRequestStats] = useState({
    total: 0,
    submitted: 0,
    inProgress: 0,
    deployed: 0,
    rejected: 0,
    recent: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, summaryRes, loginsRes, analyticsRes, requestsRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getSummary(),
          dashboardAPI.getRecentLogins(5),
          dashboardAPI.getAnalytics(),
          scenarioRequestAPI.getStats()
        ]);
        setStats(statsRes.data);
        setSummary(summaryRes.data);
        setRecentLogins(loginsRes.data.recent_logins || []);
        setAnalytics(analyticsRes.data);
        setRequestStats(requestsRes.data || {
          total: 0, submitted: 0, inProgress: 0, deployed: 0, rejected: 0, recent: []
        });
      } catch (error) {
        toast.error('Failed to load dashboard data');
        console.error('Dashboard error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isSuperAdmin() ? 'Admin Dashboard' : 'Management Dashboard'}
        </h1>
        <p className="text-gray-500 mt-1">Overview of your admin panel</p>
      </div>

      {/* Stats Grid - Row 1: Users & Access Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to={isSuperAdmin() ? '/admin/users' : '/management/users'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_users || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Users size={24} />
            </div>
          </div>
        </Link>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-green-600">{stats?.active_users || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </div>
        <Link to={isSuperAdmin() ? '/admin/roles' : '#'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Roles</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_roles || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <Shield size={24} />
            </div>
          </div>
        </Link>
        <Link to={isSuperAdmin() ? '/admin/groups' : '#'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Groups</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_groups || 0}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <Users size={24} />
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Grid - Row 2: Domains, Scenarios, Playboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to={isSuperAdmin() ? '/admin/domains' : '/management/domains'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Domains</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_domains || 0}</p>
            </div>
            <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
              <Layers size={24} />
            </div>
          </div>
        </Link>
        <Link to={isSuperAdmin() ? '/admin/scenarios' : '#'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Scenarios</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_scenarios || 0}</p>
            </div>
            <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center text-pink-600">
              <FileText size={24} />
            </div>
          </div>
        </Link>
        <Link to={isSuperAdmin() ? '/admin/playboards' : '#'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Playboards</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_playboards || 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
              <Database size={24} />
            </div>
          </div>
        </Link>
        <Link to={isSuperAdmin() ? '/admin/configurations' : '#'} className="card p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Configurations</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_configurations || 0}</p>
            </div>
            <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-600">
              <Settings size={24} />
            </div>
          </div>
        </Link>
      </div>

      {/* Request Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="text-blue-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Submitted</p>
            <p className="text-xl font-bold text-blue-600">{requestStats.submitted}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <TrendingUp className="text-yellow-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">In Progress</p>
            <p className="text-xl font-bold text-yellow-600">{requestStats.inProgress}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Deployed</p>
            <p className="text-xl font-bold text-green-600">{requestStats.deployed}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="text-red-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Rejected</p>
            <p className="text-xl font-bold text-red-600">{requestStats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Trend Chart */}
          {analytics.activity_trend && analytics.activity_trend.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Trend (Last 7 Days)</h3>
              <div className="flex items-end space-x-2 h-48">
                {analytics.activity_trend.map((item) => {
                  const maxCount = Math.max(...analytics.activity_trend.map(t => t.count), 1);
                  const height = (item.count / maxCount) * 100;
                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center">
                      <div className="text-xs font-medium text-gray-900 mb-1">{item.count}</div>
                      <div
                        className="w-full bg-red-500 rounded-t hover:bg-red-600 transition-colors"
                        style={{ height: `${height}%`, minHeight: item.count > 0 ? '8px' : '0' }}
                        title={`${item.date}: ${item.count} activities`}
                      />
                      <span className="text-xs text-gray-500 mt-2">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Role Distribution */}
          {analytics.role_distribution && analytics.role_distribution.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h3>
              <div className="space-y-3">
                {analytics.role_distribution.slice(0, 5).map((role) => {
                  const total = analytics.role_distribution.reduce((sum, r) => sum + r.count, 0);
                  const percentage = total > 0 ? ((role.count / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={role.role}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 truncate">{role.role}</span>
                        <span className="text-sm text-gray-500">{role.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Active Users & Recent Signups */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Active Users */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Active Users (Last 7 Days)</h3>
            <div className="space-y-3">
              {(!analytics.top_active_users || analytics.top_active_users.length === 0) ? (
                <p className="text-gray-500 text-center py-4">No activity data available</p>
              ) : (
                analytics.top_active_users.map((user, index) => (
                  <div key={user.user_email} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        <span className="font-medium text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{user.user_email}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600">{user.activities} activities</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent User Signups */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent User Signups</h3>
            <div className="space-y-3">
              {(!analytics.recent_signups || analytics.recent_signups.length === 0) ? (
                <p className="text-gray-500 text-center py-4">No recent signups</p>
              ) : (
                analytics.recent_signups.map((signup, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                        <span className="text-green-700 font-medium text-sm">
                          {signup.full_name?.charAt(0) || signup.email?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{signup.full_name || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{signup.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {signup.created_at ? new Date(signup.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configurations Overview */}
      {summary?.configurations && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Configurations Overview</h3>
            <Link to="/admin/configurations" className="text-sm text-red-600 hover:text-red-700">
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{stats?.total_configurations || 0}</div>
              <div className="text-sm text-gray-500">Total Configs</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary?.configurations?.['process-config'] || 0}</div>
              <div className="text-sm text-gray-500">Process</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary?.configurations?.['lookup-data'] || 0}</div>
              <div className="text-sm text-gray-500">Lookup</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{summary?.configurations?.['gcs-data'] || 0}</div>
              <div className="text-sm text-gray-500">GCS Files</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summary?.configurations?.['snapshot-data'] || 0}</div>
              <div className="text-sm text-gray-500">Snapshot</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Summary */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Entity Status Summary</h3>
          <div className="space-y-4">
            {summary && Object.entries(summary)
              .filter(([key]) => !key.includes('module') && !key.includes('configurations'))
              .map(([entity, statusData]) => (
                <div key={entity} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600 capitalize">{entity}</span>
                  <div className="flex items-center space-x-3">
                    <span className="badge badge-success">{statusData.active || 0} Active</span>
                    <span className="badge bg-red-100 text-red-700">{statusData.inactive || 0} Inactive</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Logins */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Logins</h3>
          <div className="space-y-3">
            {recentLogins.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent logins</p>
            ) : (
              recentLogins.map((login, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                      <span className="text-red-700 font-medium text-sm">
                        {login.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{login.full_name}</p>
                      <p className="text-xs text-gray-500">{login.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {login.last_login ? new Date(login.last_login).toLocaleString() : 'Never'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link
            to={isSuperAdmin() ? '/admin/users' : '/management/users'}
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <Users className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Add User</span>
          </Link>
          <Link
            to="/admin/roles"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <Shield className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Manage Roles</span>
          </Link>
          <Link
            to="/admin/permissions"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <Key className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Permissions</span>
          </Link>
          <Link
            to="/admin/configurations"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <Settings className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Configurations</span>
          </Link>
          <Link
            to="/admin/bulk-upload"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <Upload className="w-8 h-8 text-red-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Bulk Upload</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
