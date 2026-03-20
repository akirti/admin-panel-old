import { useState, useEffect, useCallback } from 'react';
import { usersAPI, rolesAPI, groupsAPI, customersAPI, exportAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Search, ChevronLeft, ChevronRight, Plus, Edit2,
  Power, Trash2, Key, Download, FileDown, Filter
} from 'lucide-react';
import { Badge, Modal, Table } from '../../components/shared';

// --- Sub-components extracted to reduce cognitive complexity ---

const UserBadges = ({ items, maxShow = 2, variant = 'primary' }) => {
  const safeItems = items || [];
  return (
    <div className="flex flex-wrap gap-1">
      {safeItems.slice(0, maxShow).map((item) => (
        <Badge key={item} variant={variant}>{item}</Badge>
      ))}
      {safeItems.length > maxShow && (
        <Badge variant="default">+{safeItems.length - maxShow}</Badge>
      )}
    </div>
  );
};

const SelectionSection = ({ label, count, items, isSelected, onToggle, onSelectAll, onClearAll, colorSelected, colorBorder, colorCheckbox, emptyText }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-medium text-content-secondary">{label} ({count} selected)</label>
      <div className="space-x-2">
        <button type="button" onClick={onSelectAll} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Select All</button>
        <button type="button" onClick={onClearAll} className="text-xs text-content-muted hover:text-content-secondary font-medium">Clear All</button>
      </div>
    </div>
    <div className="border border-edge rounded-xl max-h-40 overflow-y-auto p-3 bg-surface-secondary">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((item) => {
          const selected = isSelected(item);
          const selectionClass = selected ? `${colorSelected} ${colorBorder}` : 'bg-surface border-edge hover:border-edge';
          return (
            <label
              key={item._id || item.roleId || item.groupId || item.customerId}
              className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${selectionClass}`}
            >
              <input type="checkbox" checked={selected} onChange={(e) => onToggle(item, e.target.checked)} className={`h-4 w-4 ${colorCheckbox} rounded`} />
              <span className="ml-2 text-sm text-content-secondary">{item.name}</span>
            </label>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-content-muted text-sm text-center py-4">{emptyText}</p>
      )}
    </div>
  </div>
);

const UserForm = ({
  formData, setFormData, editingUser, roles, groups, customers,
  isRoleSelected, isGroupSelected, isCustomerSelected,
  selectAllRoles, clearAllRoles, selectAllGroups, clearAllGroups,
  selectAllCustomers, clearAllCustomers,
  handleSubmit, onClose,
}) => {
  const handleRoleToggle = (role, checked) => {
    if (checked) {
      setFormData({ ...formData, roles: [...formData.roles, role._id] });
    } else {
      setFormData({ ...formData, roles: formData.roles.filter(r => r !== role._id && r !== role.roleId) });
    }
  };

  const handleGroupToggle = (group, checked) => {
    if (checked) {
      setFormData({ ...formData, groups: [...formData.groups, group._id] });
    } else {
      setFormData({ ...formData, groups: formData.groups.filter(g => g !== group._id && g !== group.groupId) });
    }
  };

  const handleCustomerToggle = (customer, checked) => {
    if (checked) {
      setFormData({ ...formData, customers: [...formData.customers, customer._id] });
    } else {
      setFormData({ ...formData, customers: formData.customers.filter(c => c !== customer._id && c !== customer.customerId) });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Email *</label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingUser} className="input-field w-full disabled:bg-surface-hover" />
        </div>
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Username *</label>
          <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required className="input-field w-full" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">Full Name *</label>
        <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required className="input-field w-full" />
      </div>

      {!editingUser && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">Password *</label>
          <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="input-field w-full" />
        </div>
      )}

      <SelectionSection
        label="Roles" count={formData.roles.length} items={roles}
        isSelected={isRoleSelected} onToggle={handleRoleToggle}
        onSelectAll={selectAllRoles} onClearAll={clearAllRoles}
        colorSelected="bg-primary-50" colorBorder="border-primary-300" colorCheckbox="text-primary-600"
        emptyText="No roles available"
      />

      <SelectionSection
        label="Groups" count={formData.groups.length} items={groups}
        isSelected={isGroupSelected} onToggle={handleGroupToggle}
        onSelectAll={selectAllGroups} onClearAll={clearAllGroups}
        colorSelected="bg-green-50" colorBorder="border-green-300" colorCheckbox="text-green-600"
        emptyText="No groups available"
      />

      <SelectionSection
        label="Customers" count={formData.customers.length} items={customers}
        isSelected={isCustomerSelected} onToggle={handleCustomerToggle}
        onSelectAll={selectAllCustomers} onClearAll={clearAllCustomers}
        colorSelected="bg-blue-50" colorBorder="border-blue-300" colorCheckbox="text-blue-600"
        emptyText="No customers available"
      />

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="h-4 w-4 text-primary-600 rounded" />
          <span className="text-sm text-content-secondary">Active</span>
        </label>
        {!editingUser && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.send_password_email} onChange={(e) => setFormData({ ...formData, send_password_email: e.target.checked })} className="h-4 w-4 text-primary-600 rounded" />
            <span className="text-sm text-content-secondary">Send password email</span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-edge">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">
          {editingUser ? 'Update' : 'Create'} User
        </button>
      </div>
    </form>
  );
};

// --- Helper functions outside component ---

const EMPTY_USER_FORM = {
  email: '', username: '', full_name: '', password: '',
  roles: [], groups: [], customers: [], is_active: true, send_password_email: true,
};

function buildUserFetchParams(paginationPage, paginationLimit, search, filterRole, filterGroup) {
  const params = { page: paginationPage, limit: paginationLimit };
  if (search) params.search = search;
  if (filterRole) params.role = filterRole;
  if (filterGroup) params.group = filterGroup;
  return params;
}

function buildUserFormData(user) {
  return {
    email: user.email, username: user.username, full_name: user.full_name, password: '',
    roles: user.roles || [], groups: user.groups || [], customers: user.customers || [],
    is_active: user.is_active, send_password_email: false,
  };
}

function extractResponseData(res) {
  return res.data.data || res.data;
}

async function downloadUserExport(exportFn, format, filename) {
  const response = await exportFn();
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([response.data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

const UsersStats = ({ stats, filterRole, onFilterRole }) => {
  if (filterRole || !stats) return null;
  const topRoles = Object.entries(stats.byRole).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card p-4">
        <div className="text-sm text-content-muted">Total Users</div>
        <div className="text-2xl font-bold text-content">{stats.total}</div>
      </div>
      <div className="card p-4 cursor-pointer hover:border-green-300 transition-colors" onClick={() => {}}>
        <div className="text-sm text-content-muted">Active</div>
        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
      </div>
      <div className="card p-4 cursor-pointer hover:border-red-300 transition-colors" onClick={() => {}}>
        <div className="text-sm text-content-muted">Inactive</div>
        <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
      </div>
      {topRoles[0] && (
        <div className="card p-4 cursor-pointer hover:border-primary-300 transition-colors" onClick={() => onFilterRole(topRoles[0][0])}>
          <div className="text-sm text-content-muted">{topRoles[0][0]}</div>
          <div className="text-2xl font-bold text-content">{topRoles[0][1]}</div>
          <div className="text-xs text-content-muted">users</div>
        </div>
      )}
    </div>
  );
};

const UsersHeader = ({ total, onExportCsv, onExportJson, onAddUser }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold text-content">Users</h1>
      <p className="text-content-muted text-sm mt-1">Manage user accounts and access ({total} total)</p>
    </div>
    <div className="flex gap-2">
      <button onClick={onExportCsv} className="btn-secondary flex items-center gap-2">
        <FileDown size={16} /> CSV
      </button>
      <button onClick={onExportJson} className="btn-secondary flex items-center gap-2">
        <Download size={16} /> JSON
      </button>
      <button onClick={onAddUser} className="btn-primary flex items-center gap-2">
        <Plus size={16} /> Add User
      </button>
    </div>
  </div>
);

const UsersFilterBar = ({ search, onSearchChange, filterRole, onFilterRoleChange, filterGroup, onFilterGroupChange, roles, groups, onClearFilters }) => (
  <div className="card !p-4">
    <div className="flex items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" size={18} />
        <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by email, username, or name..." className="input !py-2 pl-10 w-full" />
      </div>
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-content-muted shrink-0" />
        <select className="input !py-2 min-w-[140px]" value={filterRole} onChange={(e) => onFilterRoleChange(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map((role) => (
            <option key={role.roleId} value={role.roleId}>{role.name}</option>
          ))}
        </select>
        <select className="input !py-2 min-w-[140px]" value={filterGroup} onChange={(e) => onFilterGroupChange(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map((group) => (
            <option key={group.groupId} value={group.groupId}>{group.name}</option>
          ))}
        </select>
        {(filterRole || filterGroup) && (
          <button className="text-sm text-primary-600 hover:underline whitespace-nowrap" onClick={onClearFilters}>Clear</button>
        )}
      </div>
    </div>
  </div>
);

const UsersPagination = ({ pagination, totalPages, onPageChange, loading }) => {
  if (loading || totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-edge">
      <p className="text-sm text-content-muted">
        Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total} users
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 0} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-content-muted">Page {pagination.page + 1} of {totalPages}</span>
        <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= totalPages - 1} className="p-2 rounded-lg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-content-muted">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

// --- Custom hook for users data fetching ---

function useUsersData() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildUserFetchParams(pagination.page, pagination.limit, search, filterRole, filterGroup);
      const [usersRes, rolesRes, groupsRes, customersRes] = await Promise.all([
        usersAPI.list(params), rolesAPI.list({ limit: 100 }), groupsAPI.list({ limit: 100 }), customersAPI.list({ limit: 100 }),
      ]);
      setUsers(extractResponseData(usersRes));
      setPagination(prev => ({ ...prev, ...usersRes.data.pagination }));
      setRoles(extractResponseData(rolesRes));
      setGroups(extractResponseData(groupsRes));
      setCustomers(extractResponseData(customersRes));
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [search, filterRole, filterGroup, pagination.page, pagination.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetPageToFirst = () => setPagination(prev => ({ ...prev, page: 0 }));
  const handlePageChange = (newPage) => { setPagination(prev => ({ ...prev, page: newPage })); };
  const handleSearchChange = (value) => { setSearch(value); resetPageToFirst(); };
  const handleFilterRoleChange = (value) => { setFilterRole(value); resetPageToFirst(); };
  const handleFilterGroupChange = (value) => { setFilterGroup(value); resetPageToFirst(); };
  const handleClearFilters = () => { setFilterRole(''); setFilterGroup(''); resetPageToFirst(); };

  const totalPages = pagination.pages || Math.ceil(pagination.total / pagination.limit);

  const stats = {
    total: pagination.total,
    active: users.filter(u => u.is_active === true).length,
    inactive: users.filter(u => u.is_active === false).length,
    byRole: users.reduce((acc, u) => {
      (u.roles || []).forEach(role => { acc[role] = (acc[role] || 0) + 1; });
      return acc;
    }, {}),
  };

  return {
    users, roles, groups, customers, loading, search, filterRole, filterGroup,
    pagination, totalPages, fetchData, stats,
    handlePageChange, handleSearchChange, handleFilterRoleChange, handleFilterGroupChange, handleClearFilters,
  };
}

// --- Custom hook for user CRUD actions ---

function useUserActions(fetchData) {
  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email}?`)) return;
    try {
      await usersAPI.delete(user.email);
      toast.success('User deleted successfully');
      fetchData();
    } catch { toast.error('Failed to delete user'); }
  };

  const handleToggleStatus = async (user) => {
    try {
      await usersAPI.toggleStatus(user.email);
      toast.success(`User ${user.is_active ? 'disabled' : 'enabled'} successfully`);
      fetchData();
    } catch { toast.error('Failed to update user status'); }
  };

  const handleSendPasswordReset = async (user, sendEmail = true) => {
    try {
      const response = await usersAPI.sendPasswordReset(user.email, sendEmail);
      const message = sendEmail ? 'Password reset email sent' : `Reset token: ${response.data.token}`;
      toast.success(message);
    } catch { toast.error('Failed to send password reset'); }
  };

  const handleExport = async (format) => {
    try {
      const exportFn = format === 'csv' ? exportAPI.users.csv : exportAPI.users.json;
      await downloadUserExport(exportFn, format, `users.${format}`);
      toast.success(`Exported users as ${format.toUpperCase()}`);
    } catch { toast.error('Failed to export users'); }
  };

  return { handleDelete, handleToggleStatus, handleSendPasswordReset, handleExport };
}

// --- Custom hook for user form modal ---

function useUserFormModal(roles, groups, customers, fetchData) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_USER_FORM });

  const resetForm = () => { setFormData({ ...EMPTY_USER_FORM }); setEditingUser(null); };
  const openAddModal = () => { resetForm(); setModalOpen(true); };
  const openEditModal = (user) => { setEditingUser(user); setFormData(buildUserFormData(user)); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); resetForm(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitUser(editingUser, formData);
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Operation failed'); }
  };

  const isRoleSelected = (role) => formData.roles.includes(role._id) || formData.roles.includes(role.roleId);
  const isGroupSelected = (group) => formData.groups.includes(group._id) || formData.groups.includes(group.groupId);
  const isCustomerSelected = (customer) => formData.customers.includes(customer._id) || formData.customers.includes(customer.customerId);

  const selectAllRoles = () => { setFormData(prev => ({ ...prev, roles: roles.map(r => r._id) })); };
  const clearAllRoles = () => { setFormData(prev => ({ ...prev, roles: [] })); };
  const selectAllGroups = () => { setFormData(prev => ({ ...prev, groups: groups.map(g => g._id) })); };
  const clearAllGroups = () => { setFormData(prev => ({ ...prev, groups: [] })); };
  const selectAllCustomers = () => { setFormData(prev => ({ ...prev, customers: customers.map(c => c._id) })); };
  const clearAllCustomers = () => { setFormData(prev => ({ ...prev, customers: [] })); };

  return {
    modalOpen, editingUser, formData, setFormData,
    openAddModal, openEditModal, closeModal, handleSubmit,
    isRoleSelected, isGroupSelected, isCustomerSelected,
    selectAllRoles, clearAllRoles, selectAllGroups, clearAllGroups, selectAllCustomers, clearAllCustomers,
  };
}

async function submitUser(editingUser, formData) {
  if (editingUser) {
    const { password: _password, send_password_email: _send_password_email, ...updateData } = formData; // eslint-disable-line no-unused-vars
    await usersAPI.update(editingUser.email, updateData);
    toast.success('User updated successfully');
  } else {
    await usersAPI.create(formData);
    toast.success('User created successfully');
  }
}

// --- Main Component ---

const UsersManagement = () => {
  const data = useUsersData();
  const actions = useUserActions(data.fetchData);
  const form = useUserFormModal(data.roles, data.groups, data.customers, data.fetchData);

  const userColumns = [
    { key: 'email', title: 'Email' },
    { key: 'username', title: 'Username' },
    { key: 'full_name', title: 'Full Name' },
    { key: 'roles', title: 'Roles', render: (_, user) => <UserBadges items={user.roles} maxShow={2} variant="primary" />, filterValue: (_, user) => (user.roles || []).join(','), sortable: false },
    { key: 'is_active', title: 'Status', render: (val) => (
      <Badge variant={val ? 'success' : 'danger'}>
        {val ? 'Active' : 'Inactive'}
      </Badge>
    ), filterValue: (val) => val ? 'Active' : 'Inactive', sortValue: (val) => val ? 1 : 0 },
    { key: 'actions', title: 'Actions', render: (_, user) => {
      const toggleClass = user.is_active
        ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50'
        : 'text-green-500 hover:text-green-600 hover:bg-green-50';
      return (
        <div className="flex items-center gap-1">
          <button onClick={() => form.openEditModal(user)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit" aria-label="Edit">
            <Edit2 size={18} />
          </button>
          <button onClick={() => actions.handleToggleStatus(user)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${toggleClass}`} title={user.is_active ? 'Disable' : 'Enable'} aria-label={user.is_active ? 'Disable' : 'Enable'}>
            <Power size={18} />
          </button>
          <button onClick={() => actions.handleSendPasswordReset(user)} className="w-9 h-9 flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Send Password Reset" aria-label="Send Password Reset">
            <Key size={18} />
          </button>
          <button onClick={() => actions.handleDelete(user)} className="w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" aria-label="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      );
    }}
  ];

  return (
    <div className="space-y-6">
      <UsersHeader total={data.pagination.total} onExportCsv={() => actions.handleExport('csv')} onExportJson={() => actions.handleExport('json')} onAddUser={form.openAddModal} />

      <UsersStats stats={data.stats} filterRole={data.filterRole} onFilterRole={data.handleFilterRoleChange} />

      <UsersFilterBar
        search={data.search} onSearchChange={data.handleSearchChange}
        filterRole={data.filterRole} onFilterRoleChange={data.handleFilterRoleChange}
        filterGroup={data.filterGroup} onFilterGroupChange={data.handleFilterGroupChange}
        roles={data.roles} groups={data.groups} onClearFilters={data.handleClearFilters}
      />

      <div className="card overflow-hidden p-0">
        <Table columns={userColumns} data={data.users} loading={data.loading} />
        <UsersPagination pagination={data.pagination} totalPages={data.totalPages} onPageChange={data.handlePageChange} loading={data.loading} />
      </div>

      <Modal isOpen={form.modalOpen} onClose={form.closeModal} title={form.editingUser ? 'Edit User' : 'Add User'} size="xl">
        <UserForm
          formData={form.formData} setFormData={form.setFormData} editingUser={form.editingUser}
          roles={data.roles} groups={data.groups} customers={data.customers}
          isRoleSelected={form.isRoleSelected} isGroupSelected={form.isGroupSelected} isCustomerSelected={form.isCustomerSelected}
          selectAllRoles={form.selectAllRoles} clearAllRoles={form.clearAllRoles}
          selectAllGroups={form.selectAllGroups} clearAllGroups={form.clearAllGroups}
          selectAllCustomers={form.selectAllCustomers} clearAllCustomers={form.clearAllCustomers}
          handleSubmit={form.handleSubmit} onClose={form.closeModal}
        />
      </Modal>
    </div>
  );
};

export default UsersManagement;
