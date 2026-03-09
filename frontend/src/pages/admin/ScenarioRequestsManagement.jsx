import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  Edit,
  ExternalLink
} from 'lucide-react';
import { scenarioRequestAPI } from '../../services/api';
import { Modal } from '../../components/shared';

// Status config matching backend ScenarioRequestStatusTypes enum values
const STATUS_CONFIG = {
  'submitted': { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
  'review': { label: 'Review', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  'rejected': { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  'accepted': { label: 'Accepted', color: 'bg-teal-100 text-teal-700', icon: CheckCircle },
  'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  'development': { label: 'Development', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  'testing': { label: 'Testing', color: 'bg-indigo-100 text-indigo-700', icon: AlertCircle },
  'deployed': { label: 'Deployed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  'snapshot': { label: 'Files Ready', color: 'bg-cyan-100 text-cyan-700', icon: Clock },
  'active': { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  'inactive': { label: 'Inactive', color: 'bg-surface-hover text-content-secondary', icon: XCircle }
};

const DEFAULT_STATUS_CONFIG = { label: 'Unknown', color: 'bg-surface-hover text-content-secondary', icon: Clock };

// Categorize statuses for stats
const PENDING_STATUSES = ['submitted', 'review', 'accepted', 'in-progress', 'development', 'testing'];
const COMPLETED_STATUSES = ['deployed', 'snapshot', 'active'];
const REJECTED_STATUSES = ['rejected', 'inactive'];

// --- Helper functions extracted outside component ---

const getStatusBadge = (status) => {
  const config = STATUS_CONFIG[status] || { ...DEFAULT_STATUS_CONFIG, label: status || 'Unknown' };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// --- Sub-components extracted to reduce cognitive complexity ---

const StatsCards = ({ stats }) => (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
    <StatCard icon={FileText} iconClass="bg-surface-hover" textClass="text-content-muted" valueClass="text-content" label="Total" value={stats.total} />
    <StatCard icon={Clock} iconClass="bg-blue-100" textClass="text-blue-600" valueClass="text-blue-600" label="Submitted" value={stats.submitted} />
    <StatCard icon={TrendingUp} iconClass="bg-yellow-100" textClass="text-yellow-600" valueClass="text-yellow-600" label="In Progress" value={stats.inProgress} />
    <StatCard icon={CheckCircle} iconClass="bg-green-100" textClass="text-green-600" valueClass="text-green-600" label="Deployed" value={stats.deployed} />
    <StatCard icon={XCircle} iconClass="bg-red-100" textClass="text-red-600" valueClass="text-red-600" label="Rejected" value={stats.rejected} />
  </div>
);

const StatCard = ({ icon: Icon, iconClass, textClass, valueClass, label, value }) => (
  <div className="card flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg ${iconClass} flex items-center justify-center`}>
      <Icon className={textClass} size={24} />
    </div>
    <div>
      <p className="text-sm text-content-muted">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  </div>
);

const JiraCell = ({ request }) => {
  const ticketKey = request.jira?.ticket_key || request.jira_integration?.ticket_key;
  const ticketUrl = request.jira?.ticket_url || request.jira_integration?.ticket_url || '#';

  if (ticketKey) {
    return (
      <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm" onClick={(e) => e.stopPropagation()}>
        {ticketKey}
        <ExternalLink size={12} />
      </a>
    );
  }

  if (request.jira_links?.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {request.jira_links.slice(0, 2).map((link, idx) => (
          <a key={idx} href={link.ticket_url || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs" onClick={(e) => e.stopPropagation()}>
            {link.ticket_key}
            <ExternalLink size={10} />
          </a>
        ))}
        {request.jira_links.length > 2 && (
          <span className="text-xs text-content-muted">+{request.jira_links.length - 2} more</span>
        )}
      </div>
    );
  }

  return <span className="text-content-muted text-sm">-</span>;
};

const RequestRow = ({ request, basePath, onUpdateStatus }) => (
  <tr className="hover:bg-surface-hover transition-colors">
    <td className="px-5 py-4">
      <span className="font-mono text-sm font-medium text-primary-600">{request.requestId}</span>
    </td>
    <td className="px-5 py-4">
      <p className="font-medium text-content truncate max-w-xs">{request.name}</p>
      <p className="text-xs text-content-muted truncate max-w-xs mt-0.5">
        {stripHtml(request.description).slice(0, 50)}...
      </p>
    </td>
    <td className="px-5 py-4">
      <p className="text-sm text-content">{request.email}</p>
    </td>
    <td className="px-5 py-4">
      <span className="inline-flex px-2.5 py-1 bg-surface-hover text-content-secondary rounded-full text-xs font-medium">
        {request.dataDomain}
      </span>
    </td>
    <td className="px-5 py-4">{getStatusBadge(request.status)}</td>
    <td className="px-5 py-4">
      <span className="text-sm text-content-secondary">{request.team || '-'}</span>
    </td>
    <td className="px-5 py-4">
      <span className="text-sm text-content-secondary">{request.assignee_name || '-'}</span>
    </td>
    <td className="px-5 py-4">
      <JiraCell request={request} />
    </td>
    <td className="px-5 py-4 text-sm text-content-muted">{formatDate(request.row_add_stp)}</td>
    <td className="px-5 py-4">
      <RequestActions request={request} basePath={basePath} onUpdateStatus={onUpdateStatus} />
    </td>
  </tr>
);

const RequestActions = ({ request, basePath, onUpdateStatus }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => navigate(`${basePath}/scenario-requests/${request.requestId}`)} className="p-2 rounded-lg hover:bg-surface-hover text-content-muted transition-colors" title="View">
        <Eye size={16} />
      </button>
      <button onClick={() => onUpdateStatus(request)} className="p-2 rounded-lg hover:bg-primary-100 text-primary-600 transition-colors" title="Update Status">
        <Edit size={16} />
      </button>
    </div>
  );
};

const RequestsTable = ({ requests, loading, basePath, onUpdateStatus }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-hover rounded-full flex items-center justify-center">
          <FileText className="text-content-muted" size={32} />
        </div>
        <p className="text-content-muted">No requests found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="text-left px-5 py-4">Request ID</th>
            <th className="text-left px-5 py-4">Name</th>
            <th className="text-left px-5 py-4">Requester</th>
            <th className="text-left px-5 py-4">Domain</th>
            <th className="text-left px-5 py-4">Status</th>
            <th className="text-left px-5 py-4">Team</th>
            <th className="text-left px-5 py-4">Assignee</th>
            <th className="text-left px-5 py-4">Jira</th>
            <th className="text-left px-5 py-4">Created</th>
            <th className="text-center px-5 py-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge-light">
          {requests.map((request) => (
            <RequestRow key={request.requestId} request={request} basePath={basePath} onUpdateStatus={onUpdateStatus} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatusUpdateModal = ({ isOpen, selectedRequest, statuses, newStatus, setNewStatus, statusComment, setStatusComment, updatingStatus, onClose, onSubmit }) => {
  if (!isOpen || !selectedRequest) return null;
  return (
    <Modal isOpen={true} onClose={onClose} title="Update Status" size="sm">
      <div className="p-5 space-y-4">
        <div>
          <p className="text-sm text-content-muted mb-1">Request</p>
          <p className="font-medium text-content">{selectedRequest.requestId} - {selectedRequest.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">New Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content">
            {statuses.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">Comment (optional)</label>
          <textarea value={statusComment} onChange={(e) => setStatusComment(e.target.value)} rows={3} className="w-full px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content resize-none" placeholder="Add a comment about this status change..." />
        </div>
      </div>
      <div className="flex justify-end gap-3 px-5 py-4 border-t bg-surface-secondary rounded-b-xl">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onSubmit} disabled={updatingStatus} className="btn-primary flex items-center gap-2">
          {updatingStatus && <Loader2 className="animate-spin" size={16} />}
          Update Status
        </button>
      </div>
    </Modal>
  );
};

// --- Helper functions outside component ---

function computeRequestStats(data, totalCount) {
  return {
    total: totalCount,
    submitted: data.filter(r => r.status === 'submitted').length,
    inProgress: data.filter(r => PENDING_STATUSES.includes(r.status)).length,
    deployed: data.filter(r => COMPLETED_STATUSES.includes(r.status)).length,
    rejected: data.filter(r => REJECTED_STATUSES.includes(r.status)).length
  };
}

function extractPaginationTotal(responseData, dataLength) {
  return responseData?.pagination?.total || responseData?.paginiation?.total || dataLength;
}

function matchesRequestSearch(request, searchTerm) {
  if (!searchTerm) return true;
  const lowerSearch = searchTerm.toLowerCase();
  return request.requestId?.toLowerCase().includes(lowerSearch) ||
    request.name?.toLowerCase().includes(lowerSearch) ||
    request.email?.toLowerCase().includes(lowerSearch);
}

function filterRequests(requests, searchTerm, statusFilter, domainFilter) {
  return requests.filter(request => {
    const matchesSearch = matchesRequestSearch(request, searchTerm);
    const matchesStatus = !statusFilter || request.status === statusFilter;
    const matchesDomain = !domainFilter || request.dataDomain === domainFilter;
    return matchesSearch && matchesStatus && matchesDomain;
  });
}

function resolveBasePath(pathname) {
  return pathname.startsWith('/management') ? '/management' : '/admin';
}

const RequestsFilterBar = ({ searchTerm, onSearchChange, statusFilter, onStatusFilterChange, domainFilter, onDomainFilterChange, statuses, domains, onRefresh }) => (
  <div className="card mb-6">
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={18} />
        <input type="text" placeholder="Search by ID, name or email..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content" />
      </div>
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="w-full md:w-40 px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content">
          <option value="">All Status</option>
          {statuses.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
        <select value={domainFilter} onChange={(e) => onDomainFilterChange(e.target.value)} className="w-full md:w-40 px-4 py-3 border border-edge rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface text-content">
          <option value="">All Domains</option>
          {domains.map(domain => (
            <option key={domain.key || domain.value} value={domain.key || domain.value}>{domain.name || domain.label}</option>
          ))}
        </select>
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  </div>
);

const RequestsPagination = ({ pagination, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-edge bg-surface-secondary">
      <p className="text-sm text-content-muted">
        Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 0} className="p-2 rounded-lg border border-edge hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="px-4 py-2 text-sm text-content-muted">Page {pagination.page + 1} of {totalPages}</span>
        <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= totalPages - 1} className="p-2 rounded-lg border border-edge hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

// --- Custom hook for requests data loading ---

function useRequestsData() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 15, total: 0 });
  const [stats, setStats] = useState({ total: 0, submitted: 0, inProgress: 0, deployed: 0, rejected: 0 });

  const loadLookups = useCallback(async () => {
    try {
      const [domainsRes, statusesRes] = await Promise.all([scenarioRequestAPI.getDomains(), scenarioRequestAPI.getStatuses()]);
      setDomains(domainsRes.data || []);
      setStatuses(statusesRes.data || []);
    } catch { /* silently handled */ }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scenarioRequestAPI.getAll({ page: pagination.page, limit: pagination.limit });
      const data = response.data?.data || [];
      const totalCount = extractPaginationTotal(response.data, data.length);
      setRequests(data);
      setPagination(prev => ({ ...prev, total: totalCount }));
      setStats(computeRequestStats(data, totalCount));
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit]);

  const handlePageChange = (newPage) => { setPagination(prev => ({ ...prev, page: newPage })); };

  return { requests, loading, domains, statuses, pagination, stats, loadLookups, loadRequests, handlePageChange };
}

// --- Custom hook for status update modal ---

function useStatusModal(loadRequests) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const openStatusModal = (request) => { setSelectedRequest(request); setNewStatus(request.status); setShowStatusModal(true); };
  const closeStatusModal = () => setShowStatusModal(false);

  const handleStatusUpdate = async () => {
    if (!selectedRequest || !newStatus) return;
    setUpdatingStatus(true);
    try {
      await scenarioRequestAPI.updateStatus(selectedRequest.requestId, newStatus, statusComment);
      toast.success('Status updated successfully');
      setShowStatusModal(false);
      setSelectedRequest(null);
      setNewStatus('');
      setStatusComment('');
      loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return { selectedRequest, showStatusModal, newStatus, setNewStatus, statusComment, setStatusComment, updatingStatus, openStatusModal, closeStatusModal, handleStatusUpdate };
}

// --- Main Component ---

function ScenarioRequestsManagement() {
  const location = useLocation();
  const basePath = resolveBasePath(location.pathname);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  const data = useRequestsData();
  const statusModal = useStatusModal(data.loadRequests);

  useEffect(() => { data.loadLookups(); }, [data.loadLookups]);
  useEffect(() => { data.loadRequests(); }, [data.loadRequests, statusFilter, domainFilter]);

  const filteredRequests = filterRequests(data.requests, searchTerm, statusFilter, domainFilter);
  const totalPages = Math.ceil(data.pagination.total / data.pagination.limit);
  const showPagination = !data.loading && filteredRequests.length > 0;

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content">Scenario Requests</h1>
        <p className="text-content-muted mt-1">Manage and process scenario requests</p>
      </div>

      <StatsCards stats={data.stats} />

      <RequestsFilterBar
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        domainFilter={domainFilter} onDomainFilterChange={setDomainFilter}
        statuses={data.statuses} domains={data.domains} onRefresh={data.loadRequests}
      />

      <div className="card p-0 overflow-hidden">
        <RequestsTable requests={filteredRequests} loading={data.loading} basePath={basePath} onUpdateStatus={statusModal.openStatusModal} />
        {showPagination && (
          <RequestsPagination pagination={data.pagination} totalPages={totalPages} onPageChange={data.handlePageChange} />
        )}
      </div>

      <StatusUpdateModal
        isOpen={statusModal.showStatusModal} selectedRequest={statusModal.selectedRequest}
        statuses={data.statuses} newStatus={statusModal.newStatus} setNewStatus={statusModal.setNewStatus}
        statusComment={statusModal.statusComment} setStatusComment={statusModal.setStatusComment}
        updatingStatus={statusModal.updatingStatus}
        onClose={statusModal.closeStatusModal} onSubmit={statusModal.handleStatusUpdate}
      />
    </div>
  );
}

export default ScenarioRequestsManagement;
