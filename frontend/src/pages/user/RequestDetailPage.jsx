import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  FileText,
  Download,
  Eye,
  Send,
  Edit,
  User,
  Calendar,
  Upload,
  Package,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { scenarioRequestAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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

function RequestDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isEditor } = useAuth();

  // Determine the base path based on current location (admin, management, or user)
  const getEditPath = () => {
    if (location.pathname.startsWith('/admin/')) {
      return `/admin/scenario-requests/${requestId}/edit`;
    } else if (location.pathname.startsWith('/management/')) {
      return `/management/scenario-requests/${requestId}/edit`;
    }
    return `/my-requests/${requestId}/edit`;
  };

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Data Delivery upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadComment, setUploadComment] = useState('');
  const [uploading, setUploading] = useState(false);

  // Pagination for preview
  const [previewPage, setPreviewPage] = useState(0);
  const ROWS_PER_PAGE = 50;

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const loadRequest = async () => {
    setLoading(true);
    try {
      const response = await scenarioRequestAPI.get(requestId);
      setRequest(response.data);
    } catch (error) {
      toast.error('Failed to load request');
      navigate('/my-requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      await scenarioRequestAPI.addComment(requestId, newComment);
      setNewComment('');
      loadRequest();
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handlePreviewFile = async (filePath) => {
    setPreviewLoading(true);
    setPreviewPage(0);
    try {
      const response = await scenarioRequestAPI.previewFile(requestId, filePath);
      setPreviewData({ ...response.data, fileName: filePath.split('/').pop() });
    } catch (error) {
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (filePath) => {
    try {
      const response = await scenarioRequestAPI.downloadFile(requestId, filePath);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop();
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUploadBucketFile = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      await scenarioRequestAPI.uploadBucketFile(requestId, uploadFile, uploadComment);
      toast.success('Data snapshot uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadComment('');
      loadRequest(); // Reload to show new file
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to upload file';
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setUploading(false);
    }
  };

  const canUploadBucketFiles = () => {
    // Check if user is an editor (super-admin, admin, group-admin, group-editor, editor)
    if (!isEditor()) return false;

    // Check if status is accepted or beyond
    const allowedStatuses = ['ACC', 'accepted', 'in-progress', 'development', 'testing', 'deployed', 'snapshot', 'active'];
    return allowedStatuses.includes(request?.status);
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { label: status, color: 'bg-neutral-100 text-neutral-700', icon: Clock };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
        <Icon size={16} />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">Request not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <ArrowLeft size={18} />
          Back to Requests
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-lg text-red-600">{request.requestId}</span>
              {getStatusBadge(request.status)}
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">{request.name}</h1>
          </div>
          
          {/* Show Edit button for:
              - Request owner (only for S/P status)
              - Editors/Admins (for any editable status)
          */}
          {((request.user_id === user?.user_id && ['submitted', 'in-progress'].includes(request.status)) ||
            (isEditor() && !['rejected', 'inactive'].includes(request.status))) && (
            <button
              onClick={() => navigate(getEditPath())}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Edit size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Description</h2>
            </div>
            <div className="card-body">
              <div
                className="prose prose-sm max-w-none break-words overflow-wrap-anywhere"
                dangerouslySetInnerHTML={{ __html: request.description || '<p class="text-neutral-500">No description</p>' }}
              />

              {request.reason && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">Business Justification</h3>
                  <div
                    className="prose prose-sm max-w-none break-words overflow-wrap-anywhere text-neutral-600"
                    dangerouslySetInnerHTML={{ __html: request.reason }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          {request.steps && request.steps.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Implementation Steps</h2>
              </div>
              <div className="card-body">
                <ol className="space-y-4">
                  {request.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="prose prose-sm max-w-none text-neutral-800 break-words"
                          dangerouslySetInnerHTML={{ __html: step.description }}
                        />
                        {step.database && (
                          <p className="text-sm text-neutral-500 mt-2">
                            <span className="font-medium">Database:</span> {step.database}
                          </p>
                        )}
                        {step.query && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-neutral-600 mb-1">Query:</p>
                            <pre className="text-xs bg-neutral-900 text-green-400 p-3 rounded-lg overflow-x-auto font-mono">
                              {step.query}
                            </pre>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Sample Files */}
          {request.files && request.files.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Sample Files</h2>
              </div>
              <div className="card-body">
                <div className="space-y-2">
                  {request.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{file.file_name || file.name}</p>
                          <p className="text-xs text-neutral-500">{file.file_type} • v{file.version || 1}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePreviewFile(file.gcs_path)}
                          className="btn btn-sm btn-secondary"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file.gcs_path)}
                          className="btn btn-sm btn-secondary"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data Delivery Section */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package size={18} />
                Data Delivery
              </h2>
              {canUploadBucketFiles() && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-2"
                >
                  <Upload size={16} />
                  Upload Snapshot
                </button>
              )}
            </div>
            <div className="card-body">
              {request.buckets && request.buckets.length > 0 ? (
                <div className="space-y-2">
                  {request.buckets.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText size={20} className="text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{file.file_name || file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{file.file_type}</span>
                            <span>•</span>
                            <span>v{file.version || 1}</span>
                            {file.uploaded_by && (
                              <>
                                <span>•</span>
                                <span>by {file.uploaded_by}</span>
                              </>
                            )}
                            {file.upload_date && (
                              <>
                                <span>•</span>
                                <span>{formatDate(file.upload_date)}</span>
                              </>
                            )}
                          </div>
                          {file.comment && (
                            <p className="text-xs text-neutral-600 mt-1 italic">{file.comment}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => handlePreviewFile(file.gcs_path)}
                          className="btn btn-sm btn-secondary"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file.gcs_path)}
                          className="btn btn-sm btn-secondary"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="mx-auto text-neutral-300 mb-2" size={40} />
                  <p className="text-neutral-500 text-sm">
                    {canUploadBucketFiles()
                      ? 'No data snapshots uploaded yet. Click "Upload Snapshot" to add files.'
                      : 'No data snapshots available yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare size={18} />
                Comments ({request.comments?.length || 0})
              </h2>
            </div>
            <div className="card-body">
              {request.comments && request.comments.length > 0 ? (
                <div className="space-y-4 mb-4">
                  {request.comments.map((comment, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="avatar flex-shrink-0">
                        <User size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-neutral-900">{comment.username || 'User'}</span>
                          <span className="text-xs text-neutral-500">{formatDate(comment.commentDate)}</span>
                        </div>
                        <div 
                          className="text-sm text-neutral-700"
                          dangerouslySetInnerHTML={{ __html: comment.comment }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-sm mb-4">No comments yet</p>
              )}
              
              {/* Add Comment */}
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="input flex-1"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="btn btn-primary self-end"
                >
                  {submittingComment ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <p className="text-sm text-neutral-500">Domain</p>
                <p className="font-medium">{request.dataDomain}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Request Type</p>
                <p className="font-medium">{request.requestType || 'New Scenario'}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Created</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar size={14} />
                  {formatDate(request.row_add_stp)}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Last Updated</p>
                <p className="font-medium flex items-center gap-2">
                  <Clock size={14} />
                  {formatDate(request.row_update_stp)}
                </p>
              </div>
              {request.fulfilmentDate && (
                <div>
                  <p className="text-sm text-neutral-500">Target Date</p>
                  <p className="font-medium">{formatDate(request.fulfilmentDate)}</p>
                </div>
              )}
              {request.scenarioKey && (
                <div>
                  <p className="text-sm text-neutral-500">Scenario Key</p>
                  <p className="font-mono text-sm bg-neutral-100 px-2 py-1 rounded">{request.scenarioKey}</p>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Timeline */}
          {request.work_flow && request.work_flow.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Workflow</h2>
              </div>
              <div className="card-body">
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-neutral-200"></div>
                  <div className="space-y-4">
                    {request.work_flow.map((wf, index) => (
                      <div key={index} className="relative flex gap-3 pl-8">
                        <div className="absolute left-1.5 w-3 h-3 rounded-full bg-red-500"></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">{formatDate(wf.create_stp)}</span>
                          </div>
                          <p className="text-sm font-medium text-neutral-900">
                            {wf.from_status} → {wf.to_status}
                          </p>
                          {wf.assigned_to_name && (
                            <p className="text-xs text-neutral-500">Assigned to: {wf.assigned_to_name}</p>
                          )}
                          {wf.comment && (
                            <p className="text-xs text-neutral-600 mt-1">{wf.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Jira Link */}
          {request.jira && request.jira.ticket_key && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Jira Ticket</h2>
              </div>
              <div className="card-body">
                <a
                  href={request.jira.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full justify-center"
                >
                  {request.jira.ticket_key}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold text-lg">Upload Data Snapshot</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadComment('');
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv,.json,.txt,.png,.jpg,.jpeg"
                  className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-600 hover:file:bg-red-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Supported: xlsx, csv, json, txt, image (max 10MB)
                </p>
                {uploadFile && (
                  <div className="mt-2 p-2 bg-neutral-50 rounded flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-neutral-400" />
                      <span className="text-sm text-neutral-700">{uploadFile.name}</span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Explanation (Optional)
                </label>
                <textarea
                  value={uploadComment}
                  onChange={(e) => setUploadComment(e.target.value)}
                  placeholder="Add context or notes about this snapshot..."
                  rows={3}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadComment('');
                }}
                className="btn btn-secondary"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadBucketFile}
                disabled={!uploadFile || uploading}
                className="btn btn-primary flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">{previewData.fileName}</h3>
              <button onClick={() => {
                setPreviewData(null);
                setPreviewPage(0);
              }} className="text-neutral-400 hover:text-neutral-600">
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-red-600" size={32} />
                </div>
              ) : previewData.type === 'grid' ? (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-neutral-100 sticky top-0">
                        <tr>
                          {previewData.headers?.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium border-b-2 border-neutral-300">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows?.slice(previewPage * ROWS_PER_PAGE, (previewPage + 1) * ROWS_PER_PAGE).map((row, i) => (
                          <tr key={i} className="border-b hover:bg-neutral-50">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2">{String(cell)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewData.rows && previewData.rows.length > ROWS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-neutral-600">
                        Showing {previewPage * ROWS_PER_PAGE + 1} to {Math.min((previewPage + 1) * ROWS_PER_PAGE, previewData.rows.length)} of {previewData.rows.length} rows
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                          disabled={previewPage === 0}
                          className="btn btn-sm btn-secondary disabled:opacity-50"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 text-sm text-neutral-600">
                          Page {previewPage + 1} of {Math.ceil(previewData.rows.length / ROWS_PER_PAGE)}
                        </span>
                        <button
                          onClick={() => setPreviewPage(p => Math.min(Math.ceil(previewData.rows.length / ROWS_PER_PAGE) - 1, p + 1))}
                          disabled={previewPage >= Math.ceil(previewData.rows.length / ROWS_PER_PAGE) - 1}
                          className="btn btn-sm btn-secondary disabled:opacity-50"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : previewData.type === 'json' ? (
                <pre className="bg-neutral-50 p-4 rounded text-xs overflow-auto">
                  {JSON.stringify(previewData.data, null, 2)}
                </pre>
              ) : previewData.type === 'image' ? (
                <div className="flex justify-center">
                  <img src={previewData.data} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
                </div>
              ) : previewData.type === 'text' ? (
                <pre className="bg-neutral-50 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
                  {previewData.data}
                </pre>
              ) : (
                <p className="text-neutral-500 text-center py-12">Preview not available for this file type</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequestDetailPage;
