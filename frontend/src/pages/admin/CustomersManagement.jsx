import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Badge } from '../../components/shared';
import { customersAPI, usersAPI, exportAPI } from '../../services/api';
import {
  Building2,
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
  Users,
  AlertCircle,
  CheckCircle,
  Shield,
  UserPlus,
  UserMinus,
  Filter,
} from 'lucide-react';

const CustomersManagement = () => {
  const { isSuperAdmin } = useAuth();

  // Data state
  const [customers, setCustomers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Search and filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    status: 'active',
    tags: [],
    unit: '',
    sales: '',
    division: '',
    channel: '',
    location: '',
  });
  const [newTag, setNewTag] = useState('');

  // Users modal state
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerUsers, setCustomerUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterTag) params.tag = filterTag;
      if (filterLocation) params.location = filterLocation;
      if (filterUnit) params.unit = filterUnit;

      const response = await customersAPI.list(params);
      setCustomers(response.data.data || []);
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.pages || 0);
        setTotal(response.data.pagination.total || 0);
      }
    } catch (err) {
      setError('Failed to fetch customers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, filterTag, filterLocation, filterUnit]);

  // Fetch filter options (tags, locations, units)
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await customersAPI.getFilters();
      setAvailableTags(response.data.tags || []);
      setAvailableLocations(response.data.locations || []);
      setAvailableUnits(response.data.units || []);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, []);

  // Fetch all users for assignment
  const fetchAllUsers = useCallback(async () => {
    try {
      const response = await usersAPI.list({ limit: 1000 });
      setAllUsers(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchCustomers();
      fetchAllUsers();
      fetchFilterOptions();
    }
  }, [fetchCustomers, fetchAllUsers, fetchFilterOptions, isSuperAdmin]);

  // Clear messages after timeout
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Tag management
  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      customerId: '',
      name: '',
      description: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      status: 'active',
      tags: [],
      unit: '',
      sales: '',
      division: '',
      channel: '',
      location: '',
    });
    setNewTag('');
    setModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerId: customer.customerId || '',
      name: customer.name || '',
      description: customer.description || '',
      contactEmail: customer.contactEmail || '',
      contactPhone: customer.contactPhone || '',
      address: customer.address || '',
      status: customer.status || 'active',
      tags: customer.tags || [],
      unit: customer.unit || '',
      sales: customer.sales || '',
      division: customer.division || '',
      channel: customer.channel || '',
      location: customer.location || '',
    });
    setNewTag('');
    setModalOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customersAPI.update(editingCustomer._id || editingCustomer.customerId, formData);
        setSuccess('Customer updated successfully');
      } else {
        await customersAPI.create(formData);
        setSuccess('Customer created successfully');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save customer');
    }
  };

  // Handle delete
  const handleDelete = async (customer) => {
    if (!window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) {
      return;
    }
    try {
      await customersAPI.delete(customer._id || customer.customerId);
      setSuccess('Customer deleted successfully');
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete customer');
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (customer) => {
    try {
      await customersAPI.toggleStatus(customer._id || customer.customerId);
      setSuccess(`Customer ${customer.status === 'active' ? 'deactivated' : 'activated'} successfully`);
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to toggle customer status');
    }
  };

  // Show users modal
  const showUsers = async (customer) => {
    setSelectedCustomer(customer);
    setUsersModalOpen(true);
    setLoadingUsers(true);
    setUserSearch('');
    try {
      const response = await customersAPI.getUsers(customer._id || customer.customerId);
      setCustomerUsers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch customer users:', err);
      setCustomerUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Assign user to customer
  const handleAssignUser = async (userId) => {
    try {
      await customersAPI.assignUsers(selectedCustomer._id || selectedCustomer.customerId, [userId]);
      setSuccess('User assigned to customer');
      // Refresh users list
      const response = await customersAPI.getUsers(selectedCustomer._id || selectedCustomer.customerId);
      setCustomerUsers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign user');
    }
  };

  // Remove user from customer
  const handleRemoveUser = async (userId) => {
    try {
      await customersAPI.removeUsers(selectedCustomer._id || selectedCustomer.customerId, [userId]);
      setSuccess('User removed from customer');
      // Refresh users list
      const response = await customersAPI.getUsers(selectedCustomer._id || selectedCustomer.customerId);
      setCustomerUsers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove user');
    }
  };

  // Filter users for assignment dropdown
  const availableUsers = allUsers.filter(
    (user) =>
      !customerUsers.some((cu) => cu._id === user._id || cu.email === user.email) &&
      (userSearch === '' ||
        user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(userSearch.toLowerCase())))
  );

  // Export functions
  const handleExport = async (format) => {
    try {
      const response = format === 'csv'
        ? await exportAPI.customers.csv()
        : await exportAPI.customers.json();

      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(`Exported customers as ${format.toUpperCase()}`);
    } catch (err) {
      setError('Failed to export customers');
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto text-neutral-400 mb-4" size={48} />
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access Denied</h2>
        <p className="text-neutral-500">Only Super Administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers Management</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Manage customer accounts and their users ({total} total)
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => document.getElementById('export-menu-customers').classList.toggle('hidden')}
            >
              <Download size={16} />
              Export
            </button>
            <div
              id="export-menu-customers"
              className="hidden absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10"
            >
              <button
                className="block w-full px-4 py-2 text-left hover:bg-neutral-100"
                onClick={() => {
                  handleExport('csv');
                  document.getElementById('export-menu-customers').classList.add('hidden');
                }}
              >
                Export as CSV
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-neutral-100"
                onClick={() => {
                  handleExport('json');
                  document.getElementById('export-menu-customers').classList.add('hidden');
                }}
              >
                Export as JSON
              </button>
            </div>
          </div>
          <button className="btn btn-primary flex items-center gap-2" onClick={openCreateModal}>
            <Plus size={16} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Search customers by name or ID..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-neutral-400" />
            <select
              className="input min-w-[150px]"
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Locations</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <select
              className="input min-w-[150px]"
              value={filterUnit}
              onChange={(e) => {
                setFilterUnit(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Units</option>
              {availableUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {(filterLocation || filterUnit) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFilterLocation('');
                  setFilterUnit('');
                  setPage(0);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No customers found. Click "Add Customer" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Customer ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Sales</th>
                  <th className="px-4 py-3 text-left">Division</th>
                  <th className="px-4 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left">Tags</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((customer) => (
                  <tr key={customer._id || customer.customerId} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-neutral-600">{customer.customerId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-neutral-900 flex items-center gap-2">
                          <Building2 size={16} className="text-neutral-400" />
                          {customer.name}
                        </div>
                        {customer.description && (
                          <div className="text-xs text-neutral-500 truncate max-w-xs">
                            {customer.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {customer.contactEmail && (
                          <div className="text-neutral-600">{customer.contactEmail}</div>
                        )}
                        {customer.contactPhone && (
                          <div className="text-neutral-500 text-xs">{customer.contactPhone}</div>
                        )}
                        {!customer.contactEmail && !customer.contactPhone && (
                          <span className="text-neutral-400 text-xs">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={customer.status === 'active' ? 'success' : 'danger'}>
                        {customer.status || 'active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-600">{customer.unit || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-600">{customer.sales || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-600">{customer.division || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-600">{customer.channel || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-600">{customer.location || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {customer.tags && customer.tags.length > 0 ? (
                          customer.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="info">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                        {customer.tags && customer.tags.length > 3 && (
                          <span className="text-neutral-500 text-xs">+{customer.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-500">
                        {customer.created_at
                          ? new Date(customer.created_at).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => showUsers(customer)}
                          title="Manage Users"
                        >
                          <Users size={18} />
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          onClick={() => openEditModal(customer)}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                            customer.status === 'active'
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-neutral-400 hover:bg-neutral-50'
                          }`}
                          onClick={() => handleToggleStatus(customer)}
                          title={customer.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {customer.status === 'active' ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                        <button
                          className="w-9 h-9 flex items-center justify-center text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => handleDelete(customer)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
            <p className="text-sm text-neutral-500">
              Showing {page * limit + 1} to{' '}
              {Math.min((page + 1) * limit, total)} of{' '}
              {total} customers
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-neutral-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Create Customer'}
        size="lg"
      >
            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Customer ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="customerId"
                      className="input w-full"
                      value={formData.customerId}
                      onChange={handleInputChange}
                      required
                      disabled={!!editingCustomer}
                      placeholder="e.g., acme-corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="input w-full"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Acme Corporation"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    className="input w-full"
                    rows={2}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of the customer..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      name="contactEmail"
                      className="input w-full"
                      value={formData.contactEmail}
                      onChange={handleInputChange}
                      placeholder="contact@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      className="input w-full"
                      value={formData.contactPhone}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Address
                  </label>
                  <textarea
                    name="address"
                    className="input w-full"
                    rows={2}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Full address..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    name="status"
                    className="input w-full"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Business Attributes */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      className="input w-full"
                      value={formData.unit}
                      onChange={handleInputChange}
                      placeholder="Business unit..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Sales</label>
                    <input
                      type="text"
                      name="sales"
                      className="input w-full"
                      value={formData.sales}
                      onChange={handleInputChange}
                      placeholder="Sales region/team..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Division</label>
                    <input
                      type="text"
                      name="division"
                      className="input w-full"
                      value={formData.division}
                      onChange={handleInputChange}
                      placeholder="Division..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Channel</label>
                    <input
                      type="text"
                      name="channel"
                      className="input w-full"
                      value={formData.channel}
                      onChange={handleInputChange}
                      placeholder="Channel..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Location</label>
                    <input
                      type="text"
                      name="location"
                      className="input w-full"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Location..."
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tags</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="Add a tag and press Enter..."
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddTag}
                    >
                      Add
                    </button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            className="hover:text-blue-900"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
      </Modal>

      {/* Users Management Modal */}
      <Modal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        title={`Manage Users: ${selectedCustomer?.name || ''}`}
        size="xl"
      >
            <div className="overflow-y-auto max-h-[calc(80vh-160px)]">
              {loadingUsers ? (
                <div className="text-center py-8 text-neutral-500">Loading users...</div>
              ) : (
                <div className="space-y-6">
                  {/* Add User Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <UserPlus size={20} />
                      Assign User
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                        <input
                          type="text"
                          placeholder="Search users to assign..."
                          className="input pl-9 w-full"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    {userSearch && availableUsers.length > 0 && (
                      <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                        {availableUsers.slice(0, 10).map((user) => (
                          <div
                            key={user._id}
                            className="p-2 hover:bg-neutral-50 flex items-center justify-between cursor-pointer"
                            onClick={() => handleAssignUser(user._id)}
                          >
                            <div>
                              <div className="text-sm font-medium">{user.full_name || user.email}</div>
                              <div className="text-xs text-neutral-500">{user.email}</div>
                            </div>
                            <button className="text-blue-600 text-sm hover:underline">
                              Assign
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {userSearch && availableUsers.length === 0 && (
                      <p className="mt-2 text-sm text-neutral-500">No matching users found</p>
                    )}
                  </div>

                  {/* Current Users Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Users size={20} />
                      Assigned Users ({customerUsers.length})
                    </h3>
                    {customerUsers.length === 0 ? (
                      <p className="text-neutral-500 text-center py-4 border rounded-lg">
                        No users assigned to this customer
                      </p>
                    ) : (
                      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                        {customerUsers.map((user) => (
                          <div
                            key={user._id}
                            className="p-3 hover:bg-neutral-50 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-neutral-900">
                                {user.full_name || user.username || user.email}
                              </div>
                              <div className="text-sm text-neutral-500">{user.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={user.is_active ? 'success' : 'danger'}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <button
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                onClick={() => handleRemoveUser(user._id)}
                                title="Remove from customer"
                              >
                                <UserMinus size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setUsersModalOpen(false)}
              >
                Close
              </button>
            </div>
      </Modal>
    </div>
  );
};

export default CustomersManagement;
