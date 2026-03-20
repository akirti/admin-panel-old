import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { groupsAPI, permissionsAPI, domainsAPI, customersAPI, exportAPI } from '../../services/api';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  Shield,
  Filter,
} from 'lucide-react';
import { Modal, Table } from '../../components/shared';

// --- Stat Widgets ---

const GroupsStats = ({ groups, total, filterDomain, filterPermission }) => {
  if (filterDomain || filterPermission || groups.length === 0) return null;
  const active = groups.filter(g => g.status === 'active').length;
  const types = {};
  groups.forEach(g => { const t = g.type || 'default'; types[t] = (types[t] || 0) + 1; });
  const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4 cursor-pointer hover:border-primary-300 transition-colors">
        <div className="text-sm text-content-muted">Total Groups</div>
        <div className="text-2xl font-bold text-content">{total}</div>
      </div>
      <div className="card p-4 cursor-pointer hover:border-primary-300 transition-colors">
        <div className="text-sm text-content-muted">Active</div>
        <div className="text-2xl font-bold text-green-600">{active}</div>
      </div>
      <div className="card p-4 cursor-pointer hover:border-primary-300 transition-colors">
        <div className="text-sm text-content-muted">Inactive</div>
        <div className="text-2xl font-bold text-red-600">{total - active}</div>
      </div>
      {topType && (
        <div className="card p-4 cursor-pointer hover:border-primary-300 transition-colors">
          <div className="text-sm text-content-muted capitalize">{topType[0]}</div>
          <div className="text-2xl font-bold text-content">{topType[1]}</div>
          <div className="text-xs text-content-muted">groups</div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components extracted to reduce cognitive complexity ---


const TagList = ({ items, colorClass, maxShow = 3 }) => {
  const safeItems = items || [];
  if (safeItems.length === 0) {
    return <span className="text-xs text-content-muted">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-xs">
      {safeItems.slice(0, maxShow).map((item, idx) => (
        <span key={idx} className={`px-2 py-0.5 text-xs ${colorClass} rounded`}>
          {item}
        </span>
      ))}
      {safeItems.length > maxShow && (
        <span className="px-2 py-0.5 text-xs bg-surface-hover text-content-muted rounded">
          +{safeItems.length - maxShow} more
        </span>
      )}
    </div>
  );
};


const PermissionsSection = ({
  formData,
  groupedPermissions,
  isPermissionSelected,
  handlePermissionToggle,
  handleSelectAllPermissions,
  handleSelectAllModule,
}) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <label className="block text-sm font-medium text-content-secondary">
        Permissions ({formData.permissions.length} selected)
      </label>
      <div className="flex gap-2">
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllPermissions(true)}>
          Select All
        </button>
        <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllPermissions(false)}>
          Clear All
        </button>
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
                  <input
                    type="checkbox"
                    checked={isPermissionSelected(perm)}
                    onChange={() => handlePermissionToggle(perm)}
                    className="rounded border-edge"
                  />
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
              <input
                type="checkbox"
                checked={isDomainSelected(domain)}
                onChange={() => handleDomainToggle(domain)}
                className="rounded border-edge"
              />
              <span className="truncate" title={domain.description}>{domain.name || domain.domainId || domain.key}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  </div>
);

const CustomersSection = ({
  formData,
  filteredCustomers,
  allCustomers,
  customerSearch,
  setCustomerSearch,
  isCustomerSelected,
  handleCustomerToggle,
  handleSelectAllCustomers,
}) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <label className="block text-sm font-medium text-content-secondary">
        Customers ({formData.customers.length} selected)
      </label>
      <div className="flex gap-2">
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAllCustomers(true)}>Select All</button>
        <button type="button" className="text-xs text-content-muted hover:underline" onClick={() => handleSelectAllCustomers(false)}>Clear All</button>
      </div>
    </div>
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={16} />
      <input
        type="text"
        placeholder="Search customers by ID or name..."
        className="input pl-9 w-full text-sm"
        value={customerSearch}
        onChange={(e) => setCustomerSearch(e.target.value)}
      />
    </div>
    {formData.customers.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {formData.customers.map((cid) => {
          const cust = allCustomers.find((c) => c.customerId === cid);
          return (
            <span key={cid} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
              {cid}{cust?.name ? ` \u2014 ${cust.name}` : ''}
              <button type="button" onClick={() => handleCustomerToggle({ customerId: cid })} className="text-orange-500 hover:text-orange-700">
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
    )}
    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-surface-secondary">
      {filteredCustomers.length === 0 ? (
        <p className="text-sm text-content-muted">No customers found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredCustomers.map((customer) => (
            <label key={customer._id || customer.customerId} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isCustomerSelected(customer)}
                onChange={() => handleCustomerToggle(customer)}
                className="rounded border-edge"
              />
              <span className="truncate" title={`${customer.customerId} \u2014 ${customer.name}`}>
                <span className="font-medium">{customer.customerId}</span>
                {customer.name && (
                  <span className="text-content-muted ml-1">&mdash; {customer.name}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  </div>
);

const GroupForm = ({
  formData,
  editingGroup,
  groupTypes,
  handleInputChange,
  handleSubmit,
  groupedPermissions,
  isPermissionSelected,
  handlePermissionToggle,
  handleSelectAllPermissions,
  handleSelectAllModule,
  domains,
  isDomainSelected,
  handleDomainToggle,
  handleSelectAllDomains,
  filteredCustomers,
  allCustomers,
  customerSearch,
  setCustomerSearch,
  isCustomerSelected,
  handleCustomerToggle,
  handleSelectAllCustomers,
  onClose,
}) => (
  <form onSubmit={handleSubmit}>
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Group ID <span className="text-red-500">*</span>
        </label>
        <input type="text" name="groupId" className="input w-full" value={formData.groupId} onChange={handleInputChange} required disabled={!!editingGroup} placeholder="e.g., custom-group" />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input type="text" name="name" className="input w-full" value={formData.name} onChange={handleInputChange} required placeholder="Group Name" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea name="description" className="input w-full" rows={2} value={formData.description} onChange={handleInputChange} placeholder="Brief description of the group..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Type</label>
        <select name="type" className="input w-full" value={formData.type} onChange={handleInputChange}>
          {groupTypes.length > 0 ? (
            groupTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))
          ) : (
            <>
              <option value="domain">Domain</option>
              <option value="authentication">Authentication</option>
              <option value="bookmark">Bookmark</option>
              <option value="system">System</option>
            </>
          )}
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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

    {formData.type === 'customers' && (
      <CustomersSection
        formData={formData}
        filteredCustomers={filteredCustomers}
        allCustomers={allCustomers}
        customerSearch={customerSearch}
        setCustomerSearch={setCustomerSearch}
        isCustomerSelected={isCustomerSelected}
        handleCustomerToggle={handleCustomerToggle}
        handleSelectAllCustomers={handleSelectAllCustomers}
      />
    )}

    <div className="flex justify-end gap-3 pt-4 border-t">
      <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="btn btn-primary">
        {editingGroup ? 'Update Group' : 'Create Group'}
      </button>
    </div>
  </form>
);

const GroupUsersModal = ({ isOpen, onClose, selectedGroup, loadingUsers, groupUsers }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Users in Group: ${selectedGroup?.name || ''}`} size="lg">
    <div>
      {loadingUsers ? (
        <div className="text-center py-8 text-content-muted">Loading users...</div>
      ) : groupUsers.length === 0 ? (
        <div className="text-center py-8 text-content-muted">No users are in this group.</div>
      ) : (
        <div className="space-y-3">
          {groupUsers.map((user) => (
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
    <div className="pt-4 border-t flex justify-end">
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    </div>
  </Modal>
);

// --- Custom hooks extracted to reduce cognitive complexity ---

function useGroupsData(isSuperAdmin) {
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [domains, setDomains] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [groupTypes, setGroupTypes] = useState([]);
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

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterDomain) params.domain = filterDomain;
      if (filterPermission) params.permission = filterPermission;
      const response = await groupsAPI.list(params);
      const responseData = response?.data || {};
      setGroups(responseData.data || []);
      if (responseData.pagination) {
        setTotalPages(responseData.pagination.pages || 0);
        setTotal(responseData.pagination.total || 0);
      }
    } catch (err) {
      setError('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, filterDomain, filterPermission]);

  const fetchFormData = useCallback(async () => {
    try {
      const [permRes, domRes, typesRes, custRes] = await Promise.all([
        permissionsAPI.list({ limit: 1000 }), domainsAPI.list({ limit: 1000 }),
        groupsAPI.getTypes(), customersAPI.list({ limit: 1000 }),
      ]);
      setPermissions(permRes?.data?.data || []);
      setDomains(domRes?.data?.data || []);
      setGroupTypes(typesRes?.data || []);
      setAllCustomers(custRes?.data?.data || []);
    } catch (err) { /* error handled silently */ }
  }, []);

  useEffect(() => {
    if (isSuperAdmin()) { fetchGroups(); fetchFormData(); }
  }, [fetchGroups, fetchFormData, isSuperAdmin]);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const groupedPermissions = permissions.reduce((acc, perm) => {
    const module = perm.module || 'Other';
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  return {
    groups, permissions, domains, allCustomers, groupTypes, loading, error, success,
    setError, setSuccess, page, setPage, limit, totalPages, total, search, setSearch,
    filterDomain, setFilterDomain, filterPermission, setFilterPermission,
    fetchGroups, groupedPermissions,
  };
}

function useGroupFormModal(data) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState(INITIAL_GROUP_FORM);

  const filteredCustomers = filterCustomersBySearch(data.allCustomers, customerSearch);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
  };

  const isPermissionSelected = (perm) =>
    formData.permissions.includes(perm._id) || formData.permissions.includes(perm.permissionId) || formData.permissions.includes(perm.key);

  const isDomainSelected = (domain) =>
    formData.domains.includes(domain._id) || formData.domains.includes(domain.domainId) || formData.domains.includes(domain.domainKey) || formData.domains.includes(domain.key);

  const isCustomerSelected = (customer) =>
    formData.customers.includes(customer.customerId) || formData.customers.includes(customer._id);

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

  const handleCustomerToggle = (customer) => {
    const isSelected = isCustomerSelected(customer);
    setFormData((prev) => ({
      ...prev,
      customers: isSelected
        ? prev.customers.filter((c) => c !== customer.customerId && c !== customer._id)
        : [...prev.customers, customer.customerId],
    }));
  };

  const handleSelectAllModule = (module, selected) => {
    const modulePerms = data.groupedPermissions[module];
    const modulePermIds = modulePerms.map((p) => p._id);
    const modulePermKeys = modulePerms.map((p) => p.key);
    setFormData((prev) => ({
      ...prev,
      permissions: selected
        ? [...new Set([...prev.permissions, ...modulePermIds])]
        : prev.permissions.filter((p) => !modulePermIds.includes(p) && !modulePermKeys.includes(p)),
    }));
  };

  const handleSelectAllDomains = (selected) => setFormData((prev) => ({ ...prev, domains: selected ? data.domains.map((d) => d._id) : [] }));
  const handleSelectAllPermissions = (selected) => setFormData((prev) => ({ ...prev, permissions: selected ? data.permissions.map((p) => p._id) : [] }));
  const handleSelectAllCustomers = (selected) => setFormData((prev) => ({ ...prev, customers: selected ? filteredCustomers.map((c) => c.customerId) : [] }));

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData(buildCreateFormData(data.groupTypes));
    setCustomerSearch('');
    setModalOpen(true);
  };

  const openEditModal = (group) => {
    setEditingGroup(group);
    setFormData(buildEditFormData(group));
    setCustomerSearch('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await groupsAPI.update(editingGroup._id || editingGroup.groupId, formData);
        data.setSuccess('Group updated successfully');
      } else {
        await groupsAPI.create(formData);
        data.setSuccess('Group created successfully');
      }
      setModalOpen(false);
      data.fetchGroups();
    } catch (err) { data.setError(err.response?.data?.detail || 'Failed to save group'); }
  };

  return {
    modalOpen, editingGroup, formData, customerSearch, setCustomerSearch, filteredCustomers,
    openCreateModal, openEditModal, closeModal, handleSubmit,
    handleInputChange, isPermissionSelected, isDomainSelected, isCustomerSelected,
    handlePermissionToggle, handleDomainToggle, handleCustomerToggle,
    handleSelectAllModule, handleSelectAllDomains, handleSelectAllPermissions, handleSelectAllCustomers,
  };
}

function useGroupUsersModal() {
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupUsers, setGroupUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const showUsers = async (group) => {
    setSelectedGroup(group);
    setUsersModalOpen(true);
    setLoadingUsers(true);
    try {
      const response = await groupsAPI.getUsers(group._id || group.groupId);
      setGroupUsers(response?.data || []);
    } catch (err) { setGroupUsers([]); }
    finally { setLoadingUsers(false); }
  };

  const closeUsersModal = () => setUsersModalOpen(false);

  return { usersModalOpen, selectedGroup, groupUsers, loadingUsers, showUsers, closeUsersModal };
}

function useGroupActions(data) {
  const handleDelete = async (group) => {
    if (!window.confirm(`Are you sure you want to delete group "${group.name}"?`)) return;
    try {
      await groupsAPI.delete(group._id || group.groupId);
      data.setSuccess('Group deleted successfully');
      data.fetchGroups();
    } catch (err) { data.setError(err.response?.data?.detail || 'Failed to delete group'); }
  };

  const handleToggleStatus = async (group) => {
    try {
      await groupsAPI.toggleStatus(group._id || group.groupId);
      data.setSuccess(`Group ${group.status === 'active' ? 'deactivated' : 'activated'} successfully`);
      data.fetchGroups();
    } catch (err) { data.setError(err.response?.data?.detail || 'Failed to toggle group status'); }
  };

  const handleExport = async (format) => {
    try {
      const response = format === 'csv' ? await exportAPI.groups.csv() : await exportAPI.groups.json();
      const blob = new Blob([response.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `groups_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      data.setSuccess(`Exported groups as ${format.toUpperCase()}`);
    } catch (err) { data.setError('Failed to export groups'); }
  };

  return { handleDelete, handleToggleStatus, handleExport };
}

const AccessDenied = () => (
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
        <AlertCircle size={20} />
        {error}
      </div>
    )}
    {success && (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle size={20} />
        {success}
      </div>
    )}
  </>
);

// --- Helpers for GroupsManagement to reduce cognitive complexity ---

const INITIAL_GROUP_FORM = {
  groupId: '', name: '', description: '', type: 'domain',
  permissions: [], domains: [], customers: [], status: 'active', priority: 0,
};

const buildCreateFormData = (groupTypes) => ({
  ...INITIAL_GROUP_FORM,
  type: groupTypes.length > 0 ? groupTypes[0].value : 'domain',
});

const buildEditFormData = (group) => ({
  groupId: group.groupId || '', name: group.name || '', description: group.description || '',
  type: group.type || 'custom', permissions: group.permissions || [], domains: group.domains || [],
  customers: group.customers || [], status: group.status || 'active', priority: group.priority || 0,
});

const filterCustomersBySearch = (customers, searchTerm) => {
  if (!searchTerm.trim()) return customers;
  const term = searchTerm.toLowerCase();
  return customers.filter((c) =>
    (c.customerId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term)
  );
};

const toggleExportMenu = () => document.getElementById('export-menu-groups').classList.toggle('hidden');
const hideExportMenu = () => document.getElementById('export-menu-groups').classList.add('hidden');

const GroupsHeader = ({ total, onExportCsv, onExportJson, onCreateClick }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-content">Groups Management</h1>
      <p className="text-content-muted text-sm mt-1">Manage user groups and their permissions ({total} total)</p>
    </div>
    <div className="flex gap-2">
      <div className="relative">
        <button className="btn btn-secondary flex items-center gap-2" onClick={toggleExportMenu}>
          <Download size={16} /> Export
        </button>
        <div id="export-menu-groups" className="hidden absolute right-0 mt-1 bg-surface border rounded-lg shadow-lg z-10">
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={onExportCsv}>Export as CSV</button>
          <button className="block w-full px-4 py-2 text-left hover:bg-surface-hover" onClick={onExportJson}>Export as JSON</button>
        </div>
      </div>
      <button className="btn btn-primary flex items-center gap-2" onClick={onCreateClick}>
        <Plus size={16} /> Add Group
      </button>
    </div>
  </div>
);

const GroupsFilterBar = ({ data }) => (
  <div className="card !p-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
        <input type="text" placeholder="Search groups by name or ID..." className="input !py-2 pl-10 w-full" value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-content-muted shrink-0" />
        <select className="input !py-2 min-w-[140px]" value={data.filterDomain} onChange={(e) => { data.setFilterDomain(e.target.value); data.setPage(0); }}>
          <option value="">All Domains</option>
          {data.domains.map((domain) => (
            <option key={domain.key || domain._id} value={domain.key || domain._id}>{domain.name}</option>
          ))}
        </select>
        <select className="input !py-2 min-w-[140px]" value={data.filterPermission} onChange={(e) => { data.setFilterPermission(e.target.value); data.setPage(0); }}>
          <option value="">All Permissions</option>
          {data.permissions.map((perm) => (
            <option key={perm.key} value={perm.key}>{perm.name || perm.key}</option>
          ))}
        </select>
        {(data.filterDomain || data.filterPermission) && (
          <button className="text-sm text-primary-600 hover:underline whitespace-nowrap" onClick={() => { data.setFilterDomain(''); data.setFilterPermission(''); data.setPage(0); }}>Clear Filters</button>
        )}
      </div>
    </div>
  </div>
);

const GroupsPagination = ({ data }) => {
  if (data.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-edge">
      <p className="text-sm text-content-muted">Showing {data.page * data.limit + 1} to {Math.min((data.page + 1) * data.limit, data.total)} of {data.total} groups</p>
      <div className="flex items-center gap-2">
        <button onClick={() => data.setPage((p) => Math.max(0, p - 1))} disabled={data.page === 0} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted"><ChevronLeft size={20} /></button>
        <span className="text-sm text-content-muted">Page {data.page + 1} of {data.totalPages}</span>
        <button onClick={() => data.setPage((p) => Math.min(data.totalPages - 1, p + 1))} disabled={data.page >= data.totalPages - 1} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted"><ChevronRight size={20} /></button>
      </div>
    </div>
  );
};

// --- Main Component ---

const GroupsManagement = () => {
  const { isSuperAdmin } = useAuth();
  const data = useGroupsData(isSuperAdmin);
  const actions = useGroupActions(data);
  const modal = useGroupFormModal(data);
  const usersModal = useGroupUsersModal();

  const handleExportCsv = () => { actions.handleExport('csv'); hideExportMenu(); };
  const handleExportJson = () => { actions.handleExport('json'); hideExportMenu(); };

  if (!isSuperAdmin()) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <GroupsHeader total={data.total} onExportCsv={handleExportCsv} onExportJson={handleExportJson} onCreateClick={modal.openCreateModal} />

      <AlertMessages error={data.error} success={data.success} />

      <GroupsStats groups={data.groups} total={data.total} filterDomain={data.filterDomain} filterPermission={data.filterPermission} />

      <GroupsFilterBar data={data} />

      <div className="card overflow-hidden">
        <Table
          columns={[
            {
              key: 'groupId',
              title: 'Group ID',
              render: (val) => <span className="font-mono text-sm text-content-muted">{val}</span>,
            },
            {
              key: 'name',
              title: 'Name',
              render: (val, row) => (
                <div>
                  <div className="font-medium text-content">{row.name}</div>
                  {row.description && <div className="text-xs text-content-muted truncate max-w-xs">{row.description}</div>}
                </div>
              ),
            },
            {
              key: 'type',
              title: 'Type',
              render: (val) => {
                const typeClass = val === 'system' ? 'bg-purple-100 text-purple-700' : 'bg-surface-hover text-content-secondary';
                return <span className={`px-2 py-1 text-xs rounded-full ${typeClass}`}>{val || 'custom'}</span>;
              },
            },
            {
              key: 'permissions',
              title: 'Permissions',
              filterable: false,
              sortable: false,
              render: (val) => <TagList items={val} colorClass="bg-blue-100 text-blue-700" />,
            },
            {
              key: 'domains',
              title: 'Domains',
              filterable: false,
              sortable: false,
              render: (val) => <TagList items={val} colorClass="bg-green-100 text-green-700" />,
            },
            {
              key: 'customers',
              title: 'Customers',
              filterable: false,
              sortable: false,
              render: (val) => <TagList items={val} colorClass="bg-orange-100 text-orange-700" />,
            },
            {
              key: 'priority',
              title: 'Priority',
              render: (val) => <span className="text-sm text-content-muted">{val || 0}</span>,
              sortValue: (val) => val || 0,
            },
            {
              key: 'status',
              title: 'Status',
              render: (val) => {
                const statusClass = val === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                return <span className={`px-2 py-1 text-xs rounded-full ${statusClass}`}>{val || 'active'}</span>;
              },
            },
            {
              key: 'actions',
              title: 'Actions',
              render: (_val, row) => {
                const toggleClass = row.status === 'active' ? 'text-green-600 hover:bg-green-50' : 'text-content-muted hover:bg-surface-hover';
                return (
                  <div className="flex items-center justify-end gap-1">
                    <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => usersModal.showUsers(row)} title="View Users"><Users size={18} /></button>
                    <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => modal.openEditModal(row)} title="Edit"><Edit2 size={18} /></button>
                    <button className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${toggleClass}`} onClick={() => actions.handleToggleStatus(row)} title={row.status === 'active' ? 'Deactivate' : 'Activate'}>{row.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>
                    <button className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" onClick={() => actions.handleDelete(row)} title="Delete"><Trash2 size={18} /></button>
                  </div>
                );
              },
            },
          ]}
          data={data.groups}
          loading={data.loading}
        />
        <GroupsPagination data={data} />
      </div>

      <Modal isOpen={modal.modalOpen} onClose={modal.closeModal} title={modal.editingGroup ? 'Edit Group' : 'Create Group'} size="xl">
        <GroupForm
          formData={modal.formData} editingGroup={modal.editingGroup} groupTypes={data.groupTypes}
          handleInputChange={modal.handleInputChange} handleSubmit={modal.handleSubmit}
          groupedPermissions={data.groupedPermissions} isPermissionSelected={modal.isPermissionSelected}
          handlePermissionToggle={modal.handlePermissionToggle} handleSelectAllPermissions={modal.handleSelectAllPermissions}
          handleSelectAllModule={modal.handleSelectAllModule} domains={data.domains}
          isDomainSelected={modal.isDomainSelected} handleDomainToggle={modal.handleDomainToggle}
          handleSelectAllDomains={modal.handleSelectAllDomains} filteredCustomers={modal.filteredCustomers}
          allCustomers={data.allCustomers} customerSearch={modal.customerSearch} setCustomerSearch={modal.setCustomerSearch}
          isCustomerSelected={modal.isCustomerSelected} handleCustomerToggle={modal.handleCustomerToggle}
          handleSelectAllCustomers={modal.handleSelectAllCustomers} onClose={modal.closeModal}
        />
      </Modal>

      <GroupUsersModal isOpen={usersModal.usersModalOpen} onClose={usersModal.closeUsersModal} selectedGroup={usersModal.selectedGroup} loadingUsers={usersModal.loadingUsers} groupUsers={usersModal.groupUsers} />
    </div>
  );
};

export default GroupsManagement;
