import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
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
  X
} from 'lucide-react';
import { scenarioRequestAPI } from '../../services/api';

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
  'inactive': { label: 'Inactive', color: 'bg-neutral-100 text-neutral-700', icon: XCircle }
};

// Categorize statuses for stats
const PENDING_STATUSES = ['submitted', 'review', 'accepted', 'in-progress', 'development', 'testing'];
const COMPLETED_STATUSES = ['deployed', 'snapshot', 'active'];
const REJECTED_STATUSES = ['rejected', 'inactive'];

function ScenarioRequestsManagement() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [domains, setDomains] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 15,
    total: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    inProgress: 0,
    deployed: 0,
    rejected: 0
  });
  
  // Modal states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [pagination.page, statusFilter, domainFilter]);

  const loadLookups = async () => {
    try {
      const [domainsRes, statusesRes] = await Promise.all([
        scenarioRequestAPI.getDomains(),
        scenarioRequestAPI.getStatuses()
      ]);
      setDomains(domainsRes.data || []);
      setStatuses(statusesRes.data || []);
    } catch (error) {
      console.error('Failed to load lookups:', error);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await scenarioRequestAPI.getAll({
        page: pagination.page,
        limit: pagination.limit
      });
      const data = response.data?.data || [];
      setRequests(data);
      setPagination(prev => ({
        ...prev,
        total: response.data?.pagination?.total || response.data?.paginiation?.total || data.length
      }));
      
      // Calculate stats using correct status values
      setStats({
        total: response.data?.pagination?.total || response.data?.paginiation?.total || data.length,
        submitted: data.filter(r => r.status === 'submitted').length,
        inProgress: data.filter(r => PENDING_STATUSES.includes(r.status)).length,
        deployed: data.filter(r => COMPLETED_STATUSES.includes(r.status)).length,
        rejected: data.filter(r => REJECTED_STATUSES.includes(r.status)).length
      });
    } catch (error) {
      console.error('Load requests error:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

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

  const filteredRequests = requests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || request.status === statusFilter;
    const matchesDomain = !domainFilter || request.dataDomain === domainFilter;
    
    return matchesSearch && matchesStatus && matchesDomain;
  });

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-neutral-100 text-neutral-700', icon: Clock };
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Strip HTML for display
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Scenario Requests</h1>
        <p className="text-neutral-600 mt-1">Manage and process scenario requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">
            <FileText className="text-neutral-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">Total</p>
            <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="text-blue-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">Submitted</p>
            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
            <TrendingUp className="text-yellow-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">Deployed</p>
            <p className="text-2xl font-bold text-green-600">{stats.deployed}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search by ID, name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-40 px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
            >
              <option value="">All Status</option>
              {statuses.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full md:w-40 px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
            >
              <option value="">All Domains</option>
              {domains.map(domain => (
                <option key={domain.key || domain.value} value={domain.key || domain.value}>
                  {domain.name || domain.label}
                </option>
              ))}
            </select>
            <button
              onClick={loadRequests}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-red-600" size={32} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
              <FileText className="text-neutral-400" size={32} />
            </div>
            <p className="text-neutral-500">No requests found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Request ID</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Requester</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Domain</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Created</th>
                    <th className="text-center px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRequests.map((request) => (
                    <tr key={request.requestId} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-medium text-red-600">{request.requestId}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-neutral-900 truncate max-w-xs">{request.name}</p>
                        <p className="text-xs text-neutral-500 truncate max-w-xs mt-0.5">
                          {stripHtml(request.description).slice(0, 50)}...
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-neutral-800">{request.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium">
                          {request.dataDomain}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-5 py-4 text-sm text-neutral-600">
                        {formatDate(request.row_add_stp)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/scenario-requests/${request.requestId}`)}
                            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setNewStatus(request.status);
                              setShowStatusModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                            title="Update Status"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-neutral-200 bg-neutral-50">
                <p className="text-sm text-neutral-600">
                  Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 0}
                    className="p-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="px-4 py-2 text-sm text-neutral-600">
                    Page {pagination.page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= totalPages - 1}
                    className="p-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Status Update Modal */}
      {showStatusModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-lg text-neutral-900">Update Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-neutral-500 mb-1">Request</p>
                <p className="font-medium text-neutral-900">{selectedRequest.requestId} - {selectedRequest.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
                >
                  {statuses.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Comment (optional)</label>
                <textarea
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900 resize-none"
                  placeholder="Add a comment about this status change..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-neutral-50 rounded-b-xl">
              <button
                onClick={() => setShowStatusModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updatingStatus}
                className="btn-primary flex items-center gap-2"
              >
                {updatingStatus && <Loader2 className="animate-spin" size={16} />}
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScenarioRequestsManagement;
