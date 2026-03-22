import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, XCircle, TrendingUp,
  Archive, Download, Trash2, RefreshCw,
  ChevronDown, ChevronUp, HardDrive, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { errorLogsAPI, systemLogsAPI } from '../../services/api';

/* ─── helpers (outside component) ─── */

const LEVEL_COLORS = {
  ERROR: 'bg-red-100 text-red-800',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-purple-100 text-purple-800',
};

function getLevelColor(levelType) {
  return LEVEL_COLORS[levelType] || 'bg-surface-hover text-neutral-800';
}

const LEVEL_ICONS = {
  ERROR: <XCircle size={16} />,
  WARNING: <AlertTriangle size={16} />,
  CRITICAL: <AlertCircle size={16} />,
};

function getLevelIcon(levelType) {
  return LEVEL_ICONS[levelType] || <AlertCircle size={16} />;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ─── Error Stats Cards ─── */
function ErrorStatsCards({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg"><AlertCircle size={20} className="text-red-600" /></div>
          <div>
            <div className="text-sm text-content-muted">Total Errors</div>
            <div className="text-2xl font-bold text-content">{stats.total || 0}</div>
          </div>
        </div>
        <div className="text-xs text-content-muted mt-2">Last {stats.days} days</div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle size={20} className="text-amber-600" /></div>
          <div>
            <div className="text-sm text-content-muted">By Level</div>
            <div className="text-2xl font-bold text-content">{Object.keys(stats.by_level || {}).length}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(stats.by_level || {}).slice(0, 3).map(([lvl, count]) => (
            <span key={lvl} className={`text-xs px-2 py-0.5 rounded ${getLevelColor(lvl)}`}>{lvl}: {count}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp size={20} className="text-blue-600" /></div>
          <div>
            <div className="text-sm text-content-muted">Error Types</div>
            <div className="text-2xl font-bold text-content">{stats.by_type?.length || 0}</div>
          </div>
        </div>
        <div className="text-xs text-content-muted mt-2 truncate">Top: {stats.by_type?.[0]?.type || 'N/A'}</div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg"><Clock size={20} className="text-purple-600" /></div>
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
  );
}

/* ─── Filters ─── */
function ErrorFilters({ search, setSearch, level, setLevel, levels, errorType, setErrorType, errorTypes, setPagination }) {
  const resetPage = () => setPagination(prev => ({ ...prev, page: 0 }));
  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Search</label>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder="Search in message or stack trace..." className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Level</label>
          <select value={level} onChange={(e) => { setLevel(e.target.value); resetPage(); }} className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Levels</option>
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Error Type</label>
          <select value={errorType} onChange={(e) => { setErrorType(e.target.value); resetPage(); }} className="w-full px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Types</option>
            {errorTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ─── Error Timeline Chart ─── */
function ErrorTimelineChart({ timeline }) {
  if (!timeline || timeline.length === 0) return null;
  const maxCount = Math.max(...timeline.map(t => t.count));
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Error Timeline</h3>
      <div className="flex items-end space-x-1 h-32">
        {timeline.map((item) => {
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
  );
}

/* ─── Log Row (single table row with expand) ─── */
function LogRow({ log, isExpanded, onToggle }) {
  return (
    <React.Fragment>
      <tr className="hover:bg-surface-hover cursor-pointer" onClick={() => onToggle(log._id)}>
        <td className="px-4 py-4">
          {log.stack_trace && (
            isExpanded ? <ChevronUp size={16} className="text-content-muted" /> : <ChevronDown size={16} className="text-content-muted" />
          )}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-content">{new Date(log.timestamp).toLocaleString()}</td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getLevelColor(log.level)}`}>
            {getLevelIcon(log.level)}{log.level}
          </span>
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-mono">{log.error_type}</span>
        </td>
        <td className="px-4 py-4 text-sm text-content max-w-md truncate">{log.message}</td>
        <td className="px-4 py-4 text-xs text-content-muted">
          {log.request_context?.method && (
            <span className="font-mono">{log.request_context.method} {log.request_context.path}</span>
          )}
        </td>
      </tr>
      {isExpanded && log.stack_trace && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-surface-secondary">
            <ExpandedLogDetail log={log} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

function ExpandedLogDetail({ log }) {
  return (
    <div className="text-sm">
      <div className="font-medium text-content-secondary mb-2">Stack Trace:</div>
      <pre className="text-xs bg-neutral-900 text-neutral-100 p-4 rounded overflow-x-auto whitespace-pre-wrap">{log.stack_trace}</pre>
      {log.request_context && Object.keys(log.request_context).length > 0 && (
        <div className="mt-4">
          <div className="font-medium text-content-secondary mb-2">Request Context:</div>
          <pre className="text-xs bg-surface-hover p-4 rounded overflow-x-auto">{JSON.stringify(log.request_context, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/* ─── Error Logs Table ─── */
function ErrorLogsTable({ loading, logs, expandedRows, toggleRow, pagination, handlePageChange }) {
  return (
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
                <tr><td colSpan={6} className="px-6 py-8 text-center text-content-muted">No error logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <LogRow key={log._id} log={log} isExpanded={expandedRows.has(log._id)} onToggle={toggleRow} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {pagination.pages > 1 && (
        <div className="bg-surface px-4 py-3 border-t border-edge sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-content-secondary">
              Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 0} className="px-3 py-1 border border-edge rounded text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.pages - 1} className="px-3 py-1 border border-edge rounded text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Archives Tab Content ─── */
function ArchivesContent({ fileInfo, archives, archiveLoading, onForceArchive, onCleanup, onDownloadArchive, onDeleteArchive, onRefresh }) {
  return (
    <>
      {fileInfo && <CurrentFileInfo fileInfo={fileInfo} onForceArchive={onForceArchive} onCleanup={onCleanup} />}
      <ArchivesList archives={archives} archiveLoading={archiveLoading} onDownloadArchive={onDownloadArchive} onDeleteArchive={onDeleteArchive} onRefresh={onRefresh} />
    </>
  );
}

function CurrentFileInfo({ fileInfo, onForceArchive, onCleanup }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface-hover rounded-lg"><HardDrive size={24} className="text-content-muted" /></div>
          <div>
            <div className="font-medium text-content">Current Log File</div>
            <div className="text-sm text-content-muted">
              {formatBytes(fileInfo.file_size_mb * 1024 * 1024)} / {fileInfo.max_size_mb} MB (archives at {fileInfo.max_size_mb} MB)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onForceArchive} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"><Archive size={16} />Force Archive</button>
          <button onClick={onCleanup} className="flex items-center gap-2 px-4 py-2 border border-edge rounded-md hover:bg-surface-hover transition-colors"><Trash2 size={16} />Cleanup Old</button>
        </div>
      </div>
      <div className="mt-4">
        <div className="w-full bg-base-secondary rounded-full h-2">
          <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${Math.min((fileInfo.file_size_mb / fileInfo.max_size_mb) * 100, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function ArchivesList({ archives, archiveLoading, onDownloadArchive, onDeleteArchive, onRefresh }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
        <h3 className="font-medium text-content">Archived Log Files</h3>
        <button onClick={onRefresh} className="flex items-center gap-1 text-sm text-content-muted hover:text-content">
          <RefreshCw size={16} className={archiveLoading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>
      {archiveLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : archives.length === 0 ? (
        <div className="px-6 py-8 text-center text-content-muted">No archived log files found</div>
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
                <ArchiveRow key={archive.archive_id} archive={archive} onDownload={onDownloadArchive} onDelete={onDeleteArchive} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ArchiveRow({ archive, onDownload, onDelete }) {
  return (
    <tr className="hover:bg-surface-hover">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-content">{archive.file_name}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
        {archive.date_range?.start ? (
          <>{new Date(archive.date_range.start).toLocaleDateString()} - {new Date(archive.date_range.end).toLocaleDateString()}</>
        ) : 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">{archive.error_count} errors</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
        <div>{formatBytes(archive.compressed_size)}</div>
        <div className="text-xs text-content-muted">({formatBytes(archive.original_size)} uncompressed)</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">{new Date(archive.created_at).toLocaleString()}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button onClick={() => onDownload(archive.archive_id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Download"><Download size={16} /></button>
          <button onClick={() => onDelete(archive.archive_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete"><Trash2 size={16} /></button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Header with days selector ─── */
function ErrorLogsHeader({ days, onDaysChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-content">Error Logs</h1>
        <p className="text-content-muted mt-1">View and manage application error logs</p>
      </div>
      <div className="flex items-center gap-2">
        <select value={days} onChange={onDaysChange} className="px-3 py-2 border border-edge rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value={1}>Last 24 Hours</option>
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>Last Year</option>
        </select>
      </div>
    </div>
  );
}

/* ─── Tab Navigation ─── */
function ErrorLogsTabs({ activeTab, onTabChange }) {
  const getTabClass = (tab) => {
    const base = 'py-2 px-1 border-b-2 font-medium text-sm';
    if (activeTab === tab) return `${base} border-primary-500 text-primary-600`;
    return `${base} border-transparent text-content-muted hover:text-content-secondary hover:border-edge`;
  };
  return (
    <div className="border-b border-edge">
      <nav className="-mb-px flex space-x-8">
        <button onClick={() => onTabChange('current')} className={getTabClass('current')}>
          <AlertCircle size={16} className="inline mr-2" />Current Logs
        </button>
        <button onClick={() => onTabChange('system')} className={getTabClass('system')}>
          <HardDrive size={16} className="inline mr-2" />System Log
        </button>
        <button onClick={() => onTabChange('archives')} className={getTabClass('archives')}>
          <Archive size={16} className="inline mr-2" />Archives
        </button>
      </nav>
    </div>
  );
}

/* ─── Current Logs Tab ─── */
function CurrentLogsTab({ stats, search, setSearch, level, setLevel, levels, errorType, setErrorType, errorTypes, setPagination, loading, logs, expandedRows, toggleRow, pagination, handlePageChange }) {
  return (
    <>
      <ErrorStatsCards stats={stats} />
      <ErrorFilters search={search} setSearch={setSearch} level={level} setLevel={setLevel} levels={levels} errorType={errorType} setErrorType={setErrorType} errorTypes={errorTypes} setPagination={setPagination} />
      <ErrorTimelineChart timeline={stats?.timeline} />
      <ErrorLogsTable loading={loading} logs={logs} expandedRows={expandedRows} toggleRow={toggleRow} pagination={pagination} handlePageChange={handlePageChange} />
    </>
  );
}

/* ─── Extracted archive action handlers (outside component) ─── */

async function downloadArchive(archiveId) {
  try {
    const response = await errorLogsAPI.getArchiveDownloadUrl(archiveId);
    window.open(response.data.download_url, '_blank');
  } catch { toast.error('Failed to get download URL'); }
}

async function deleteArchive(archiveId, onSuccess) {
  if (!confirm('Are you sure you want to delete this archive? This action cannot be undone.')) return;
  try {
    await errorLogsAPI.deleteArchive(archiveId);
    toast.success('Archive deleted successfully');
    onSuccess();
  } catch { toast.error('Failed to delete archive'); }
}

async function forceArchive(onSuccess) {
  if (!confirm('Archive current log file to GCS? This will clear the current log file.')) return;
  try {
    const response = await errorLogsAPI.forceArchive();
    const message = response.data.archived ? 'Log file archived successfully' : (response.data.message || 'No logs to archive');
    const toastFn = response.data.archived ? toast.success : toast.info;
    toastFn(message);
    if (response.data.archived) onSuccess();
  } catch { toast.error('Failed to archive logs'); }
}

async function cleanupArchives(onSuccess) {
  const daysToKeep = prompt('Delete archives older than how many days?', '90');
  if (!daysToKeep) return;
  try {
    const response = await errorLogsAPI.cleanup(parseInt(daysToKeep));
    toast.success(`Deleted ${response.data.deleted_count} old archives`);
    onSuccess();
  } catch { toast.error('Failed to cleanup archives'); }
}

function toggleExpandedRow(expandedRows, id, setExpandedRows) {
  const newExpanded = new Set(expandedRows);
  if (newExpanded.has(id)) { newExpanded.delete(id); }
  else { newExpanded.add(id); }
  setExpandedRows(newExpanded);
}

/* ─── System Log Tab ─── */
function useSystemLogData() {
  const [entries, setEntries] = useState([]);
  const [files, setFiles] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { lines: 500 };
      if (selectedFile) params.filename = selectedFile;
      if (levelFilter) params.level = levelFilter;
      if (searchFilter) params.search = searchFilter;
      const res = await systemLogsAPI.list(params);
      setEntries(res.data.entries || []);
    } catch { toast.error('Failed to load system logs'); }
    finally { setLoading(false); }
  }, [selectedFile, levelFilter, searchFilter]);

  const fetchMeta = useCallback(async () => {
    try {
      const [filesRes, configRes] = await Promise.all([
        systemLogsAPI.listFiles(),
        systemLogsAPI.getConfig(),
      ]);
      setFiles(filesRes.data.files || []);
      setConfig(configRes.data);
    } catch { /* silent */ }
  }, []);

  return { entries, files, config, loading, selectedFile, setSelectedFile,
           levelFilter, setLevelFilter, searchFilter, setSearchFilter,
           fetchLogs, fetchMeta };
}

function SystemLogConfigBar({ config }) {
  if (!config) return null;
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-content-muted">Level: <strong className="text-content">{config.log_level}</strong></span>
        <span className="text-content-muted">Dir: <strong className="text-content font-mono text-xs">{config.log_dir}</strong></span>
        <span className="text-content-muted">Max: <strong className="text-content">{config.max_file_size_mb} MB</strong></span>
        <span className="text-content-muted">Backups: <strong className="text-content">{config.backup_count}</strong></span>
        <span className="text-content-muted">Format: <strong className="text-content">{config.json_format ? 'JSON' : 'Text'}</strong></span>
      </div>
    </div>
  );
}

function SystemLogFilters({ files, selectedFile, setSelectedFile, levelFilter, setLevelFilter,
                            searchFilter, setSearchFilter, onRefresh, onDownload, onPushGcs, loading }) {
  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}
                className="px-3 py-2 border border-edge rounded-md text-sm">
          <option value="">Current Log</option>
          {files.map(f => <option key={f.name} value={f.name}>{f.name} ({formatBytes(f.size_bytes)})</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 border border-edge rounded-md text-sm">
          <option value="">All Levels</option>
          {['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map(l =>
            <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
               placeholder="Search logs..." className="px-3 py-2 border border-edge rounded-md text-sm" />
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 border border-edge rounded-md hover:bg-surface-hover" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onDownload} className="p-2 border border-edge rounded-md hover:bg-surface-hover text-blue-600" title="Download">
            <Download size={16} />
          </button>
          <button onClick={onPushGcs} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
            <Archive size={14} />Push to GCS
          </button>
        </div>
      </div>
    </div>
  );
}

const SYSTEM_LOG_LEVEL_COLORS = {
  DEBUG: 'text-neutral-500',
  INFO: 'text-blue-600',
  WARNING: 'text-amber-600',
  ERROR: 'text-red-600',
  CRITICAL: 'text-purple-600',
};

function SystemLogEntries({ entries, loading }) {
  if (loading) {
    return <div className="card flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>;
  }
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto font-mono text-xs bg-neutral-900 text-neutral-100">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No log entries found</div>
        ) : (
          <table className="min-w-full">
            <thead className="sticky top-0 bg-neutral-800">
              <tr>
                <th className="px-3 py-2 text-left text-neutral-400">Time</th>
                <th className="px-3 py-2 text-left text-neutral-400 w-20">Level</th>
                <th className="px-3 py-2 text-left text-neutral-400">Logger</th>
                <th className="px-3 py-2 text-left text-neutral-400">Message</th>
                <th className="px-3 py-2 text-left text-neutral-400">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                  <td className="px-3 py-1.5 whitespace-nowrap text-neutral-400">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '-'}
                  </td>
                  <td className={`px-3 py-1.5 font-bold ${SYSTEM_LOG_LEVEL_COLORS[entry.level] || ''}`}>
                    {entry.level}
                  </td>
                  <td className="px-3 py-1.5 text-neutral-500 truncate max-w-[150px]">{entry.logger || '-'}</td>
                  <td className="px-3 py-1.5 text-neutral-200 max-w-md">
                    <div className="truncate">{entry.message}</div>
                    {entry.exception && (
                      <pre className="mt-1 text-red-400 whitespace-pre-wrap text-[10px] max-h-24 overflow-y-auto">{entry.exception}</pre>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-neutral-500 whitespace-nowrap">
                    {entry.request_method && <span>{entry.request_method} {entry.request_path}</span>}
                    {entry.duration_ms != null && <span className="ml-2 text-neutral-600">{entry.duration_ms}ms</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SystemLogTab() {
  const data = useSystemLogData();

  useEffect(() => { data.fetchMeta(); }, [data.fetchMeta]);
  useEffect(() => { data.fetchLogs(); }, [data.fetchLogs]);

  const handleDownload = async () => {
    try {
      const filename = data.selectedFile || data.config?.log_filename || 'system.log';
      const res = await systemLogsAPI.download(filename);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download log file'); }
  };

  const handlePushGcs = async () => {
    if (!confirm('Push current log file to GCS errors/ folder?')) return;
    try {
      const filename = data.selectedFile || undefined;
      const res = await systemLogsAPI.pushToGcs(filename);
      if (res.data.pushed) toast.success(`Pushed to GCS: ${res.data.gcs_path}`);
      else toast(res.data.message || 'GCS not configured');
    } catch { toast.error('Failed to push to GCS'); }
  };

  return (
    <>
      <SystemLogConfigBar config={data.config} />
      <SystemLogFilters
        files={data.files} selectedFile={data.selectedFile} setSelectedFile={data.setSelectedFile}
        levelFilter={data.levelFilter} setLevelFilter={data.setLevelFilter}
        searchFilter={data.searchFilter} setSearchFilter={data.setSearchFilter}
        onRefresh={data.fetchLogs} onDownload={handleDownload} onPushGcs={handlePushGcs}
        loading={data.loading}
      />
      <SystemLogEntries entries={data.entries} loading={data.loading} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
/* ─── Current logs data hook ─── */
function useCurrentLogsData(level, errorType, search, days, pagination, setPagination) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState(['ERROR', 'WARNING', 'CRITICAL']);
  const [errorTypes, setErrorTypes] = useState([]);

  const fetchCurrentLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes, levelsRes, typesRes] = await Promise.all([
        errorLogsAPI.list({ page: pagination.page, limit: pagination.limit, level: level || undefined, error_type: errorType || undefined, search: search || undefined, days: days || undefined }),
        errorLogsAPI.getStats(days),
        errorLogsAPI.getLevels(),
        errorLogsAPI.getTypes()
      ]);
      setLogs(logsRes.data.data || []);
      setPagination(prev => ({ ...prev, ...(logsRes.data.pagination || {}) }));
      setStats(statsRes.data);
      setLevels(levelsRes.data.levels || ['ERROR', 'WARNING', 'CRITICAL']);
      setErrorTypes(typesRes.data.types || []);
    } catch { toast.error('Failed to load error logs'); }
    finally { setLoading(false); }
  }, [level, errorType, search, days, pagination.page, pagination.limit, setPagination]);

  return { logs, stats, loading, levels, errorTypes, fetchCurrentLogs };
}

/* ─── Archives data hook ─── */
function useArchivesData() {
  const [archives, setArchives] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);

  const fetchArchives = useCallback(async () => {
    try {
      setArchiveLoading(true);
      const [archivesRes, fileRes] = await Promise.all([
        errorLogsAPI.listArchives(),
        errorLogsAPI.getCurrentFile(10)
      ]);
      setArchives(archivesRes.data.archives || []);
      setFileInfo(fileRes.data);
    } catch { toast.error('Failed to load archives'); }
    finally { setArchiveLoading(false); }
  }, []);

  return { archives, archiveLoading, fileInfo, fetchArchives };
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
const ErrorLogsPage = () => {
  const [activeTab, setActiveTab] = useState('current');
  const [level, setLevel] = useState('');
  const [errorType, setErrorType] = useState('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(7);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [expandedRows, setExpandedRows] = useState(new Set());

  const currentLogs = useCurrentLogsData(level, errorType, search, days, pagination, setPagination);
  const archivesData = useArchivesData();

  useEffect(() => {
    if (activeTab === 'current') { currentLogs.fetchCurrentLogs(); }
    else if (activeTab === 'archives') { archivesData.fetchArchives(); }
    // system tab manages its own data fetching via SystemLogTab component
  }, [activeTab, currentLogs.fetchCurrentLogs, archivesData.fetchArchives]);

  const handlePageChange = (newPage) => setPagination(prev => ({ ...prev, page: newPage }));
  const toggleRow = (id) => toggleExpandedRow(expandedRows, id, setExpandedRows);
  const handleDownloadArchive = (archiveId) => downloadArchive(archiveId);
  const handleDeleteArchive = (archiveId) => deleteArchive(archiveId, archivesData.fetchArchives);
  const handleForceArchive = () => forceArchive(archivesData.fetchArchives);
  const handleCleanup = () => cleanupArchives(archivesData.fetchArchives);

  const handleDaysChange = (e) => {
    setDays(parseInt(e.target.value));
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  return (
    <div className="space-y-6">
      <ErrorLogsHeader days={days} onDaysChange={handleDaysChange} />
      <ErrorLogsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'current' ? (
        <CurrentLogsTab
          stats={currentLogs.stats} search={search} setSearch={setSearch}
          level={level} setLevel={setLevel} levels={currentLogs.levels}
          errorType={errorType} setErrorType={setErrorType} errorTypes={currentLogs.errorTypes}
          setPagination={setPagination} loading={currentLogs.loading} logs={currentLogs.logs}
          expandedRows={expandedRows} toggleRow={toggleRow}
          pagination={pagination} handlePageChange={handlePageChange}
        />
      ) : activeTab === 'system' ? (
        <SystemLogTab />
      ) : (
        <ArchivesContent
          fileInfo={archivesData.fileInfo} archives={archivesData.archives} archiveLoading={archivesData.archiveLoading}
          onForceArchive={handleForceArchive} onCleanup={handleCleanup}
          onDownloadArchive={handleDownloadArchive} onDeleteArchive={handleDeleteArchive}
          onRefresh={archivesData.fetchArchives}
        />
      )}
    </div>
  );
};

export default ErrorLogsPage;
