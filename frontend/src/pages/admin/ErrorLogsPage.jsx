import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  TrendingUp,
  Archive,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { errorLogsAPI } from '../../services/api';

const ErrorLogsPage = () => {
  const [activeTab, setActiveTab] = useState('current');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Filters
  const [level, setLevel] = useState('');
  const [errorType, setErrorType] = useState('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(7);
  const [levels, setLevels] = useState(['ERROR', 'WARNING', 'CRITICAL']);
  const [errorTypes, setErrorTypes] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Expanded rows for stack traces
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Current file info
  const [fileInfo, setFileInfo] = useState(null);

  const fetchCurrentLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes, levelsRes, typesRes] = await Promise.all([
        errorLogsAPI.list({
          page: pagination.page,
          limit: pagination.limit,
          level: level || undefined,
          error_type: errorType || undefined,
          search: search || undefined,
          days: days || undefined
        }),
        errorLogsAPI.getStats(days),
        errorLogsAPI.getLevels(),
        errorLogsAPI.getTypes()
      ]);

      setLogs(logsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(logsRes.data.pagination || {}) }));
      setStats(statsRes.data);
      setLevels(levelsRes.data.levels || ['ERROR', 'WARNING', 'CRITICAL']);
      setErrorTypes(typesRes.data.types || []);
    } catch (error) {
      toast.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [level, errorType, search, days, pagination.page, pagination.limit]);

  const fetchArchives = useCallback(async () => {
    try {
      setArchiveLoading(true);
      const [archivesRes, fileRes] = await Promise.all([
        errorLogsAPI.listArchives(),
        errorLogsAPI.getCurrentFile(10)
      ]);
      setArchives(archivesRes.data.archives || []);
      setFileInfo(fileRes.data);
    } catch (error) {
      toast.error('Failed to load archives');
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'current') {
      fetchCurrentLogs();
    } else {
      fetchArchives();
    }
  }, [activeTab, fetchCurrentLogs, fetchArchives]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getLevelColor = (levelType) => {
    const colors = {
      ERROR: 'bg-red-100 text-red-800',
      WARNING: 'bg-amber-100 text-amber-800',
      CRITICAL: 'bg-purple-100 text-purple-800',
    };
    return colors[levelType] || 'bg-surface-hover text-neutral-800';
  };

  const getLevelIcon = (levelType) => {
    switch (levelType) {
      case 'ERROR':
        return <XCircle size={16} />;
      case 'WARNING':
        return <AlertTriangle size={16} />;
      case 'CRITICAL':
        return <AlertCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const handleDownloadArchive = async (archiveId) => {
    try {
      const response = await errorLogsAPI.getArchiveDownloadUrl(archiveId);
      window.open(response.data.download_url, '_blank');
    } catch (error) {
      toast.error('Failed to get download URL');
    }
  };

  const handleDeleteArchive = async (archiveId) => {
    if (!confirm('Are you sure you want to delete this archive? This action cannot be undone.')) {
      return;
    }

    try {
      await errorLogsAPI.deleteArchive(archiveId);
      toast.success('Archive deleted successfully');
      fetchArchives();
    } catch (error) {
      toast.error('Failed to delete archive');
    }
  };

  const handleForceArchive = async () => {
    if (!confirm('Archive current log file to GCS? This will clear the current log file.')) {
      return;
    }

    try {
      const response = await errorLogsAPI.forceArchive();
      if (response.data.archived) {
        toast.success('Log file archived successfully');
        fetchArchives();
      } else {
        toast.info(response.data.message || 'No logs to archive');
      }
    } catch (error) {
      toast.error('Failed to archive logs');
    }
  };

  const handleCleanup = async () => {
    const daysToKeep = prompt('Delete archives older than how many days?', '90');
    if (!daysToKeep) return;

    try {
      const response = await errorLogsAPI.cleanup(parseInt(daysToKeep));
      toast.success(`Deleted ${response.data.deleted_count} old archives`);
      fetchArchives();
    } catch (error) {
      toast.error('Failed to cleanup archives');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content">Error Logs</h1>
          <p className="text-content-muted mt-1">View and manage application error logs</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => {
              setDays(parseInt(e.target.value));
              setPagination(prev => ({ ...prev, page: 0 }));
            }}
            className="px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last Year</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-edge">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'current'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-content-muted hover:text-content-secondary hover:border-edge'
            }`}
          >
            <AlertCircle size={16} className="inline mr-2" />
            Current Logs
          </button>
          <button
            onClick={() => setActiveTab('archives')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'archives'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-content-muted hover:text-content-secondary hover:border-edge'
            }`}
          >
            <Archive size={16} className="inline mr-2" />
            Archives
          </button>
        </nav>
      </div>

      {activeTab === 'current' ? (
        <>
          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle size={20} className="text-red-600" />
                  </div>
                  <div>
                    <div className="text-sm text-content-muted">Total Errors</div>
                    <div className="text-2xl font-bold text-content">{stats.total || 0}</div>
                  </div>
                </div>
                <div className="text-xs text-content-muted mt-2">Last {stats.days} days</div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <div className="text-sm text-content-muted">By Level</div>
                    <div className="text-2xl font-bold text-content">
                      {Object.keys(stats.by_level || {}).length}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(stats.by_level || {}).slice(0, 3).map(([lvl, count]) => (
                    <span key={lvl} className={`text-xs px-2 py-0.5 rounded ${getLevelColor(lvl)}`}>
                      {lvl}: {count}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-content-muted">Error Types</div>
                    <div className="text-2xl font-bold text-content">
                      {stats.by_type?.length || 0}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-content-muted mt-2 truncate">
                  Top: {stats.by_type?.[0]?.type || 'N/A'}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm text-content-muted">Today</div>
                    <div className="text-2xl font-bold text-content">
                      {stats.timeline?.length > 0 ? stats.timeline[stats.timeline.length - 1]?.count || 0 : 0}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-content-muted mt-2">errors today</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Search</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination(prev => ({ ...prev, page: 0 }));
                  }}
                  placeholder="Search in message or stack trace..."
                  className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Level</label>
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value);
                    setPagination(prev => ({ ...prev, page: 0 }));
                  }}
                  className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Levels</option>
                  {levels.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Error Type</label>
                <select
                  value={errorType}
                  onChange={(e) => {
                    setErrorType(e.target.value);
                    setPagination(prev => ({ ...prev, page: 0 }));
                  }}
                  className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Types</option>
                  {errorTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Timeline Chart */}
          {stats?.timeline && stats.timeline.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Error Timeline</h3>
              <div className="flex items-end space-x-1 h-32">
                {stats.timeline.map((item) => {
                  const maxCount = Math.max(...stats.timeline.map(t => t.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-red-500 rounded-t hover:bg-red-600 transition-colors cursor-pointer"
                        style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                        title={`${item.date}: ${item.count} errors`}
                      />
                      <span className="text-xs text-content-muted mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-edge">
                  <thead>
                    <tr className="table-header">
                      <th className="px-4 py-3 text-left w-8"></th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Level</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Message</th>
                      <th className="px-4 py-3 text-left">Request</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-edge">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-content-muted">
                          No error logs found
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <React.Fragment key={log._id}>
                          <tr
                            className="hover:bg-surface-hover cursor-pointer"
                            onClick={() => toggleRow(log._id)}
                          >
                            <td className="px-4 py-4">
                              {log.stack_trace && (
                                expandedRows.has(log._id) ? (
                                  <ChevronUp size={16} className="text-content-muted" />
                                ) : (
                                  <ChevronDown size={16} className="text-content-muted" />
                                )
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-content">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getLevelColor(log.level)}`}>
                                {getLevelIcon(log.level)}
                                {log.level}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-mono">
                                {log.error_type}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-content max-w-md truncate">
                              {log.message}
                            </td>
                            <td className="px-4 py-4 text-xs text-content-muted">
                              {log.request_context?.method && (
                                <span className="font-mono">
                                  {log.request_context.method} {log.request_context.path}
                                </span>
                              )}
                            </td>
                          </tr>
                          {expandedRows.has(log._id) && log.stack_trace && (
                            <tr>
                              <td colSpan={6} className="px-4 py-4 bg-surface-secondary">
                                <div className="text-sm">
                                  <div className="font-medium text-content-secondary mb-2">Stack Trace:</div>
                                  <pre className="text-xs bg-neutral-900 text-neutral-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                                    {log.stack_trace}
                                  </pre>
                                  {log.request_context && Object.keys(log.request_context).length > 0 && (
                                    <div className="mt-4">
                                      <div className="font-medium text-content-secondary mb-2">Request Context:</div>
                                      <pre className="text-xs bg-surface-hover p-4 rounded overflow-x-auto">
                                        {JSON.stringify(log.request_context, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-surface px-4 py-3 border-t border-edge sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-content-secondary">
                    Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 0}
                      className="px-3 py-1 border border-edge rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages - 1}
                      className="px-3 py-1 border border-edge rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Archives Tab */
        <>
          {/* Current File Info */}
          {fileInfo && (
            <div className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-surface-hover rounded-lg">
                    <HardDrive size={24} className="text-content-muted" />
                  </div>
                  <div>
                    <div className="font-medium text-content">Current Log File</div>
                    <div className="text-sm text-content-muted">
                      {formatBytes(fileInfo.file_size_mb * 1024 * 1024)} / {fileInfo.max_size_mb} MB (archives at {fileInfo.max_size_mb} MB)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleForceArchive}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Archive size={16} />
                    Force Archive
                  </button>
                  <button
                    onClick={handleCleanup}
                    className="flex items-center gap-2 px-4 py-2 border border-edge rounded-md hover:bg-surface-hover transition-colors"
                  >
                    <Trash2 size={16} />
                    Cleanup Old
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-4">
                <div className="w-full bg-base-secondary rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((fileInfo.file_size_mb / fileInfo.max_size_mb) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Archives List */}
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
              <h3 className="font-medium text-content">Archived Log Files</h3>
              <button
                onClick={fetchArchives}
                className="flex items-center gap-1 text-sm text-content-muted hover:text-content"
              >
                <RefreshCw size={16} className={archiveLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {archiveLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : archives.length === 0 ? (
              <div className="px-6 py-8 text-center text-content-muted">
                No archived log files found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-edge">
                  <thead>
                    <tr className="table-header">
                      <th className="px-6 py-3 text-left">File Name</th>
                      <th className="px-6 py-3 text-left">Date Range</th>
                      <th className="px-6 py-3 text-left">Errors</th>
                      <th className="px-6 py-3 text-left">Size</th>
                      <th className="px-6 py-3 text-left">Created</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-edge">
                    {archives.map((archive) => (
                      <tr key={archive.archive_id} className="hover:bg-surface-hover">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-content">
                          {archive.file_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                          {archive.date_range?.start ? (
                            <>
                              {new Date(archive.date_range.start).toLocaleDateString()} - {new Date(archive.date_range.end).toLocaleDateString()}
                            </>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">
                            {archive.error_count} errors
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                          <div>{formatBytes(archive.compressed_size)}</div>
                          <div className="text-xs text-content-muted">
                            ({formatBytes(archive.original_size)} uncompressed)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                          {new Date(archive.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadArchive(archive.archive_id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Download"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteArchive(archive.archive_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ErrorLogsPage;
