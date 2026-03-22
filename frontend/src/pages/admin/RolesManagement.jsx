import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { rolesAPI, permissionsAPI, domainsAPI, exportAPI } from '../../services/api';
import {
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Users,
  AlertCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import { Modal, Table } from '../../components/shared';
import { isActive } from '../../utils/status';

// --- Sub-components extracted to reduce cognitive complexity ---

const TagList = ({ items, colorClass, maxShow = 3 }) => {
  const safeItems = items || [];
  if (safeItems.length === 0) {
    return <span className="text-xs text-content-muted">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-xs">
      {safeItems.slice(0, maxShow).map((item, idx) => (
        <span key={idx} className={`px-2 py-0.5 text-xs ${colorClass} rounded`}>{item}</span>
      ))}
      {safeItems.length > maxShow && (
        <span className="px-2 py-0.5 text-xs bg-surface-hover text-content-muted rounded">
          +{safeItems.length - maxShow} more
        </span>
      )}
    </div>
  );
};

const PermissionsSection = ({ formData, groupedPermissions, isPermissionSelected, handlePermissionToggle, handleSelectAllPermissions, handleSelectAllModule }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <label className="block text-sm font-medium text-content-secondary">
        Permissions ({formData.permissions.length} selected)
      </label>
      <div className="flex gap-2">
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllPermissions(true)}>Select All</button>
        <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllPermissions(false)}>Clear All</button>
      </div>
    </div>
    <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-surface-secondary">
      {Object.keys(groupedPermissions).length === 0 ? (
        <p className="text-sm text-content-muted">No permissions available</p>
      ) : (
        Object.entries(groupedPermissions).map(([module, perms]) => (
          <div key={module} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-content-secondary">{module}</span>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllModule(module, true)}>All</button>
                <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllModule(module, false)}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {perms.map((perm) => (
                <label key={perm._id || perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isPermissionSelected(perm)} onChange={() => handlePermissionToggle(perm)} className="rounded border-edge" />
                  <span className="truncate" title={perm.description}>{perm.name || perm.key}</span>
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const DomainsSection = ({ formData, domains, isDomainSelected, handleDomainToggle, handleSelectAllDomains }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <label className="block text-sm font-medium text-content-secondary">
        Domains ({formData.domains.length} selected)
      </label>
      <div className="flex gap-2">
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllDomains(true)}>Select All</button>
        <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllDomains(false)}>Clear All</button>
      </div>
    </div>
    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-surface-secondary">
      {domains.length === 0 ? (
        <p className="text-sm text-content-muted">No domains available</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {domains.map((domain) => (
            <label key={domain._id || domain.domainId || domain.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isDomainSelected(domain)} onChange={() => handleDomainToggle(domain)} className="rounded border-edge" />
              <span className="truncate" title={domain.description}>{domain.name || domain.domainId || domain.key}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  </div>
);

const RoleForm = ({
  formData, editingRole, handleInputChange, handleSubmit,
  groupedPermissions, isPermissionSelected, handlePermissionToggle,
  handleSelectAllPermissions, handleSelectAllModule,
  domains, isDomainSelected, handleDomainToggle, handleSelectAllDomains,
  onClose,
}) => (
  <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Role ID <span className="text-red-500">*</span>
        </label>
        <input type="text" name="roleId" className="input w-full" value={formData.roleId} onChange={handleInputChange} required disabled={!!editingRole} placeholder="e.g., custom-role" />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input type="text" name="name" className="input w-full" value={formData.name} onChange={handleInputChange} required placeholder="Role Name" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea name="description" className="input w-full" rows={2} value={formData.description} onChange={handleInputChange} placeholder="Brief description of the role..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Type</label>
        <select name="type" className="input w-full" value={formData.type} onChange={handleInputChange}>
          <option value="custom">Custom</option>
          <option value="system">System</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Priority</label>
        <input type="number" name="priority" className="input w-full" value={formData.priority} onChange={handleInputChange} min={0} />
        <p className="text-xs text-content-muted mt-1">Lower values = higher priority</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Status</label>
        <select name="status" className="input w-full" value={formData.status} onChange={handleInputChange}>
          <option value="A">Active</option>
          <option value="I">Inactive</option>
        </select>
      </div>
    </div>

    <PermissionsSection
      formData={formData}
      groupedPermissions={groupedPermissions}
      isPermissionSelected={isPermissionSelected}
      handlePermissionToggle={handlePermissionToggle}
      handleSelectAllPermissions={handleSelectAllPermissions}
      handleSelectAllModule={handleSelectAllModule}
    />

    <DomainsSection
      formData={formData}
      domains={domains}
      isDomainSelected={isDomainSelected}
      handleDomainToggle={handleDomainToggle}
      handleSelectAllDomains={handleSelectAllDomains}
    />

    <div className="flex justify-end gap-3 pt-4 border-t">
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="btn btn-primary">
        {editingRole ? 'Update Role' : 'Create Role'}
      </button>
    </div>
  </form>
);

const RoleUsersModal = ({ isOpen, onClose, selectedRole, loadingUsers, roleUsers }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Users with Role: ${selectedRole?.name || ''}`} size="lg">
    <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
      {loadingUsers ? (
        <div className="text-center py-8 text-content-muted">Loading users...</div>
      ) : roleUsers.length === 0 ? (
        <div className="text-center py-8 text-content-muted">No users have this role assigned.</div>
      ) : (
        <div className="space-y-3">
          {roleUsers.map((user) => (
            <div key={user._id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
              <div>
                <div className="font-medium text-content">{user.full_name || user.username || user.email}</div>
                <div className="text-sm text-content-muted">{user.email}</div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="px-6 py-4 border-t flex justify-end">
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    </div>
  </Modal>
);

const AccessDeniedView = () => (
  <div className="text-center py-12">
    <Shield className="mx-auto text-content-muted mb-4" size={48} />
    <h2 className="text-xl font-semibold text-content mb-2">Access Denied</h2>
    <p className="text-content-muted">Only Super Administrators can access this page.</p>
  </div>
);

const AlertMessages = ({ error, success }) => (
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

const RolesHeader = ({ total, onExport, onCreateClick }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-content">Roles Management</h1>
      <p className="text-content-muted text-sm mt-1">Manage roles and their permissions ({total} total)</p>
    </div>
    <div className="flex gap-2">
      <div className="relative">
        <button className="btn btn-secondary flex items-center gap-2" onClick={() => document.getElementById('export-menu').classList.toggle('hidden')}>
          <Download size={16} /> Export
        </button>
        <div id="export-menu" className="hidden absolute right-0 mt-1 bg-surface border rounded-lg shadow-lg z-10">
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={() => { onExport('csv'); document.getElementById('export-menu').classList.add('hidden'); }}>Export as CSV</button>
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={() => { onExport('json'); document.getElementById('export-menu').classList.add('hidden'); }}>Export as JSON</button>
        </div>
      </div>
      <button className="btn btn-primary flex items-center gap-2" onClick={onCreateClick}>
        <Plus size={16} /> Add Role
      </button>
    </div>
  </div>
);

const RolesStats = ({ roles, total, filterDomain, filterPermission }) => {
  if (filterDomain || filterPermission || roles.length === 0) return null;
  const active = roles.filter(r => isActive(r.status)).length;
  const system = roles.filter(r => r.type === 'system').length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4">
        <div className="text-sm text-content-muted">Total Roles</div>
        <div className="text-2xl font-bold text-content">{total}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">Active</div>
        <div className="text-2xl font-bold text-green-600">{active}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">Inactive</div>
        <div className="text-2xl font-bold text-red-600">{total - active}</div>
      </div>
      <div className="card p-4">
        <div className="text-sm text-content-muted">System Roles</div>
        <div className="text-2xl font-bold text-content">{system}</div>
      </div>
    </div>
  );
};

const RolesFilterBar = ({ search, onSearchChange, filterDomain, onFilterDomainChange, filterPermission, onFilterPermissionChange, domains, permissions, onClearFilters }) => (
  <div className="card !p-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
        <input type="text" placeholder="Search roles by name or ID..." className="input !py-2 pl-10 w-full" value={search} onChange={(e) => onSearchChange(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-content-muted shrink-0" />
        <select className="input !py-2 min-w-[140px]" value={filterDomain} onChange={(e) => onFilterDomainChange(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map((domain) => (
            <option key={domain.key || domain._id} value={domain.key || domain._id}>{domain.name}</option>
          ))}
        </select>
        <select className="input !py-2 min-w-[140px]" value={filterPermission} onChange={(e) => onFilterPermissionChange(e.target.value)}>
          <option value="">All Permissions</option>
          {permissions.map((perm) => (
            <option key={perm.key} value={perm.key}>{perm.name || perm.key}</option>
          ))}
        </select>
        {(filterDomain || filterPermission) && (
          <button className="text-sm text-primary-600 hover:underline whitespace-nowrap" onClick={onClearFilters}>Clear</button>
        )}
      </div>
    </div>
  </div>
);

const RolesPagination = ({ page, limit, total, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-edge">
      <p className="text-sm text-content-muted">
        Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} roles
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-content-muted">Page {page + 1} of {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

// --- Helper functions outside component ---

const EMPTY_FORM = { roleId: '', name: '', description: '', type: 'custom', permissions: [], domains: [], status: 'A', priority: 0 };

function groupPermissionsByModule(permissions) {
  return permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});
}

function buildRoleFetchParams(page, limit, debouncedSearch, filterDomain, filterPermission) {
  const params = { page, limit };
  if (debouncedSearch) params.search = debouncedSearch;
  if (filterDomain) params.domain = filterDomain;
  if (filterPermission) params.permission = filterPermission;
  return params;
}

function buildFormDataFromRole(role) {
  return {
    roleId: role.roleId || '', name: role.name || '', description: role.description || '',
    type: role.type || 'custom', permissions: role.permissions || [], domains: role.domains || [],
    status: role.status || 'A', priority: role.priority || 0,
  };
}

function checkPermissionSelected(formPermissions, perm) {
  return formPermissions.includes(perm._id) || formPermissions.includes(perm.permissionId) || formPermissions.includes(perm.key);
}

function checkDomainSelected(formDomains, domain) {
  return formDomains.includes(domain._id) || formDomains.includes(domain.domainId) || formDomains.includes(domain.domainKey) || formDomains.includes(domain.key);
}

async function downloadExport(exportFn, format, filename) {
  const response = await exportFn();
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([response.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// --- Custom hook for roles data fetching ---

function useRolesData(isSuperAdmin) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterPermission, setFilterPermission] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildRoleFetchParams(page, limit, debouncedSearch, filterDomain, filterPermission);
      const response = await rolesAPI.list(params);
      const responseData = response?.data || {};
      setRoles(responseData.data || []);
      if (responseData.pagination) {
        setTotalPages(responseData.pagination.pages || 0);
        setTotal(responseData.pagination.total || 0);
      }
    } catch { setError('Failed to fetch roles'); }
    finally { setLoading(false); }
  }, [page, limit, debouncedSearch, filterDomain, filterPermission]);

  const fetchFormData = useCallback(async () => {
    try {
      const [permRes, domRes] = await Promise.all([permissionsAPI.list({ limit: 1000 }), domainsAPI.list({ limit: 1000 })]);
      setPermissions(permRes?.data?.data || []);
      setDomains(domRes?.data?.data || []);
    } catch { /* silently handled */ }
  }, []);

  useEffect(() => { if (isSuperAdmin()) { fetchRoles(); fetchFormData(); } }, [fetchRoles, fetchFormData, isSuperAdmin]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const handleFilterDomainChange = (value) => { setFilterDomain(value); setPage(0); };
  const handleFilterPermissionChange = (value) => { setFilterPermission(value); setPage(0); };
  const handleClearFilters = () => { setFilterDomain(''); setFilterPermission(''); setPage(0); };

  return {
    roles, permissions, domains, loading, error, success, setError, setSuccess,
    page, setPage, limit, totalPages, total, search, setSearch,
    filterDomain, filterPermission, fetchRoles,
    handleFilterDomainChange, handleFilterPermissionChange, handleClearFilters,
  };
}

// --- Custom hook for role form state and selection helpers ---

function useRoleForm(permissions, domains) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const groupedPermissions = groupPermissionsByModule(permissions);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
  };

  const isPermissionSelected = (perm) => checkPermissionSelected(formData.permissions, perm);
  const isDomainSelected = (domain) => checkDomainSelected(formData.domains, domain);

  const handlePermissionToggle = (perm) => {
    const isSelected = isPermissionSelected(perm);
    setFormData((prev) => ({
      ...prev,
      permissions: isSelected
        ? prev.permissions.filter((p) => p !== perm._id && p !== perm.permissionId && p !== perm.key)
        : [...prev.permissions, perm._id],
    }));
  };

  const handleDomainToggle = (domain) => {
    const isSelected = isDomainSelected(domain);
    setFormData((prev) => ({
      ...prev,
      domains: isSelected
        ? prev.domains.filter((d) => d !== domain._id && d !== domain.domainId && d !== domain.domainKey && d !== domain.key)
        : [...prev.domains, domain._id],
    }));
  };

  const handleSelectAllModule = (module, selected) => {
    const modulePerms = groupedPermissions[module];
    const modulePermIds = modulePerms.map((p) => p._id);
    const modulePermKeys = modulePerms.map((p) => p.key);
    setFormData((prev) => ({
      ...prev,
      permissions: selected
        ? [...new Set([...prev.permissions, ...modulePermIds])]
        : prev.permissions.filter((p) => !modulePermIds.includes(p) && !modulePermKeys.includes(p)),
    }));
  };

  const handleSelectAllDomains = (selected) => { setFormData((prev) => ({ ...prev, domains: selected ? domains.map((d) => d._id) : [] })); };
  const handleSelectAllPermissions = (selected) => { setFormData((prev) => ({ ...prev, permissions: selected ? permissions.map((p) => p._id) : [] })); };

  const openCreateModal = () => { setEditingRole(null); setFormData({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEditModal = (role) => { setEditingRole(role); setFormData(buildFormDataFromRole(role)); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  return {
    modalOpen, editingRole, formData, groupedPermissions,
    handleInputChange, isPermissionSelected, isDomainSelected,
    handlePermissionToggle, handleDomainToggle, handleSelectAllModule,
    handleSelectAllDomains, handleSelectAllPermissions,
    openCreateModal, openEditModal, closeModal,
  };
}

// --- Custom hook for role CRUD actions ---

function useRoleActions(setError, setSuccess, fetchRoles) {
  const handleSubmit = async (e, editingRole, formData, closeModal) => {
    e.preventDefault();
    try {
      await submitRole(editingRole, formData, setSuccess);
      closeModal();
      fetchRoles();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save role'); }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Are you sure you want to delete role "${role.name}"?`)) return;
    try {
      await rolesAPI.delete(role._id || role.roleId);
      setSuccess('Role deleted successfully');
      fetchRoles();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to delete role'); }
  };

  const handleToggleStatus = async (role) => {
    try {
      await rolesAPI.toggleStatus(role._id || role.roleId);
      setSuccess(`Role ${isActive(role.status) ? 'deactivated' : 'activated'} successfully`);
      fetchRoles();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to toggle role status'); }
  };

  const handleExport = async (format) => {
    try {
      const exportFn = format === 'csv' ? exportAPI.roles.csv : exportAPI.roles.json;
      await downloadExport(exportFn, format, `roles_export.${format}`);
      setSuccess(`Exported roles as ${format.toUpperCase()}`);
    } catch { setError('Failed to export roles'); }
  };

  return { handleSubmit, handleDelete, handleToggleStatus, handleExport };
}

async function submitRole(editingRole, formData, setSuccess) {
  if (editingRole) {
    await rolesAPI.update(editingRole._id || editingRole.roleId, formData);
    setSuccess('Role updated successfully');
  } else {
    await rolesAPI.create(formData);
    setSuccess('Role created successfully');
  }
}

// --- Custom hook for role users modal ---

function useRoleUsersModal() {
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const showUsers = async (role) => {
    setSelectedRole(role);
    setUsersModalOpen(true);
    setLoadingUsers(true);
    try {
      const response = await rolesAPI.getUsers(role._id || role.roleId);
      setRoleUsers(response?.data || []);
    } catch { setRoleUsers([]); }
    finally { setLoadingUsers(false); }
  };

  const closeUsersModal = () => setUsersModalOpen(false);

  return { usersModalOpen, selectedRole, roleUsers, loadingUsers, showUsers, closeUsersModal };
}

// --- Main Component ---

const RolesManagement = () => {
  const { isSuperAdmin } = useAuth();
  const data = useRolesData(isSuperAdmin);
  const form = useRoleForm(data.permissions, data.domains);
  const crud = useRoleActions(data.setError, data.setSuccess, data.fetchRoles);
  const usersModal = useRoleUsersModal();

  const onSubmit = (e) => crud.handleSubmit(e, form.editingRole, form.formData, form.closeModal);

  const roleColumns = [
    { key: 'roleId', title: 'Role ID', render: (val) => <span className="font-mono text-sm text-content-muted">{val}</span> },
    { key: 'name', title: 'Name', render: (_, role) => (
      <div>
        <div className="font-medium text-content">{role.name}</div>
        {role.description && <div className="text-xs text-content-muted truncate max-w-xs">{role.description}</div>}
      </div>
    )},
    { key: 'type', title: 'Type', render: (val) => {
      const typeClass = val === 'system' ? 'bg-purple-100 text-purple-700' : 'bg-surface-hover text-content-secondary';
      return <span className={`px-2 py-1 text-xs rounded-full ${typeClass}`}>{val || 'custom'}</span>;
    }},
    { key: 'permissions', title: 'Permissions', render: (val) => <TagList items={val} colorClass="bg-blue-100 text-blue-700" />, filterValue: (val) => (val || []).join(','), sortable: false },
    { key: 'domains', title: 'Domains', render: (val) => <TagList items={val} colorClass="bg-green-100 text-green-700" />, filterValue: (val) => (val || []).join(','), sortable: false },
    { key: 'priority', title: 'Priority', render: (val) => <span className="text-sm text-content-muted">{val || 0}</span>, sortValue: (val) => val || 0 },
    { key: 'status', title: 'Status', render: (val) => {
      const active = isActive(val);
      const statusClass = active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
      return <span className={`px-2 py-1 text-xs rounded-full ${statusClass}`}>{active ? 'Active' : 'Inactive'}</span>;
    }},
    { key: 'actions', title: 'Actions', render: (_, role) => {
      const active = isActive(role.status);
      const toggleClass = active ? 'text-green-600 hover:bg-green-50' : 'text-content-muted hover:bg-surface-hover';
      return (
        <div className="flex items-center justify-end gap-1">
          <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => usersModal.showUsers(role)} title="View Users" aria-label="View Users">
            <Users size={18} />
          </button>
          <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => form.openEditModal(role)} title="Edit" aria-label="Edit">
            <Edit2 size={18} />
          </button>
          <button className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${toggleClass}`} onClick={() => crud.handleToggleStatus(role)} title={active ? 'Deactivate' : 'Activate'} aria-label={active ? 'Deactivate' : 'Activate'}>
            {active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
          <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => crud.handleDelete(role)} title="Delete" aria-label="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      );
    }}
  ];

  if (!isSuperAdmin()) {
    return <AccessDeniedView />;
  }

  return (
    <div className="space-y-6">
      <RolesHeader total={data.total} onExport={crud.handleExport} onCreateClick={form.openCreateModal} />
      <AlertMessages error={data.error} success={data.success} />

      <RolesStats roles={data.roles} total={data.total} filterDomain={data.filterDomain} filterPermission={data.filterPermission} />

      <RolesFilterBar
        search={data.search} onSearchChange={data.setSearch}
        filterDomain={data.filterDomain} onFilterDomainChange={data.handleFilterDomainChange}
        filterPermission={data.filterPermission} onFilterPermissionChange={data.handleFilterPermissionChange}
        domains={data.domains} permissions={data.permissions} onClearFilters={data.handleClearFilters}
      />

      <div className="card overflow-hidden">
        <Table columns={roleColumns} data={data.roles} loading={data.loading} />
        <RolesPagination page={data.page} limit={data.limit} total={data.total} totalPages={data.totalPages} onPageChange={data.setPage} />
      </div>

      <Modal isOpen={form.modalOpen} onClose={form.closeModal} title={form.editingRole ? 'Edit Role' : 'Create Role'} size="xl">
        <RoleForm
          formData={form.formData} editingRole={form.editingRole} handleInputChange={form.handleInputChange} handleSubmit={onSubmit}
          groupedPermissions={form.groupedPermissions} isPermissionSelected={form.isPermissionSelected} handlePermissionToggle={form.handlePermissionToggle}
          handleSelectAllPermissions={form.handleSelectAllPermissions} handleSelectAllModule={form.handleSelectAllModule}
          domains={data.domains} isDomainSelected={form.isDomainSelected} handleDomainToggle={form.handleDomainToggle} handleSelectAllDomains={form.handleSelectAllDomains}
          onClose={form.closeModal}
        />
      </Modal>

      <RoleUsersModal isOpen={usersModal.usersModalOpen} onClose={usersModal.closeUsersModal} selectedRole={usersModal.selectedRole} loadingUsers={usersModal.loadingUsers} roleUsers={usersModal.roleUsers} />
    </div>
  );
};

export default RolesManagement;
