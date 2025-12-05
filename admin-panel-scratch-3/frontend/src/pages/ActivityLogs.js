import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Badge, SearchInput, Select, Pagination, ExportButton } from '../components/shared';
import { exportAPI } from '../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const activityLogsAPI = {
  list: (params = {}) => axios.get(`${API_BASE_URL}/activity-logs`, {
    params,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }),
  getStats: (days = 7) => axios.get(`${API_BASE_URL}/activity-logs/stats`, {
    params: { days },
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }),
  getActions: () => axios.get(`${API_BASE_URL}/activity-logs/actions`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }),
  getEntityTypes: () => axios.get(`${API_BASE_URL}/activity-logs/entity-types`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  }),
};

const ActivityLogs = () => {
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

  const getActionColor = (action) => {
    const actionColors = {
      create: 'success',
      update: 'info',
      delete: 'danger',
      login: 'primary',
      logout: 'default',
    };
    return actionColors[action] || 'default';
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

  const columns = [
    {
      key: 'timestamp',
      title: 'Time',
      render: (val) => new Date(val).toLocaleString()
    },
    {
      key: 'action',
      title: 'Action',
      render: (val) => <Badge variant={getActionColor(val)}>{val}</Badge>
    },
    {
      key: 'entity_type',
      title: 'Entity Type',
      render: (val) => <Badge variant="info">{val}</Badge>
    },
    {
      key: 'entity_id',
      title: 'Entity ID',
      render: (val) => (
        <span className="font-mono text-sm">{val.length > 20 ? `${val.slice(0, 20)}...` : val}</span>
      )
    },
    {
      key: 'user_email',
      title: 'User',
      render: (val) => <span className="text-sm">{val}</span>
    },
    {
      key: 'changes',
      title: 'Changes',
      render: (val) => (
        <span className="text-xs text-gray-600">{formatChanges(val)}</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-500 mt-1">View and audit all system activities</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton exportFn={exportAPI.activityLogs.csv} format="csv" filters={{ days }} label="Export CSV" />
          <ExportButton exportFn={exportAPI.activityLogs.json} format="json" filters={{ days }} label="Export JSON" />
          <Select
            value={days}
            onChange={(e) => {
              setDays(parseInt(e.target.value));
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            options={[
              { value: 1, label: 'Last 24 Hours' },
              { value: 7, label: 'Last 7 Days' },
              { value: 30, label: 'Last 30 Days' },
              { value: 90, label: 'Last 90 Days' },
              { value: 365, label: 'Last Year' }
            ]}
          />
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Activities</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total_activities}</div>
            <div className="text-xs text-gray-400">Last {stats.period_days} days</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Action Types</div>
            <div className="text-3xl font-bold text-gray-900">{stats.actions.length}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {stats.actions.slice(0, 3).map((a) => (
                <Badge key={a.action} variant={getActionColor(a.action)} size="sm">
                  {a.action} ({a.count})
                </Badge>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Entity Types</div>
            <div className="text-3xl font-bold text-gray-900">{stats.entities.length}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {stats.entities.slice(0, 3).map((e) => (
                <Badge key={e.entity_type} variant="info" size="sm">
                  {e.entity_type} ({e.count})
                </Badge>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Active Users</div>
            <div className="text-3xl font-bold text-gray-900">{stats.top_users.length}</div>
            <div className="text-xs text-gray-400 mt-2">
              Top: {stats.top_users[0]?.user_email || 'N/A'}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SearchInput
            value={userEmail}
            onChange={(val) => {
              setUserEmail(val);
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            placeholder="Filter by user email..."
          />
          <Select
            label="Entity Type"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            options={[
              { value: '', label: 'All Entity Types' },
              ...entityTypes.map(et => ({ value: et, label: et }))
            ]}
          />
          <Select
            label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            options={[
              { value: '', label: 'All Actions' },
              ...actions.map(a => ({ value: a, label: a }))
            ]}
          />
        </div>
      </Card>

      {/* Activity Timeline Chart */}
      {stats && stats.timeline && stats.timeline.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
          <div className="flex items-end space-x-1 h-32">
            {stats.timeline.map((item) => {
              const maxCount = Math.max(...stats.timeline.map(t => t.count));
              const height = (item.count / maxCount) * 100;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                    title={`${item.date}: ${item.count} activities`}
                  />
                  <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table columns={columns} data={logs} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </Card>

      {/* Top Users Table */}
      {stats && stats.top_users && stats.top_users.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Most Active Users</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.top_users.map((user, index) => (
                  <tr key={user.user_email} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{user.user_email}</span>
                        {index === 0 && <Badge variant="primary" size="sm" className="ml-2">Top</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{user.count}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${(user.count / stats.total_activities) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {((user.count / stats.total_activities) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ActivityLogs;
