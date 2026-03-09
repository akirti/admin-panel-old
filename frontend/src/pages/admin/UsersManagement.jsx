import { useState, useEffect, useCallback } from 'react';
import { usersAPI, rolesAPI, groupsAPI, customersAPI, exportAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Search, ChevronLeft, ChevronRight, Plus, Edit2,
  Power, Trash2, Key, Download, FileDown, Filter
} from 'lucide-react';
import { Badge, Modal } from '../../components/shared';

// --- Sub-components extracted to reduce cognitive complexity ---

const UserRow = ({ user, onEdit, onToggleStatus, onSendPasswordReset, onDelete }) => {
  const toggleClass = user.is_active
    ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50'
    : 'text-green-500 hover:text-green-600 hover:bg-green-50';

  return (
    <tr className="table-row">
      <td className="py-3 px-4">{user.email}</td>
      <td className="py-3 px-4">{user.username}</td>
      <td className="py-3 px-4">{user.full_name}</td>
      <td className="py-3 px-4">
        <UserBadges items={user.roles} maxShow={2} variant="primary" />
      </td>
      <td className="py-3 px-4">
        <Badge variant={user.is_active ? 'success' : 'danger'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(user)} className="w-9 h-9 flex items-center justify-center text-content-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
            <Edit2 size={18} />
          </button>
          <button onClick={() => onToggleStatus(user)} className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${toggleClass}`} title={user.is_active ? 'Disable' : 'Enable'}>
            <Power size={18} />
          </button>
          <button onClick={() => onSendPasswordReset(user)} className="w-9 h-9 flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Send Password Reset">
            <Key size={18} />
          </button>
          <button onClick={() => onDelete(user)} className="w-9 h-9 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

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

const UsersTable = ({ users, loading, onEdit, onToggleStatus, onSendPasswordReset, onDelete }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="table-header">
            <th className="text-left py-3 px-4">Email</th>
            <th className="text-left py-3 px-4">Username</th>
            <th className="text-left py-3 px-4">Full Name</th>
            <th className="text-left py-3 px-4">Roles</th>
            <th className="text-left py-3 px-4">Status</th>
            <th className="text-left py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user._id || user.email}
              user={user}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onSendPasswordReset={onSendPasswordReset}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
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
          return (
            <label
              key={item._id || item.roleId || item.groupId || item.customerId}
              className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${selected ? `${colorSelected} ${colorBorder}` : 'bg-surface border-edge hover:border-edge'}`}
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

const UsersHeader = ({ onExportCsv, onExportJson, onAddUser }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-content">Users</h1>
      <p className="text-content-muted mt-1">Manage user accounts and access</p>
    </div>
    <div className="flex items-center gap-2">
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
  <div className="card p-4">
    <div className="flex flex-wrap gap-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
        <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search by email, username, or name..." className="input-field pl-10 w-full" />
      </div>
      <div className="flex items-center gap-2">
        <Filter size={18} className="text-content-muted" />
        <select className="input-field min-w-[150px]" value={filterRole} onChange={(e) => onFilterRoleChange(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map((role) => (
            <option key={role.roleId} value={role.roleId}>{role.name}</option>
          ))}
        </select>
        <select className="input-field min-w-[150px]" value={filterGroup} onChange={(e) => onFilterGroupChange(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map((group) => (
            <option key={group.groupId} value={group.groupId}>{group.name}</option>
          ))}
        </select>
        {(filterRole || filterGroup) && (
          <button className="btn-secondary text-sm py-2 px-3" onClick={onClearFilters}>
            Clear Filters
          </button>
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

// --- Main Component ---

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [formData, setFormData] = useState({ ...EMPTY_USER_FORM });

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
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterGroup, pagination.page, pagination.limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetPageToFirst = () => setPagination(prev => ({ ...prev, page: 0 }));
  const handlePageChange = (newPage) => { setPagination(prev => ({ ...prev, page: newPage })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { password: _password, send_password_email: _send_password_email, ...updateData } = formData;
        await usersAPI.update(editingUser.email, updateData);
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(formData);
        toast.success('User created successfully');
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.email}?`)) return;
    try {
      await usersAPI.delete(user.email);
      toast.success('User deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await usersAPI.toggleStatus(user.email);
      toast.success(`User ${user.is_active ? 'disabled' : 'enabled'} successfully`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleSendPasswordReset = async (user, sendEmail = true) => {
    try {
      const response = await usersAPI.sendPasswordReset(user.email, sendEmail);
      const message = sendEmail ? 'Password reset email sent' : `Reset token: ${response.data.token}`;
      toast.success(message);
    } catch (error) {
      toast.error('Failed to send password reset');
    }
  };

  const handleExport = async (format) => {
    try {
      const exportFn = format === 'csv' ? exportAPI.users.csv : exportAPI.users.json;
      await downloadUserExport(exportFn, format, `users.${format}`);
      toast.success(`Exported users as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export users');
    }
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_USER_FORM });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData(buildUserFormData(user));
    setModalOpen(true);
  };

  const openAddModal = () => { resetForm(); setModalOpen(true); };

  const isRoleSelected = (role) => formData.roles.includes(role._id) || formData.roles.includes(role.roleId);
  const isGroupSelected = (group) => formData.groups.includes(group._id) || formData.groups.includes(group.groupId);
  const isCustomerSelected = (customer) => formData.customers.includes(customer._id) || formData.customers.includes(customer.customerId);

  const selectAllRoles = () => { setFormData(prev => ({ ...prev, roles: roles.map(r => r._id) })); };
  const clearAllRoles = () => { setFormData(prev => ({ ...prev, roles: [] })); };
  const selectAllGroups = () => { setFormData(prev => ({ ...prev, groups: groups.map(g => g._id) })); };
  const clearAllGroups = () => { setFormData(prev => ({ ...prev, groups: [] })); };
  const selectAllCustomers = () => { setFormData(prev => ({ ...prev, customers: customers.map(c => c._id) })); };
  const clearAllCustomers = () => { setFormData(prev => ({ ...prev, customers: [] })); };

  const totalPages = pagination.pages || Math.ceil(pagination.total / pagination.limit);
  const closeModal = () => { setModalOpen(false); resetForm(); };

  const handleSearchChange = (value) => { setSearch(value); resetPageToFirst(); };
  const handleFilterRoleChange = (value) => { setFilterRole(value); resetPageToFirst(); };
  const handleFilterGroupChange = (value) => { setFilterGroup(value); resetPageToFirst(); };
  const handleClearFilters = () => { setFilterRole(''); setFilterGroup(''); resetPageToFirst(); };

  return (
    <div className="space-y-6">
      <UsersHeader onExportCsv={() => handleExport('csv')} onExportJson={() => handleExport('json')} onAddUser={openAddModal} />

      <UsersFilterBar
        search={search} onSearchChange={handleSearchChange}
        filterRole={filterRole} onFilterRoleChange={handleFilterRoleChange}
        filterGroup={filterGroup} onFilterGroupChange={handleFilterGroupChange}
        roles={roles} groups={groups} onClearFilters={handleClearFilters}
      />

      <div className="card overflow-hidden p-0">
        <UsersTable users={users} loading={loading} onEdit={openEditModal} onToggleStatus={handleToggleStatus} onSendPasswordReset={handleSendPasswordReset} onDelete={handleDelete} />
        <UsersPagination pagination={pagination} totalPages={totalPages} onPageChange={handlePageChange} loading={loading} />
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingUser ? 'Edit User' : 'Add User'} size="xl">
        <UserForm
          formData={formData} setFormData={setFormData} editingUser={editingUser}
          roles={roles} groups={groups} customers={customers}
          isRoleSelected={isRoleSelected} isGroupSelected={isGroupSelected} isCustomerSelected={isCustomerSelected}
          selectAllRoles={selectAllRoles} clearAllRoles={clearAllRoles}
          selectAllGroups={selectAllGroups} clearAllGroups={clearAllGroups}
          selectAllCustomers={selectAllCustomers} clearAllCustomers={clearAllCustomers}
          handleSubmit={handleSubmit} onClose={closeModal}
        />
      </Modal>
    </div>
  );
};

export default UsersManagement;
