import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, Search, ChevronLeft, ChevronRight,
  MoreVertical, Shield, Power, Trash2, X, Check
} from 'lucide-react';

const AVAILABLE_ROLES = [
  'super-administrator',
  'administrator',
  'group-administrator',
  'group-editor',
  'editor',
  'user',
  'viewer'
];

function UsersManagement() {
  const { user: currentUser, isSuperAdmin, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0,
  });

  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState(null); // 'roles', 'status', 'domains'
  const [modalLoading, setModalLoading] = useState(false);
  const [editedRoles, setEditedRoles] = useState([]);
  const [editedDomains, setEditedDomains] = useState([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getUsers({
        limit: pagination.limit,
        page: pagination.page,
      });
      setUsers(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
      }));
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit]);

  const handleStatusChange = async (userId, newStatus) => {
    setModalLoading(true);
    try {
      await adminAPI.updateUserStatus(userId, newStatus);
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRolesChange = async () => {
    if (!selectedUser) return;
    setModalLoading(true);
    try {
      await adminAPI.updateUserRoles(selectedUser._id, editedRoles);
      toast.success('Roles updated successfully');
      fetchUsers();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update roles');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDomainsChange = async () => {
    if (!selectedUser) return;
    setModalLoading(true);
    try {
      await adminAPI.updateUserDomains(selectedUser._id, editedDomains);
      toast.success('Domains updated successfully');
      fetchUsers();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update domains');
    } finally {
      setModalLoading(false);
    }
  };

  const openModal = (user, type) => {
    setSelectedUser(user);
    setModalType(type);
    if (type === 'roles') {
      setEditedRoles(user.roles || []);
    } else if (type === 'domains') {
      setEditedDomains(user.domains || []);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
    setEditedRoles([]);
    setEditedDomains([]);
  };

  const toggleRole = (role) => {
    if (editedRoles.includes(role)) {
      setEditedRoles(editedRoles.filter(r => r !== role));
    } else {
      setEditedRoles([...editedRoles, role]);
    }
  };

  const canEditUser = (targetUser) => {
    // Can't edit yourself
    if (targetUser._id === currentUser.user_id) return false;
    
    // Super admin can edit anyone except themselves
    if (isSuperAdmin()) return true;
    
    // Admin can't edit super admins
    if (targetUser.roles?.includes('super-administrator')) return false;
    
    return true;
  };

  const getAvailableRoles = () => {
    if (isSuperAdmin()) return AVAILABLE_ROLES;
    if (isAdmin()) return AVAILABLE_ROLES.filter(r => r !== 'super-administrator');
    return ['viewer', 'user', 'editor'];
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Users Management</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-64"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Roles</th>
                    <th className="text-left py-3 px-4">Domains</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="table-row">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            {(user.full_name || user.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-800">
                              {user.full_name || user.username || 'No name'}
                            </p>
                            <p className="text-sm text-neutral-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.slice(0, 2).map((role) => (
                            <span key={role} className="badge badge-primary">
                              {role}
                            </span>
                          ))}
                          {user.roles?.length > 2 && (
                            <span className="badge badge-neutral">
                              +{user.roles.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.domains?.length > 0 ? (
                            user.domains.slice(0, 2).map((domain) => (
                              <span key={domain} className="badge badge-warning">
                                {domain}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-500">All</span>
                          )}
                          {user.domains?.length > 2 && (
                            <span className="badge badge-neutral">
                              +{user.domains.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${user.is_active ? 'badge-success' : 'bg-red-100 text-red-700'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {canEditUser(user) ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openModal(user, 'roles')}
                              className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Edit Roles"
                            >
                              <Shield size={18} />
                            </button>
                            <button
                              onClick={() => openModal(user, 'status')}
                              className="p-2 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Toggle Status"
                            >
                              <Power size={18} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
              <p className="text-sm text-neutral-500">
                Showing {pagination.page * pagination.limit + 1} to{' '}
                {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of{' '}
                {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 0}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-neutral-600">
                  Page {pagination.page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= totalPages - 1}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Roles Modal */}
      {selectedUser && modalType === 'roles' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Edit Roles</h3>
              <button onClick={closeModal} className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-500">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-neutral-500 mb-4">
              Editing roles for: <strong className="text-neutral-800">{selectedUser.email}</strong>
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {getAvailableRoles().map((role) => (
                <label
                  key={role}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    editedRoles.includes(role) 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={editedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="w-4 h-4 text-red-600 rounded border-neutral-300 focus:ring-red-500"
                  />
                  <span className="flex-1 text-neutral-700">{role}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleRolesChange}
                disabled={modalLoading}
                className="btn-primary"
              >
                {modalLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {selectedUser && modalType === 'status' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">
                {selectedUser.is_active ? 'Deactivate' : 'Activate'} User
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-500">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-neutral-600 mb-6">
              Are you sure you want to {selectedUser.is_active ? 'deactivate' : 'activate'}{' '}
              <strong className="text-neutral-800">{selectedUser.email}</strong>?
            </p>

            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(selectedUser._id, !selectedUser.is_active)}
                disabled={modalLoading}
                className={selectedUser.is_active ? 'btn-danger' : 'btn-primary'}
              >
                {modalLoading
                  ? 'Processing...'
                  : selectedUser.is_active
                  ? 'Deactivate'
                  : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagement;
