import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../components/shared';
import { customersAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerUsers, setCustomerUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedAssignedUserIds, setSelectedAssignedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [assignedUserSearch, setAssignedUserSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    description: '',
    status: 'active',
    metadata: {}
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [customersRes, usersRes] = await Promise.all([
        customersAPI.list({ search: search || undefined, page: pagination.page, limit: pagination.limit }),
        usersAPI.list({ limit: 100 })
      ]);
      setCustomers(customersRes.data.data || customersRes.data);
      setPagination(prev => ({ ...prev, ...(customersRes.data.pagination || {}) }));
      setAllUsers(usersRes.data.data || usersRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      name: '',
      description: '',
      status: 'active',
      metadata: {}
    });
    setEditingItem(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await customersAPI.create(formData);
      toast.success('Customer created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create customer');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await customersAPI.update(editingItem.customerId, formData);
      toast.success('Customer updated successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update customer');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will remove the customer association from all users, roles, and groups.')) return;
    try {
      await customersAPI.delete(item.customerId);
      toast.success('Customer deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      await customersAPI.toggleStatus(item.customerId);
      toast.success('Customer status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      customerId: item.customerId || '',
      name: item.name || '',
      description: item.description || '',
      status: item.status || 'active',
      metadata: item.metadata || {}
    });
    setModalOpen(true);
  };

  const openUserModal = async (customer) => {
    setSelectedCustomer(customer);
    setUserSearch('');
    setAssignedUserSearch('');
    setSelectedUserIds([]);
    setSelectedAssignedUserIds([]);
    try {
      const response = await customersAPI.getUsers(customer.customerId);
      setCustomerUsers(response.data || []);
      setUserModalOpen(true);
    } catch (error) {
      toast.error('Failed to load customer users');
    }
  };

  const handleAssignUsers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    try {
      await customersAPI.assignUsers(selectedCustomer.customerId, selectedUserIds);
      toast.success(`Assigned ${selectedUserIds.length} user(s) to customer`);
      setSelectedUserIds([]);
      const response = await customersAPI.getUsers(selectedCustomer.customerId);
      setCustomerUsers(response.data || []);
    } catch (error) {
      toast.error('Failed to assign users');
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!window.confirm('Remove this user from the customer?')) return;
    try {
      await customersAPI.removeUsers(selectedCustomer.customerId, [userId]);
      toast.success('User removed from customer');
      const response = await customersAPI.getUsers(selectedCustomer.customerId);
      setCustomerUsers(response.data || []);
      setSelectedAssignedUserIds([]);
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  const handleRemoveSelectedUsers = async () => {
    if (selectedAssignedUserIds.length === 0) {
      toast.error('Please select at least one user to remove');
      return;
    }
    if (!window.confirm(`Remove ${selectedAssignedUserIds.length} user(s) from the customer?`)) return;
    try {
      await customersAPI.removeUsers(selectedCustomer.customerId, selectedAssignedUserIds);
      toast.success(`Removed ${selectedAssignedUserIds.length} user(s) from customer`);
      setSelectedAssignedUserIds([]);
      const response = await customersAPI.getUsers(selectedCustomer.customerId);
      setCustomerUsers(response.data || []);
    } catch (error) {
      toast.error('Failed to remove users');
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAssignedUserSelection = (userId) => {
    setSelectedAssignedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllAvailable = () => {
    if (selectedUserIds.length === filteredAvailableUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredAvailableUsers.map(u => u.email));
    }
  };

  const handleSelectAllAssigned = () => {
    if (selectedAssignedUserIds.length === filteredAssignedUsers.length) {
      setSelectedAssignedUserIds([]);
    } else {
      setSelectedAssignedUserIds(filteredAssignedUsers.map(u => u.email));
    }
  };

  // Filter users who are not already assigned to the customer
  const availableUsers = allUsers.filter(
    user => !customerUsers.some(cu => cu.email === user.email)
  );

  // Filter available users by search
  const filteredAvailableUsers = availableUsers.filter(user =>
    userSearch === '' ||
    user.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.username?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filter assigned users by search
  const filteredAssignedUsers = customerUsers.filter(user =>
    assignedUserSearch === '' ||
    user.full_name?.toLowerCase().includes(assignedUserSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(assignedUserSearch.toLowerCase()) ||
    user.username?.toLowerCase().includes(assignedUserSearch.toLowerCase())
  );

  const columns = [
    { key: 'customerId', title: 'Customer ID' },
    { key: 'name', title: 'Name' },
    { key: 'description', title: 'Description' },
    {
      key: 'status',
      title: 'Status',
      render: (val) => (
        <Badge variant={val === 'active' ? 'success' : 'danger'}>
          {val || 'active'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      title: 'Created',
      render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A',
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); openUserModal(item); }}
            className="p-1 text-blue-500 hover:text-blue-600"
            title="Manage Users"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            className="p-1 text-gray-500 hover:text-primary-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className="p-1 text-yellow-500 hover:text-yellow-600"
            title="Toggle Status"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
            className="p-1 text-red-500 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage customer accounts and user associations</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={(val) => { setSearch(val); setPagination(prev => ({ ...prev, page: 0 })); }}
          placeholder="Search by customer ID or name..."
        />
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={customers} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingItem ? 'Edit Customer' : 'Add Customer'}
        size="lg"
      >
        <form onSubmit={editingItem ? handleUpdate : handleCreate}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Customer ID *"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                placeholder="customer-001"
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Customer Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Customer description..."
              />
            </div>

            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update Customer' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* User Management Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setSelectedUserIds([]);
          setSelectedAssignedUserIds([]);
          setUserSearch('');
          setAssignedUserSearch('');
        }}
        title={`Manage Users - ${selectedCustomer?.name}`}
        size="xl"
      >
        <div className="space-y-6">
          {/* Assigned Users */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Assigned Users ({customerUsers.length})</h3>
              <div className="flex gap-2">
                {selectedAssignedUserIds.length > 0 && (
                  <Button
                    onClick={handleRemoveSelectedUsers}
                    variant="danger"
                    size="sm"
                  >
                    Remove Selected ({selectedAssignedUserIds.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Search for assigned users */}
            {customerUsers.length > 0 && (
              <div className="mb-3">
                <SearchInput
                  value={assignedUserSearch}
                  onChange={setAssignedUserSearch}
                  placeholder="Search assigned users..."
                  className="w-full"
                />
              </div>
            )}

            {customerUsers.length > 0 ? (
              <>
                {/* Select All checkbox for assigned users */}
                {filteredAssignedUsers.length > 0 && (
                  <div className="mb-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAssignedUserIds.length === filteredAssignedUsers.length && filteredAssignedUsers.length > 0}
                        onChange={handleSelectAllAssigned}
                        className="h-4 w-4 text-primary-600 rounded mr-3"
                      />
                      <span className="font-medium text-sm">
                        Select All {assignedUserSearch && `(${filteredAssignedUsers.length} shown)`}
                      </span>
                    </label>
                  </div>
                )}

                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {filteredAssignedUsers.length > 0 ? (
                    filteredAssignedUsers.map((user) => (
                      <div key={user.email} className="flex items-center justify-between p-3 hover:bg-gray-50">
                        <label className="flex items-center cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={selectedAssignedUserIds.includes(user.email)}
                            onChange={() => handleAssignedUserSelection(user.email)}
                            className="h-4 w-4 text-primary-600 rounded mr-3"
                          />
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </label>
                        <button
                          onClick={() => handleRemoveUser(user.email)}
                          className="text-red-500 hover:text-red-600 text-sm ml-3"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No users match your search</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4 border rounded-lg">No users assigned</p>
            )}
          </div>

          {/* Available Users to Assign */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Available Users ({availableUsers.length})</h3>
              <Button
                onClick={handleAssignUsers}
                disabled={selectedUserIds.length === 0}
                size="sm"
              >
                Assign Selected ({selectedUserIds.length})
              </Button>
            </div>

            {/* Search for available users */}
            {availableUsers.length > 0 && (
              <div className="mb-3">
                <SearchInput
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="Search available users..."
                  className="w-full"
                />
              </div>
            )}

            {availableUsers.length > 0 ? (
              <>
                {/* Select All checkbox for available users */}
                {filteredAvailableUsers.length > 0 && (
                  <div className="mb-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.length === filteredAvailableUsers.length && filteredAvailableUsers.length > 0}
                        onChange={handleSelectAllAvailable}
                        className="h-4 w-4 text-primary-600 rounded mr-3"
                      />
                      <span className="font-medium text-sm">
                        Select All {userSearch && `(${filteredAvailableUsers.length} shown)`}
                      </span>
                    </label>
                  </div>
                )}

                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {filteredAvailableUsers.length > 0 ? (
                    filteredAvailableUsers.map((user) => (
                      <label
                        key={user.email}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.email)}
                          onChange={() => handleUserSelection(user.email)}
                          className="h-4 w-4 text-primary-600 rounded mr-3"
                        />
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No users match your search</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-4 border rounded-lg">All users are assigned</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Customers;
