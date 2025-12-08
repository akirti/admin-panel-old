import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import {
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw
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

// Categorize statuses for filtering
const PENDING_STATUSES = ['submitted', 'review', 'accepted', 'in-progress', 'development', 'testing'];
const COMPLETED_STATUSES = ['deployed', 'snapshot', 'active'];
const REJECTED_STATUSES = ['rejected', 'inactive'];

function MyRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0
  });

  useEffect(() => {
    loadRequests();
  }, [pagination.page, statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await scenarioRequestAPI.getAll({
        page: pagination.page,
        limit: pagination.limit
      });
      setRequests(response.data?.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data?.pagination?.total || response.data?.paginiation?.total || 0
      }));
    } catch (error) {
      console.error('Load requests error:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Strip HTML tags for display
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  // Calculate stats
  const pendingCount = requests.filter(r => PENDING_STATUSES.includes(r.status)).length;
  const completedCount = requests.filter(r => COMPLETED_STATUSES.includes(r.status)).length;
  const rejectedCount = requests.filter(r => REJECTED_STATUSES.includes(r.status)).length;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Requests</h1>
          <p className="text-neutral-600 mt-1">Track your scenario requests</p>
        </div>
        <Link to="/ask-scenario" className="btn-primary flex items-center gap-2 w-fit">
          <Plus size={18} />
          New Request
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-neutral-500">Total Requests</p>
          <p className="text-2xl font-bold text-neutral-900">{pagination.total || requests.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-neutral-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-neutral-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-neutral-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search by ID, name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-48 px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-neutral-900"
            >
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <button
              onClick={loadRequests}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-red-600" size={32} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
              <Clock className="text-neutral-400" size={32} />
            </div>
            <p className="text-neutral-600 mb-4">No requests found</p>
            <Link to="/ask-scenario" className="btn-primary">
              Create your first request
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Request ID</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Domain</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Created</th>
                    <th className="text-left px-5 py-4 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Updated</th>
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
                          {stripHtml(request.description).slice(0, 60)}
                          {stripHtml(request.description).length > 60 ? '...' : ''}
                        </p>
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
                      <td className="px-5 py-4 text-sm text-neutral-600">
                        {formatDate(request.row_update_stp)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => navigate(`/my-requests/${request.requestId}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
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
    </div>
  );
}

export default MyRequestsPage;
