import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Trash2,
  Link
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/shared';
import useRequestData from '../../hooks/useRequestData';
import useRequestComments from '../../hooks/useRequestComments';
import useRequestFiles from '../../hooks/useRequestFiles';
import useRequestJira from '../../hooks/useRequestJira';

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

const UPLOAD_ALLOWED_STATUSES = ['ACC', 'accepted', 'in-progress', 'development', 'testing', 'deployed', 'snapshot', 'active'];

function getStatusBadge(status) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-surface-hover text-content-secondary', icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
      <Icon size={16} />
      {config.label}
    </span>
  );
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getEditPath(location, requestId) {
  if (location.pathname.startsWith('/admin/')) {
    return `/admin/scenario-requests/${requestId}/edit`;
  }
  if (location.pathname.startsWith('/management/')) {
    return `/management/scenario-requests/${requestId}/edit`;
  }
  return `/my-requests/${requestId}/edit`;
}

function canUserEdit(request, userId, isEditorFn) {
  const isOwnerWithEditableStatus = request.user_id === userId && ['submitted', 'in-progress'].includes(request.status);
  const isEditorWithEditableStatus = isEditorFn() && !['rejected', 'inactive'].includes(request.status);
  return isOwnerWithEditableStatus || isEditorWithEditableStatus;
}

function hasJiraContent(request, isEditorFn) {
  return (request.jira && request.jira.ticket_key) ||
    (request.jira_integration && request.jira_integration.ticket_key) ||
    (request.jira_links && request.jira_links.length > 0) ||
    isEditorFn();
}

function hasMainJiraTicket(request) {
  return request.jira?.ticket_key || request.jira_integration?.ticket_key;
}

function hasNoJiraLinks(request) {
  return !request.jira?.ticket_key &&
    !request.jira_integration?.ticket_key &&
    (!request.jira_links || request.jira_links.length === 0);
}

function PreviewContent({ previewData, previewLoading, previewPage, setPreviewPage }) {
  const ROWS_PER_PAGE = 50;

  if (previewLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (previewData.type === 'grid') {
    return <GridPreview previewData={previewData} previewPage={previewPage} setPreviewPage={setPreviewPage} rowsPerPage={ROWS_PER_PAGE} />;
  }

  if (previewData.type === 'json') {
    return (
      <pre className="bg-surface-secondary p-4 rounded text-xs overflow-auto">
        {JSON.stringify(previewData.data, null, 2)}
      </pre>
    );
  }

  if (previewData.type === 'image') {
    return (
      <div className="flex justify-center">
        <img src={previewData.data} alt="Preview" className="max-w-full max-h-[70vh] object-contain" />
      </div>
    );
  }

  if (previewData.type === 'text') {
    return (
      <pre className="bg-surface-secondary p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
        {previewData.data}
      </pre>
    );
  }

  return <p className="text-content-muted text-center py-12">Preview not available for this file type</p>;
}

function GridPreview({ previewData, previewPage, setPreviewPage, rowsPerPage }) {
  const totalPages = Math.ceil((previewData.rows?.length || 0) / rowsPerPage);
  const showPagination = previewData.rows && previewData.rows.length > rowsPerPage;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-surface-hover sticky top-0">
            <tr>
              {previewData.headers?.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium border-b-2 border-edge">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.rows?.slice(previewPage * rowsPerPage, (previewPage + 1) * rowsPerPage).map((row, i) => (
              <tr key={i} className="border-b hover:bg-surface-secondary">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-content-secondary">
            Showing {previewPage * rowsPerPage + 1} to {Math.min((previewPage + 1) * rowsPerPage, previewData.rows.length)} of {previewData.rows.length} rows
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
              disabled={previewPage === 0}
              className="btn btn-sm btn-secondary disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 text-sm text-content-secondary">
              Page {previewPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={previewPage >= totalPages - 1}
              className="btn btn-sm btn-secondary disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DescriptionSection({ request }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Description</h2>
      </div>
      <div className="card-body">
        <div
          className="prose prose-sm max-w-none break-words overflow-wrap-anywhere"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(request.description || '<p class="text-content-muted">No description</p>') }}
        />
        {request.reason && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-medium text-content-secondary mb-2">Business Justification</h3>
            <div
              className="prose prose-sm max-w-none break-words overflow-wrap-anywhere text-content-secondary"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(request.reason) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StepsSection({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Implementation Steps</h2>
      </div>
      <div className="card-body">
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="prose prose-sm max-w-none text-content break-words"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(step.description) }}
                />
                {step.database && (
                  <p className="text-sm text-content-muted mt-2">
                    <span className="font-medium">Database:</span> {step.database}
                  </p>
                )}
                {step.query && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-content-secondary mb-1">Query:</p>
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
  );
}

function SampleFilesSection({ files, onPreview, onDownload }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Sample Files</h2>
      </div>
      <div className="card-body">
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-content-muted" />
                <div>
                  <p className="text-sm font-medium text-content">{file.file_name || file.name}</p>
                  <p className="text-xs text-content-muted">{file.file_type} • v{file.version || 1}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onPreview(file.gcs_path)} className="btn btn-sm btn-secondary" title="Preview">
                  <Eye size={14} />
                </button>
                <button onClick={() => onDownload(file.gcs_path)} className="btn btn-sm btn-secondary" title="Download">
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataDeliverySection({ request, canUpload, onUploadClick, onPreview, onDownload }) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package size={18} />
          Data Delivery
        </h2>
        {canUpload && (
          <button onClick={onUploadClick} className="btn btn-primary btn-sm flex items-center gap-2">
            <Upload size={16} />
            Upload Snapshot
          </button>
        )}
      </div>
      <div className="card-body">
        {request.buckets && request.buckets.length > 0 ? (
          <BucketFilesList buckets={request.buckets} onPreview={onPreview} onDownload={onDownload} />
        ) : (
          <div className="text-center py-8">
            <Package className="mx-auto text-content-muted mb-2" size={48} />
            <p className="text-content-muted text-sm">
              {canUpload
                ? 'No data snapshots uploaded yet. Click "Upload Snapshot" to add files.'
                : 'No data snapshots available yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BucketFilesList({ buckets, onPreview, onDownload }) {
  return (
    <div className="space-y-2">
      {buckets.map((file, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileText size={20} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content truncate">{file.file_name || file.name}</p>
              <div className="flex items-center gap-2 text-xs text-content-muted">
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
                <p className="text-xs text-content-secondary mt-1 italic">{file.comment}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 ml-2">
            <button onClick={() => onPreview(file.gcs_path)} className="btn btn-sm btn-secondary" title="View">
              <Eye size={14} />
            </button>
            <button onClick={() => onDownload(file.gcs_path)} className="btn btn-sm btn-secondary" title="Download">
              <Download size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsSection({ comments, newComment, setNewComment, onAddComment, submittingComment }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare size={18} />
          Comments ({comments?.length || 0})
        </h2>
      </div>
      <div className="card-body">
        {comments && comments.length > 0 ? (
          <div className="space-y-4 mb-4">
            {comments.map((comment, index) => (
              <div key={index} className="flex gap-3">
                <div className="avatar flex-shrink-0">
                  <User size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-content">{comment.username || 'User'}</span>
                    <span className="text-xs text-content-muted">{formatDate(comment.commentDate)}</span>
                  </div>
                  <div
                    className="text-sm text-content-secondary"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.comment) }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-content-muted text-sm mb-4">No comments yet</p>
        )}

        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="input flex-1"
          />
          <button
            onClick={onAddComment}
            disabled={!newComment.trim() || submittingComment}
            className="btn btn-primary self-end"
          >
            {submittingComment ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsSidebar({ request }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Details</h2>
      </div>
      <div className="card-body space-y-4">
        <div>
          <p className="text-sm text-content-muted">Domain</p>
          <p className="font-medium">{request.dataDomain}</p>
        </div>
        <div>
          <p className="text-sm text-content-muted">Request Type</p>
          <p className="font-medium">{request.requestType || 'New Scenario'}</p>
        </div>
        <div>
          <p className="text-sm text-content-muted">Created</p>
          <p className="font-medium flex items-center gap-2">
            <Calendar size={14} />
            {formatDate(request.row_add_stp)}
          </p>
        </div>
        <div>
          <p className="text-sm text-content-muted">Last Updated</p>
          <p className="font-medium flex items-center gap-2">
            <Clock size={14} />
            {formatDate(request.row_update_stp)}
          </p>
        </div>
        {request.fulfilmentDate && (
          <div>
            <p className="text-sm text-content-muted">Target Date</p>
            <p className="font-medium">{formatDate(request.fulfilmentDate)}</p>
          </div>
        )}
        {request.scenarioKey && (
          <div>
            <p className="text-sm text-content-muted">Scenario Key</p>
            <p className="font-mono text-sm bg-surface-hover px-2 py-1 rounded">{request.scenarioKey}</p>
          </div>
        )}
        {request.team && (
          <div>
            <p className="text-sm text-content-muted">Team</p>
            <p className="font-medium">{request.team}</p>
          </div>
        )}
        {request.assignee_name && (
          <div>
            <p className="text-sm text-content-muted">Assignee</p>
            <p className="font-medium">{request.assignee_name}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowTimeline({ workFlow }) {
  if (!workFlow || workFlow.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Workflow</h2>
      </div>
      <div className="card-body">
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-neutral-200"></div>
          <div className="space-y-4">
            {workFlow.map((wf, index) => (
              <div key={index} className="relative flex gap-3 pl-8">
                <div className="absolute left-1.5 w-3 h-3 rounded-full bg-primary-500"></div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-content-muted">{formatDate(wf.create_stp)}</span>
                  </div>
                  <p className="text-sm font-medium text-content">
                    {wf.from_status} → {wf.to_status}
                  </p>
                  {wf.assigned_to_name && (
                    <p className="text-xs text-content-muted">Assigned to: {wf.assigned_to_name}</p>
                  )}
                  {wf.comment && (
                    <p className="text-xs text-content-secondary mt-1">{wf.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function JiraSection({ request, isEditorFn, onAddLink, onRemoveLink, removingJiraLinkIndex }) {
  if (!hasJiraContent(request, isEditorFn)) return null;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link size={18} />
          Jira
        </h2>
        {isEditorFn() && (
          <button
            onClick={onAddLink}
            className="btn btn-sm btn-secondary flex items-center gap-1"
            title="Add dependency link"
          >
            <Plus size={14} />
            Add Link
          </button>
        )}
      </div>
      <div className="card-body space-y-3">
        {hasMainJiraTicket(request) && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 font-medium mb-1">Main Ticket</p>
            <a
              href={request.jira?.ticket_url || request.jira_integration?.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 font-medium"
            >
              {request.jira?.ticket_key || request.jira_integration?.ticket_key}
              <ExternalLink size={14} />
            </a>
          </div>
        )}

        {request.jira_links && request.jira_links.length > 0 && (
          <JiraLinksList
            links={request.jira_links}
            isEditorFn={isEditorFn}
            onRemove={onRemoveLink}
            removingIndex={removingJiraLinkIndex}
          />
        )}

        {hasNoJiraLinks(request) && (
          <p className="text-sm text-content-muted text-center py-2">
            No Jira tickets linked yet
          </p>
        )}
      </div>
    </div>
  );
}

function JiraLinksList({ links, isEditorFn, onRemove, removingIndex }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-content-muted font-medium">Dependencies & Related</p>
      {links.map((link, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 bg-surface-secondary rounded-lg border border-edge"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs px-1.5 py-0.5 bg-neutral-200 text-content-secondary rounded capitalize">
              {link.link_type || 'dependency'}
            </span>
            <a
              href={link.ticket_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm truncate"
            >
              {link.ticket_key}
              <ExternalLink size={12} />
            </a>
            {link.title && (
              <span className="text-xs text-content-muted truncate">{link.title}</span>
            )}
          </div>
          {isEditorFn() && (
            <button
              onClick={() => onRemove(index)}
              disabled={removingIndex === index}
              className="p-1 text-content-muted hover:text-red-600 transition-colors"
              title="Remove link"
            >
              {removingIndex === index ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function UploadModalContent({ uploadFile, uploadComment, setUploadComment, handleFileSelect, handleUpload, uploading, onCancel }) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Select File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".xlsx,.xls,.csv,.json,.txt,.png,.jpg,.jpeg"
            className="block w-full text-sm text-content-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"
          />
          <p className="text-xs text-content-muted mt-1">
            Supported: xlsx, csv, json, txt, image (max 10MB)
          </p>
          {uploadFile && (
            <div className="mt-2 p-2 bg-surface-secondary rounded flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-content-muted" />
                <span className="text-sm text-content-secondary">{uploadFile.name}</span>
              </div>
              <span className="text-xs text-content-muted">
                {(uploadFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
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
      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <button onClick={onCancel} className="btn btn-secondary" disabled={uploading}>
          Cancel
        </button>
        <button
          onClick={handleUpload}
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
    </>
  );
}

function JiraLinkModalContent({ newJiraLink, setNewJiraLink, onSubmit, onCancel, addingJiraLink }) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Ticket Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newJiraLink.ticket_key}
            onChange={(e) => setNewJiraLink(prev => ({ ...prev, ticket_key: e.target.value }))}
            placeholder="e.g., PROJ-123"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Ticket URL (Optional)
          </label>
          <input
            type="url"
            value={newJiraLink.ticket_url}
            onChange={(e) => setNewJiraLink(prev => ({ ...prev, ticket_url: e.target.value }))}
            placeholder="e.g. PROJ-123 or full ticket URL"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={newJiraLink.title}
            onChange={(e) => setNewJiraLink(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Brief description of the ticket"
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Link Type
          </label>
          <select
            value={newJiraLink.link_type}
            onChange={(e) => setNewJiraLink(prev => ({ ...prev, link_type: e.target.value }))}
            className="input w-full"
          >
            <option value="dependency">Dependency</option>
            <option value="related">Related</option>
            <option value="blocks">Blocks</option>
            <option value="blocked_by">Blocked By</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <button onClick={onCancel} className="btn btn-secondary" disabled={addingJiraLink}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!newJiraLink.ticket_key.trim() || addingJiraLink}
          className="btn btn-primary flex items-center gap-2"
        >
          {addingJiraLink ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Adding...
            </>
          ) : (
            <>
              <Plus size={16} />
              Add Link
            </>
          )}
        </button>
      </div>
    </>
  );
}

function RequestDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isEditor } = useAuth();

  const { request, loading, loadRequest } = useRequestData(requestId);
  const { newComment, setNewComment, submittingComment, handleAddComment } = useRequestComments(requestId, loadRequest);
  const {
    previewData, previewLoading, previewPage, setPreviewPage,
    showUploadModal, setShowUploadModal, uploadFile, uploadComment, setUploadComment, uploading,
    handlePreviewFile, handleDownloadFile, handleFileSelect, handleUploadBucketFile,
    closeUploadModal, closePreviewModal
  } = useRequestFiles(requestId, loadRequest);
  const {
    showAddJiraLinkModal, setShowAddJiraLinkModal, newJiraLink, setNewJiraLink,
    addingJiraLink, removingJiraLinkIndex,
    handleAddJiraLink, handleRemoveJiraLink, closeJiraLinkModal
  } = useRequestJira(requestId, loadRequest);

  const canUploadBucketFiles = () => isEditor() && UPLOAD_ALLOWED_STATUSES.includes(request?.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-content-muted">Request not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-content-secondary hover:text-content mb-4"
        >
          <ArrowLeft size={18} />
          Back to Requests
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-lg text-primary-600">{request.requestId}</span>
              {getStatusBadge(request.status)}
            </div>
            <h1 className="text-2xl font-bold text-content">{request.name}</h1>
          </div>

          {canUserEdit(request, user?.user_id, isEditor) && (
            <button
              onClick={() => navigate(getEditPath(location, requestId))}
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
          <DescriptionSection request={request} />
          <StepsSection steps={request.steps} />
          <SampleFilesSection files={request.files} onPreview={handlePreviewFile} onDownload={handleDownloadFile} />
          <DataDeliverySection
            request={request}
            canUpload={canUploadBucketFiles()}
            onUploadClick={() => setShowUploadModal(true)}
            onPreview={handlePreviewFile}
            onDownload={handleDownloadFile}
          />
          <CommentsSection
            comments={request.comments}
            newComment={newComment}
            setNewComment={setNewComment}
            onAddComment={handleAddComment}
            submittingComment={submittingComment}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <DetailsSidebar request={request} />
          <WorkflowTimeline workFlow={request.work_flow} />
          <JiraSection
            request={request}
            isEditorFn={isEditor}
            onAddLink={() => setShowAddJiraLinkModal(true)}
            onRemoveLink={handleRemoveJiraLink}
            removingJiraLinkIndex={removingJiraLinkIndex}
          />
        </div>
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={closeUploadModal} title="Upload Data Snapshot" size="sm">
        <UploadModalContent
          uploadFile={uploadFile}
          uploadComment={uploadComment}
          setUploadComment={setUploadComment}
          handleFileSelect={handleFileSelect}
          handleUpload={handleUploadBucketFile}
          uploading={uploading}
          onCancel={closeUploadModal}
        />
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewData}
        onClose={closePreviewModal}
        title={previewData?.fileName || 'Preview'}
        size="full"
      >
        {previewData && (
          <div className="max-h-[70vh] overflow-auto">
            <PreviewContent
              previewData={previewData}
              previewLoading={previewLoading}
              previewPage={previewPage}
              setPreviewPage={setPreviewPage}
            />
          </div>
        )}
      </Modal>

      {/* Add Jira Link Modal */}
      <Modal isOpen={showAddJiraLinkModal} onClose={closeJiraLinkModal} title="Add Jira Link" size="sm">
        <JiraLinkModalContent
          newJiraLink={newJiraLink}
          setNewJiraLink={setNewJiraLink}
          onSubmit={handleAddJiraLink}
          onCancel={closeJiraLinkModal}
          addingJiraLink={addingJiraLink}
        />
      </Modal>
    </div>
  );
}

export default RequestDetailPage;
