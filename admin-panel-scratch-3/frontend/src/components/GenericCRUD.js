import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Toggle, Select, Pagination } from '../components/shared';
import toast from 'react-hot-toast';

const GenericCRUD = ({
  title,
  description,
  api,
  columns,
  formFields,
  idField = '_id',
  searchPlaceholder = 'Search...',
  createTitle = 'Add Item',
  editTitle = 'Edit Item',
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  const initFormData = useCallback(() => {
    const initial = {};
    formFields.forEach((field) => {
      initial[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
    });
    return initial;
  }, [formFields]);

  const fetchData = useCallback(async () => {
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      const response = await api.list(params);
      setItems(response.data.data || response.data);
      if (response.data.pagination) {
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [api, search, title, pagination.page, pagination.limit]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setFormData(initFormData());
  }, [initFormData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.update(editingItem[idField], formData);
        toast.success(`${title.slice(0, -1)} updated successfully`);
      } else {
        await api.create(formData);
        toast.success(`${title.slice(0, -1)} created successfully`);
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete this ${title.slice(0, -1).toLowerCase()}?`)) return;
    try {
      await api.delete(item[idField]);
      toast.success(`${title.slice(0, -1)} deleted successfully`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to delete ${title.slice(0, -1).toLowerCase()}`);
    }
  };

  const handleToggleStatus = async (item) => {
    if (!api.toggleStatus) return;
    try {
      await api.toggleStatus(item[idField]);
      toast.success('Status updated successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData(initFormData());
    setEditingItem(null);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    const data = {};
    formFields.forEach((field) => {
      data[field.name] = item[field.name] !== undefined ? item[field.name] : (field.defaultValue || '');
    });
    setFormData(data);
    setModalOpen(true);
  };

  const actionColumn = {
    key: 'actions',
    title: 'Actions',
    render: (_, item) => (
      <div className="flex items-center space-x-2">
        <button
          onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
          className="p-1 text-gray-500 hover:text-primary-600"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {api.toggleStatus && (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
            className="p-1 text-yellow-500 hover:text-yellow-600"
            title="Toggle Status"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
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
    ),
  };

  const tableColumns = [...columns, actionColumn];

  const renderField = (field) => {
    const value = formData[field.name] !== undefined ? formData[field.name] : '';
    
    switch (field.type) {
      case 'select':
        return (
          <Select
            key={field.name}
            label={field.label}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            options={field.options}
            required={field.required}
          />
        );
      case 'toggle':
        return (
          <div key={field.name} className="flex items-center justify-between">
            <Toggle
              enabled={value === true || value === 'true'}
              onChange={(val) => setFormData({ ...formData, [field.name]: val })}
              label={field.label}
            />
          </div>
        );
      case 'array':
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <Input
              placeholder="Comma-separated values"
              value={Array.isArray(value) ? value.join(', ') : value}
              onChange={(e) => setFormData({ 
                ...formData, 
                [field.name]: e.target.value.split(',').map(s => s.trim()).filter(s => s)
              })}
            />
          </div>
        );
      case 'number':
        return (
          <Input
            key={field.name}
            label={field.label}
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: parseInt(e.target.value) || 0 })}
            required={field.required}
          />
        );
      case 'textarea':
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              required={field.required}
            />
          </div>
        );
      default:
        return (
          <Input
            key={field.name}
            label={field.label}
            type={field.type || 'text'}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            required={field.required}
            disabled={field.disabled && editingItem}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1">{description}</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {createTitle}
        </Button>
      </div>

      {/* Search */}
      <Card className="p-4">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
        />
      </Card>

      {/* Table */}
      <Card>
        <Table columns={tableColumns} data={items} loading={loading} />
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

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingItem ? editTitle : createTitle}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields.map(renderField)}
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GenericCRUD;
