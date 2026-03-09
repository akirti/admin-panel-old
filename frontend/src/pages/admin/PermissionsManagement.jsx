import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { permissionsAPI, exportAPI } from '../../services/api';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Shield,
  Link2,
  Filter,
} from 'lucide-react';
import { Modal } from '../../components/shared';

// --- Sub-components extracted to reduce cognitive complexity ---

const PermissionsTable = ({ permissions, loading, onShowRelationships, onEdit, onDelete }) => {
  if (loading) {
    return <div className="p-8 text-center text-content-muted">Loading permissions...</div>;
  }

  if (permissions.length === 0) {
    return (
      <div className="p-8 text-center text-content-muted">
        No permissions found. Click &quot;Add Permission&quot; to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-3 text-left">Key</th>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Module</th>
            <th className="px-4 py-3 text-left">Actions</th>
            <th className="px-4 py-3 text-left">Created</th>
            <th className="px-4 py-3 text-right">Manage</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {permissions.map((permission) => (
            <PermissionRow
              key={permission._id || permission.key}
              permission={permission}
              onShowRelationships={onShowRelationships}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PermissionRow = ({ permission, onShowRelationships, onEdit, onDelete }) => {
  const actions = permission.actions || [];
  const createdDate = permission.created_at
    ? new Date(permission.created_at).toLocaleDateString()
    : 'N/A';

  return (
    <tr className="hover:bg-surface-hover">
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-content-muted">{permission.key}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="font-medium text-content">{permission.name}</div>
          {permission.description && (
            <div className="text-xs text-content-muted truncate max-w-xs">{permission.description}</div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
          {permission.module || 'Other'}
        </span>
      </td>
      <td className="px-4 py-3">
        <ActionTagList actions={actions} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-content-muted">{createdDate}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            className="w-9 h-9 flex items-center justify-center text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            onClick={() => onShowRelationships(permission)}
            title="View Roles & Groups"
          >
            <Link2 size={18} />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            onClick={() => onEdit(permission)}
            title="Edit"
          >
            <Edit2 size={18} />
          </button>
          <button
            className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            onClick={() => onDelete(permission)}
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const ActionTagList = ({ actions }) => (
  <div className="flex flex-wrap gap-1 max-w-xs">
    {actions.slice(0, 3).map((action, idx) => (
      <span key={idx} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded capitalize">
        {action}
      </span>
    ))}
    {actions.length > 3 && (
      <span className="px-2 py-0.5 text-xs bg-surface-hover text-content-muted rounded">
        +{actions.length - 3} more
      </span>
    )}
  </div>
);

const ActionsSection = ({ formData, commonActions, handleActionToggle, handleSelectAllActions }) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <label className="block text-sm font-medium text-content-secondary">
        Actions ({formData.actions.length} selected)
      </label>
      <div className="flex gap-2">
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllActions(true)}>Select All</button>
        <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllActions(false)}>Clear All</button>
      </div>
    </div>
    <div className="border rounded-lg p-4 bg-surface-secondary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {commonActions.map((action) => (
          <label
            key={action}
            className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${
              formData.actions.includes(action)
                ? 'bg-blue-50 border-blue-300'
                : 'bg-surface border-edge hover:border-edge'
            }`}
          >
            <input
              type="checkbox"
              checked={formData.actions.includes(action)}
              onChange={() => handleActionToggle(action)}
              className="rounded border-edge mr-2"
            />
            <span className="text-sm capitalize">{action}</span>
          </label>
        ))}
      </div>
      {formData.actions.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-content-secondary mb-2">Selected Actions:</p>
          <div className="flex flex-wrap gap-1">
            {formData.actions.map((action) => (
              <span
                key={action}
                className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded cursor-pointer capitalize"
                onClick={() => handleActionToggle(action)}
              >
                {action} &times;
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const PermissionForm = ({ formData, editingPermission, modules, commonActions, handleInputChange, handleActionToggle, handleSelectAllActions, handleSubmit, onClose }) => (
  <form onSubmit={handleSubmit}>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            Permission Key <span className="text-red-500">*</span>
          </label>
          <input type="text" name="key" className="input w-full" value={formData.key} onChange={handleInputChange} required disabled={!!editingPermission} placeholder="e.g., users.create" />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" className="input w-full" value={formData.name} onChange={handleInputChange} required placeholder="Create Users" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Module <span className="text-red-500">*</span>
        </label>
        <input type="text" name="module" className="input w-full" value={formData.module} onChange={handleInputChange} required placeholder="Users" list="modules-list" />
        <datalist id="modules-list">
          {modules.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea name="description" className="input w-full" rows={2} value={formData.description} onChange={handleInputChange} placeholder="Permission description..." />
      </div>
      <ActionsSection
        formData={formData}
        commonActions={commonActions}
        handleActionToggle={handleActionToggle}
        handleSelectAllActions={handleSelectAllActions}
      />
    </div>
    <div className="flex justify-end gap-3 pt-6 border-t mt-6">
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="btn btn-primary">
        {editingPermission ? 'Update Permission' : 'Create Permission'}
      </button>
    </div>
  </form>
);

const StatusBadge = ({ status }) => {
  const className = status === 'active'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-1 text-xs rounded-full ${className}`}>{status}</span>;
};

const RelationshipList = ({ title, items, emptyText }) => (
  <div>
    <h3 className="text-lg font-semibold mb-3">{title} ({items.length})</h3>
    {items.length > 0 ? (
      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.roleId || item.groupId || item._id} className="p-3 hover:bg-surface-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-content-muted">{item.roleId || item.groupId}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-content-muted text-center py-4 border rounded-lg">{emptyText}</p>
    )}
  </div>
);

const RelationshipModal = ({ isOpen, onClose, selectedPermission, loadingRelationships, permissionRoles, permissionGroups }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Permission Usage: ${selectedPermission?.name || ''}`} size="xl">
    <div>
      {loadingRelationships ? (
        <div className="text-center py-8 text-content-muted">Loading relationships...</div>
      ) : (
        <div className="space-y-6">
          <RelationshipList
            title="Roles with this Permission"
            items={permissionRoles}
            emptyText="No roles have this permission"
          />
          <RelationshipList
            title="Groups with this Permission"
            items={permissionGroups}
            emptyText="No groups have this permission"
          />
          <div className="bg-surface-secondary p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Permission Details</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-content-muted">Key:</dt>
              <dd className="font-mono">{selectedPermission?.key}</dd>
              <dt className="text-content-muted">Module:</dt>
              <dd>{selectedPermission?.module}</dd>
              <dt className="text-content-muted">Actions:</dt>
              <dd className="flex flex-wrap gap-1">
                {(selectedPermission?.actions || []).map((a) => (
                  <span key={a} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded capitalize">{a}</span>
                ))}
              </dd>
            </dl>
          </div>
        </div>
      )}
    </div>
    <div className="pt-4 border-t flex justify-end">
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    </div>
  </Modal>
);

// --- Custom hooks extracted to reduce cognitive complexity ---

function usePermissionsData(isSuperAdmin) {
  const [permissions, setPermissions] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (moduleFilter) params.module = moduleFilter;
      const [permsRes, modulesRes] = await Promise.all([permissionsAPI.list(params), permissionsAPI.getModules()]);
      setPermissions(permsRes.data.data || []);
      if (permsRes.data.pagination) {
        setTotalPages(permsRes.data.pagination.pages || 0);
        setTotal(permsRes.data.pagination.total || 0);
      }
      setModules(modulesRes.data.modules || []);
    } catch { setError('Failed to fetch permissions'); }
    finally { setLoading(false); }
  }, [page, limit, debouncedSearch, moduleFilter]);

  useEffect(() => { if (isSuperAdmin()) fetchPermissions(); }, [fetchPermissions, isSuperAdmin]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  return {
    permissions, modules, loading, error, success, setError, setSuccess,
    page, setPage, limit, totalPages, total, search, setSearch,
    moduleFilter, setModuleFilter, fetchPermissions, permissionsByModule,
  };
}

function usePermissionActions(setError, setSuccess, fetchPermissions) {
  const handleDelete = async (permission) => {
    if (!window.confirm(`Are you sure you want to delete permission "${permission.name}"? This will remove it from all roles and groups.`)) return;
    try {
      await permissionsAPI.delete(permission._id || permission.key);
      setSuccess('Permission deleted successfully');
      fetchPermissions();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to delete permission'); }
  };

  const handleExport = async (format) => {
    try {
      const response = format === 'csv' ? await exportAPI.permissions.csv() : await exportAPI.permissions.json();
      const blob = new Blob([response.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `permissions_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(`Exported permissions as ${format.toUpperCase()}`);
    } catch { setError('Failed to export permissions'); }
  };

  return { handleDelete, handleExport };
}

const PermAccessDenied = () => (
  <div className="text-center py-12">
    <Shield className="mx-auto text-content-muted mb-4" size={48} />
    <h2 className="text-xl font-semibold text-content mb-2">Access Denied</h2>
    <p className="text-content-muted">Only Super Administrators can access this page.</p>
  </div>
);

const PermAlertMessages = ({ error, success }) => (
  <>
    {error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle size={20} /> {error}
      </div>
    )}
    {success && (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle size={20} /> {success}
      </div>
    )}
  </>
);

const ModuleStats = ({ permissionsByModule, moduleFilter, onModuleClick }) => {
  if (moduleFilter || Object.keys(permissionsByModule).length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.entries(permissionsByModule).slice(0, 4).map(([module, perms]) => (
        <div key={module} className="card p-4 cursor-pointer hover:border-blue-300" onClick={() => onModuleClick(module)}>
          <div className="text-sm text-content-muted">{module}</div>
          <div className="text-2xl font-bold text-content">{perms.length}</div>
          <div className="text-xs text-content-muted">permissions</div>
        </div>
      ))}
    </div>
  );
};

// --- Helpers for PermissionsManagement to reduce cognitive complexity ---

const INITIAL_PERM_FORM = { permissionId: '', key: '', name: '', description: '', module: '', actions: ['read'] };
const COMMON_ACTIONS = ['create', 'read', 'update', 'delete', 'list', 'export', 'import'];

const buildEditPermFormData = (permission) => ({
  permissionId: permission.permissionId || '', key: permission.key || '', name: permission.name || '',
  description: permission.description || '', module: permission.module || '', actions: permission.actions || ['read'],
});

const togglePermsExportMenu = () => document.getElementById('export-menu-perms').classList.toggle('hidden');
const hidePermsExportMenu = () => document.getElementById('export-menu-perms').classList.add('hidden');

const PermsHeader = ({ total, onExportCsv, onExportJson, onCreateClick }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-content">Permissions Management</h1>
      <p className="text-content-muted text-sm mt-1">Manage granular system permissions by module ({total} total)</p>
    </div>
    <div className="flex gap-2">
      <div className="relative">
        <button className="btn btn-secondary flex items-center gap-2" onClick={togglePermsExportMenu}>
          <Download size={16} /> Export
        </button>
        <div id="export-menu-perms" className="hidden absolute right-0 mt-1 bg-surface border rounded-lg shadow-lg z-10">
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={onExportCsv}>Export as CSV</button>
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={onExportJson}>Export as JSON</button>
        </div>
      </div>
      <button className="btn btn-primary flex items-center gap-2" onClick={onCreateClick}><Plus size={16} /> Add Permission</button>
    </div>
  </div>
);

const PermsFilterBar = ({ data }) => (
  <div className="card">
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
        <input type="text" placeholder="Search permissions by key or name..." className="input pl-10 w-full" value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
      </div>
      <div className="relative flex items-center gap-2">
        <Filter size={16} className="text-content-muted" />
        <select className="input" value={data.moduleFilter} onChange={(e) => { data.setModuleFilter(e.target.value); data.setPage(0); }}>
          <option value="">All Modules</option>
          {data.modules.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
        {data.moduleFilter && (<button className="text-sm text-blue-600 hover:underline" onClick={() => data.setModuleFilter('')}>Clear</button>)}
      </div>
    </div>
  </div>
);

const PermsPagination = ({ data }) => {
  if (data.totalPages <= 1) return null;
  return (
    <div className="px-4 py-3 border-t flex items-center justify-between">
      <div className="text-sm text-content-muted">Page {data.page + 1} of {data.totalPages} ({data.total} permissions)</div>
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" onClick={() => data.setPage((p) => Math.max(0, p - 1))} disabled={data.page === 0}><ChevronLeft size={16} /> Previous</button>
        <button className="btn btn-secondary btn-sm" onClick={() => data.setPage((p) => Math.min(data.totalPages - 1, p + 1))} disabled={data.page >= data.totalPages - 1}>Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
};

// --- Custom hook for permission modal state and handlers ---

function usePermissionModal(data) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [formData, setFormData] = useState(INITIAL_PERM_FORM);

  const handleInputChange = (e) => { const { name, value } = e.target; setFormData((prev) => ({ ...prev, [name]: value })); };

  const handleActionToggle = (action) => {
    setFormData((prev) => ({ ...prev, actions: prev.actions.includes(action) ? prev.actions.filter((a) => a !== action) : [...prev.actions, action] }));
  };

  const handleSelectAllActions = (selected) => setFormData((prev) => ({ ...prev, actions: selected ? [...COMMON_ACTIONS] : [] }));

  const openCreateModal = () => { setEditingPermission(null); setFormData({ ...INITIAL_PERM_FORM }); setModalOpen(true); };
  const openEditModal = (permission) => { setEditingPermission(permission); setFormData(buildEditPermFormData(permission)); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitPermission(editingPermission, formData, data.setSuccess);
      setModalOpen(false);
      data.fetchPermissions();
    } catch (err) { data.setError(err.response?.data?.detail || 'Failed to save permission'); }
  };

  return { modalOpen, editingPermission, formData, handleInputChange, handleActionToggle, handleSelectAllActions, openCreateModal, openEditModal, closeModal, handleSubmit };
}

async function submitPermission(editingPermission, formData, setSuccess) {
  if (editingPermission) {
    await permissionsAPI.update(editingPermission._id || editingPermission.key, formData);
    setSuccess('Permission updated successfully');
  } else {
    await permissionsAPI.create(formData);
    setSuccess('Permission created successfully');
  }
}

// --- Custom hook for relationship modal state and handlers ---

function useRelationshipModal() {
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [permissionRoles, setPermissionRoles] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  const showRelationships = async (permission) => {
    setSelectedPermission(permission);
    setRelationshipModalOpen(true);
    setLoadingRelationships(true);
    try {
      const [rolesRes, groupsRes] = await Promise.all([
        permissionsAPI.getRoles(permission._id || permission.key),
        permissionsAPI.getGroups(permission._id || permission.key),
      ]);
      setPermissionRoles(rolesRes.data || []);
      setPermissionGroups(groupsRes.data || []);
    } catch { setPermissionRoles([]); setPermissionGroups([]); }
    finally { setLoadingRelationships(false); }
  };

  const closeRelationshipModal = () => setRelationshipModalOpen(false);

  return { relationshipModalOpen, selectedPermission, permissionRoles, permissionGroups, loadingRelationships, showRelationships, closeRelationshipModal };
}

// --- Main Component ---

const PermissionsManagement = () => {
  const { isSuperAdmin } = useAuth();
  const data = usePermissionsData(isSuperAdmin);
  const actions = usePermissionActions(data.setError, data.setSuccess, data.fetchPermissions);
  const modal = usePermissionModal(data);
  const relModal = useRelationshipModal();

  const handleExportCsv = () => { actions.handleExport('csv'); hidePermsExportMenu(); };
  const handleExportJson = () => { actions.handleExport('json'); hidePermsExportMenu(); };

  if (!isSuperAdmin()) return <PermAccessDenied />;

  return (
    <div className="space-y-6">
      <PermsHeader total={data.total} onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCreateClick={modal.openCreateModal} />

      <PermAlertMessages error={data.error} success={data.success} />
      <ModuleStats permissionsByModule={data.permissionsByModule} moduleFilter={data.moduleFilter} onModuleClick={data.setModuleFilter} />

      <PermsFilterBar data={data} />

      <div className="card overflow-hidden">
        <PermissionsTable permissions={data.permissions} loading={data.loading} onShowRelationships={relModal.showRelationships} onEdit={modal.openEditModal} onDelete={actions.handleDelete} />
        <PermsPagination data={data} />
      </div>

      <Modal isOpen={modal.modalOpen} onClose={modal.closeModal} title={modal.editingPermission ? 'Edit Permission' : 'Create Permission'} size="lg">
        <PermissionForm formData={modal.formData} editingPermission={modal.editingPermission} modules={data.modules} commonActions={COMMON_ACTIONS}
          handleInputChange={modal.handleInputChange} handleActionToggle={modal.handleActionToggle} handleSelectAllActions={modal.handleSelectAllActions}
          handleSubmit={modal.handleSubmit} onClose={modal.closeModal} />
      </Modal>

      <RelationshipModal isOpen={relModal.relationshipModalOpen} onClose={relModal.closeRelationshipModal} selectedPermission={relModal.selectedPermission}
        loadingRelationships={relModal.loadingRelationships} permissionRoles={relModal.permissionRoles} permissionGroups={relModal.permissionGroups} />
    </div>
  );
};

export default PermissionsManagement;
