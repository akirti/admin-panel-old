import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Filter, User, Activity, TrendingUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { activityLogsAPI, exportAPI } from '../../services/api';
import { ExportButton } from '../../components/shared';

const ActivityLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [days, setDays] = useState(7);
  const [actions, setActions] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes, actionsRes, entityTypesRes] = await Promise.all([
        activityLogsAPI.list({
          page: pagination.page,
          limit: pagination.limit,
          user_email: userEmail || undefined,
          entity_type: entityType || undefined,
          action: action || undefined,
          days: days || undefined
        }),
        activityLogsAPI.getStats(days),
        activityLogsAPI.getActions(),
        activityLogsAPI.getEntityTypes()
      ]);

      setLogs(logsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(logsRes.data.pagination || {}) }));
      setStats(statsRes.data);
      setActions(actionsRes.data.actions || []);
      setEntityTypes(entityTypesRes.data.entity_types || []);
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [userEmail, entityType, action, days, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getActionColor = (actionType) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      login: 'bg-purple-100 text-purple-800',
      logout: 'bg-neutral-100 text-neutral-800',
    };
    return colors[actionType] || 'bg-neutral-100 text-neutral-800';
  };

  const formatChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return 'No details';
    return Object.entries(changes).map(([key, value]) => {
      if (typeof value === 'object' && value.old !== undefined && value.new !== undefined) {
        return `${key}: ${value.old} → ${value.new}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    }).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Activity Logs</h1>
          <p className="text-neutral-500 mt-1">View and audit all system activities</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            exportFn={exportAPI.activityLogs.csv}
            format="csv"
            filters={{ days }}
            label="Export CSV"
          />
          <ExportButton
            exportFn={exportAPI.activityLogs.json}
            format="json"
            filters={{ days }}
            label="Export JSON"
          />
          <select
            value={days}
            onChange={(e) => {
              setDays(parseInt(e.target.value));
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            className="px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last Year</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Activity size={20} className="text-red-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Total Activities</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.total_activities}</div>
              </div>
            </div>
            <div className="text-xs text-neutral-400 mt-2">Last {stats.period_days} days</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Action Types</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.actions?.length || 0}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {stats.actions?.slice(0, 3).map((a) => (
                <span key={a.action} className={`text-xs px-2 py-0.5 rounded ${getActionColor(a.action)}`}>
                  {a.action} ({a.count})
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Filter size={20} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Entity Types</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.entities?.length || 0}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {stats.entities?.slice(0, 3).map((e) => (
                <span key={e.entity_type} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {e.entity_type}
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User size={20} className="text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">Active Users</div>
                <div className="text-2xl font-bold text-neutral-900">{stats.top_users?.length || 0}</div>
              </div>
            </div>
            <div className="text-xs text-neutral-400 mt-2 truncate">
              Top: {stats.top_users?.[0]?.user_email || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">User Email</label>
            <input
              type="text"
              value={userEmail}
              onChange={(e) => {
                setUserEmail(e.target.value);
                setPagination(prev => ({ ...prev, page: 0 }));
              }}
              placeholder="Filter by user email..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPagination(prev => ({ ...prev, page: 0 }));
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Entity Types</option>
              {entityTypes.map(et => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPagination(prev => ({ ...prev, page: 0 }));
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Actions</option>
              {actions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline Chart */}
      {stats?.timeline && stats.timeline.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
          <div className="flex items-end space-x-1 h-32">
            {stats.timeline.map((item) => {
              const maxCount = Math.max(...stats.timeline.map(t => t.count));
              const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-red-500 rounded-t hover:bg-red-600 transition-colors"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                    title={`${item.date}: ${item.count} activities`}
                  />
                  <span className="text-xs text-neutral-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-left">Time</th>
                  <th className="px-6 py-3 text-left">Action</th>
                  <th className="px-6 py-3 text-left">Entity Type</th>
                  <th className="px-6 py-3 text-left">Entity ID</th>
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Changes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-neutral-600">
                          {log.entity_id?.length > 20 ? `${log.entity_id.slice(0, 20)}...` : log.entity_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {log.user_email}
                      </td>
                      <td className="px-6 py-4 text-xs text-neutral-600 max-w-xs truncate">
                        {formatChanges(log.changes)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-neutral-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-700">
                Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 0}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages - 1}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
