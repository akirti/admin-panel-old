import React, { useState, useEffect, useCallback, useId } from 'react';
import { Card, Button, Input, Table, Modal, Badge, SearchInput, Select, Pagination } from '../../components/shared';
import { isActive as isStatusActive } from '../../utils/status';
import { uiTemplatesAPI } from '../../services/api';
import UITemplatePreview from '../../components/admin/UITemplatePreview';
import { Eye, Pencil, Plus, ToggleLeft, ToggleRight, GitBranch, ArrowUp, ArrowDown, Trash2, MessageSquarePlus, Code, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Constants ─── */
const JIRA_KEY_REGEX = /^[A-Z]+-\d+$/;
const DEFAULT_FORM = {
  name: '', description: '', page: '', component: '', componentType: 'grid',
  version: '1.0.0', accessLevel: 'USR', usage: [], widgets: [], status: 'A',
};
const DEFAULT_WIDGET_ATTRIBUTES = [
  { key: 'width', value: '60' },
  { key: 'type', value: 'text' },
  { key: 'isDefault', value: 'Y' },
  { key: 'isSortable', value: 'Y' },
  { key: 'isEditable', value: 'Y' },
  { key: 'isHyderated', value: 'N' },
  { key: 'isLocked', value: 'N' },
  { key: 'status', value: 'Y' },
  { key: 'searchIndexed', value: 'N' },
  { key: 'alignment', value: 'left' },
  { key: 'datakey', value: '' },
  { key: 'alternateDisplayName', value: '' },
];
// Attribute keys that use Y/N dropdown
const YN_ATTRIBUTE_KEYS = new Set([
  'isDefault', 'isSortable', 'isEditable', 'isHyderated',
  'isLocked', 'status', 'searchIndexed',
]);
const DEFAULT_WIDGET = { key: '', displayName: '', index: 0, datakey: '', value: '', attributes: [], overrides: {} };

const OVERRIDE_KEY_OPTIONS = [
  'mobile', 'tablet', 'compact', 'readonly', 'print', 'export', 'embedded',
];

function stripOverrides(widgets) {
  return widgets.map((w) => {
    const cleanOverrides = {};
    for (const [overrideKey, override] of Object.entries(w.overrides || {})) {
      const cleanAttrs = (override.attributes || []).filter(
        (a) => (a.key && a.key.trim()) || (a.value && a.value.trim())
      );
      const clean = {};
      if (override.key?.trim()) clean.key = override.key.trim();
      if (override.displayName?.trim()) clean.displayName = override.displayName.trim();
      if (override.datakey?.trim()) clean.datakey = override.datakey.trim();
      if (override.value?.trim()) clean.value = override.value.trim();
      if (cleanAttrs.length > 0) clean.attributes = cleanAttrs;
      if (Object.keys(clean).length > 0) cleanOverrides[overrideKey] = clean;
    }
    return { ...w, overrides: cleanOverrides };
  });
}

/* ─── Data-fetching hook ─── */
function useTemplatesData(search, filterStatus, filterPage, pagination, setPagination) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await uiTemplatesAPI.list({
        search: search || undefined,
        status: filterStatus || undefined,
        page_code: filterPage || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      const data = res?.data || {};
      setTemplates(data.data || []);
      setPagination((prev) => ({ ...prev, ...(data.pagination || {}) }));
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterPage, pagination.page, pagination.limit, setPagination]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { templates, loading, fetchData };
}

/* ─── Widget tab content ─── */
function WidgetTabContent({ fields, onFieldChange, attributes, onAttrChange, onAddAttr, onRemoveAttr, isBase }) {
  return (
    <div className="space-y-2 pt-2">
      <div className="grid grid-cols-3 gap-2">
        <input className="px-2 py-1 text-sm border border-edge rounded bg-surface"
          placeholder={isBase ? 'Key' : 'Override key'} value={fields.key || ''}
          onChange={(e) => onFieldChange('key', e.target.value)} />
        <input className="px-2 py-1 text-sm border border-edge rounded bg-surface"
          placeholder={isBase ? 'Display Name' : 'Override display name'} value={fields.displayName || ''}
          onChange={(e) => onFieldChange('displayName', e.target.value)} />
        <input className="px-2 py-1 text-sm border border-edge rounded bg-surface"
          placeholder={isBase ? 'Data Key' : 'Override data key'} value={fields.datakey || ''}
          onChange={(e) => onFieldChange('datakey', e.target.value)} />
      </div>
      {!isBase && (
        <input className="px-2 py-1 text-sm border border-edge rounded bg-surface w-full"
          placeholder="Override value" value={fields.value || ''}
          onChange={(e) => onFieldChange('value', e.target.value)} />
      )}
      <div className="ml-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-content-muted">Attributes</span>
          <button type="button" onClick={onAddAttr} className="text-xs text-primary-500 hover:underline">+ attr</button>
        </div>
        {(attributes || []).map((attr, aIdx) => (
          <div key={`attr-${aIdx}`} className="flex gap-2 items-center">
            <input className="px-2 py-0.5 text-xs border border-edge rounded bg-surface flex-1" placeholder="key"
              value={attr.key} onChange={(e) => onAttrChange(aIdx, 'key', e.target.value)} />
            {YN_ATTRIBUTE_KEYS.has(attr.key) ? (
              <select className="px-2 py-0.5 text-xs border border-edge rounded bg-surface flex-1"
                value={attr.value} onChange={(e) => onAttrChange(aIdx, 'value', e.target.value)}>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            ) : (
              <input className="px-2 py-0.5 text-xs border border-edge rounded bg-surface flex-1" placeholder="value"
                value={attr.value} onChange={(e) => onAttrChange(aIdx, 'value', e.target.value)} />
            )}
            <button type="button" onClick={() => onRemoveAttr(aIdx)} className="text-red-400 hover:text-red-500">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Widget editor sub-component ─── */
function WidgetEditor({ widgets, setWidgets }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [activeTabs, setActiveTabs] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(null);

  const getActiveTab = (idx) => activeTabs[idx] || 'base';
  const setActiveTab = (idx, tab) => setActiveTabs((prev) => ({ ...prev, [idx]: tab }));

  const toggleExpand = (idx) => setExpandedIdx((prev) => (prev === idx ? null : idx));

  const addWidget = () => {
    const newIdx = widgets.length;
    setWidgets([...widgets, {
      ...DEFAULT_WIDGET,
      key: `widget-${newIdx + 1}`,
      index: newIdx,
      attributes: DEFAULT_WIDGET_ATTRIBUTES.map((a) => ({ ...a })),
    }]);
    setExpandedIdx(newIdx);
  };

  const removeWidget = (idx) => {
    const next = widgets.filter((_, i) => i !== idx).map((w, i) => ({ ...w, index: i }));
    setWidgets(next);
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const moveWidget = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= widgets.length) return;
    const next = [...widgets];
    [next[idx], next[target]] = [next[target], next[idx]];
    setWidgets(next.map((w, i) => ({ ...w, index: i })));
    if (expandedIdx === idx) setExpandedIdx(target);
    else if (expandedIdx === target) setExpandedIdx(idx);
  };

  const updateWidget = (idx, field, value) => {
    const next = [...widgets];
    next[idx] = { ...next[idx], [field]: value };
    setWidgets(next);
  };

  const updateAttr = (wIdx, aIdx, field, value) => {
    const next = [...widgets];
    const attrs = [...(next[wIdx].attributes || [])];
    attrs[aIdx] = { ...attrs[aIdx], [field]: value };
    next[wIdx] = { ...next[wIdx], attributes: attrs };
    setWidgets(next);
  };

  const addAttr = (wIdx) => {
    const next = [...widgets];
    next[wIdx] = { ...next[wIdx], attributes: [...(next[wIdx].attributes || []), { key: '', value: '' }] };
    setWidgets(next);
  };

  const removeAttr = (wIdx, aIdx) => {
    const next = [...widgets];
    next[wIdx] = { ...next[wIdx], attributes: (next[wIdx].attributes || []).filter((_, i) => i !== aIdx) };
    setWidgets(next);
  };

  // ── Override CRUD ──
  const addOverride = (wIdx, overrideKey) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}), [overrideKey]: { attributes: [] } };
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
    setActiveTab(wIdx, overrideKey);
    setDropdownOpen(null);
  };

  const removeOverride = (wIdx, overrideKey) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}) };
    delete overrides[overrideKey];
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
    setActiveTab(wIdx, 'base');
  };

  const updateOverrideField = (wIdx, overrideKey, field, value) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}) };
    overrides[overrideKey] = { ...(overrides[overrideKey] || {}), [field]: value };
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
  };

  const updateOverrideAttr = (wIdx, overrideKey, aIdx, field, value) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}) };
    const ov = { ...(overrides[overrideKey] || {}) };
    const attrs = [...(ov.attributes || [])];
    attrs[aIdx] = { ...attrs[aIdx], [field]: value };
    ov.attributes = attrs;
    overrides[overrideKey] = ov;
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
  };

  const addOverrideAttr = (wIdx, overrideKey) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}) };
    const ov = { ...(overrides[overrideKey] || {}) };
    ov.attributes = [...(ov.attributes || []), { key: '', value: '' }];
    overrides[overrideKey] = ov;
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
  };

  const removeOverrideAttr = (wIdx, overrideKey, aIdx) => {
    const next = [...widgets];
    const overrides = { ...(next[wIdx].overrides || {}) };
    const ov = { ...(overrides[overrideKey] || {}) };
    ov.attributes = (ov.attributes || []).filter((_, i) => i !== aIdx);
    overrides[overrideKey] = ov;
    next[wIdx] = { ...next[wIdx], overrides };
    setWidgets(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-content-secondary">Widgets ({widgets.length})</span>
        <Button type="button" variant="secondary" size="sm" onClick={addWidget}>
          <Plus size={14} className="mr-1" /> Add Widget
        </Button>
      </div>
      {widgets.map((w, wIdx) => {
        const isExpanded = expandedIdx === wIdx;
        const summary = w.key || w.displayName || `Widget ${wIdx + 1}`;
        const overrideKeys = Object.keys(w.overrides || {});
        const activeTab = getActiveTab(wIdx);
        const availableOverrides = OVERRIDE_KEY_OPTIONS.filter((k) => !overrideKeys.includes(k));

        return (
          <div key={`widget-${wIdx}`} className="border border-edge rounded-lg bg-surface-secondary">
            {/* Collapsed header */}
            <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-surface-hover select-none"
              onClick={() => toggleExpand(wIdx)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(wIdx); } }}>
              {isExpanded ? <ChevronDown size={14} className="text-content-muted flex-shrink-0" /> : <ChevronRight size={14} className="text-content-muted flex-shrink-0" />}
              <span className="text-xs font-mono text-content-muted">#{wIdx}</span>
              <span className="text-sm font-medium text-content truncate flex-1">{summary}</span>
              <span className="text-xs text-content-muted">{(w.attributes || []).length} attrs</span>
              {overrideKeys.length > 0 && (
                <span className="text-xs text-purple-500">{overrideKeys.length} override{overrideKeys.length > 1 ? 's' : ''}</span>
              )}
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => moveWidget(wIdx, -1)} disabled={wIdx === 0}
                  className="p-1 hover:bg-surface rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => moveWidget(wIdx, 1)} disabled={wIdx === widgets.length - 1}
                  className="p-1 hover:bg-surface rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => removeWidget(wIdx)} className="p-1 text-red-500 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Expanded body with tabs */}
            {isExpanded && (
              <div className="p-3 pt-0 border-t border-edge">
                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-edge pt-2 pb-0 mb-0 overflow-x-auto">
                  <button type="button"
                    className={`px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 transition-colors ${activeTab === 'base' ? 'bg-surface text-content border-edge' : 'text-content-muted hover:text-content border-transparent'}`}
                    onClick={() => setActiveTab(wIdx, 'base')}>
                    Base
                  </button>
                  {overrideKeys.map((ok) => (
                    <div key={ok} className="flex items-center">
                      <button type="button"
                        className={`px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 transition-colors ${activeTab === ok ? 'bg-surface text-purple-600 border-edge' : 'text-content-muted hover:text-content border-transparent'}`}
                        onClick={() => setActiveTab(wIdx, ok)}>
                        {ok}
                      </button>
                      <button type="button" onClick={() => removeOverride(wIdx, ok)}
                        className="ml-0.5 p-0.5 text-content-muted hover:text-red-500 text-xs" title={`Remove ${ok} override`}>
                        &times;
                      </button>
                    </div>
                  ))}
                  {availableOverrides.length > 0 && (
                    <button type="button"
                      className="px-2 py-1.5 text-xs text-primary-500 hover:text-primary-600 font-medium"
                      onClick={() => setDropdownOpen(dropdownOpen === wIdx ? null : wIdx)}>
                      + Override
                    </button>
                  )}
                </div>

                {/* Inline override picker */}
                {dropdownOpen === wIdx && availableOverrides.length > 0 && (
                  <div className="flex flex-wrap gap-1 py-2 px-1 border-b border-edge bg-surface-secondary">
                    <span className="text-xs text-content-muted mr-1 py-1">Add override:</span>
                    {availableOverrides.map((ok) => (
                      <button key={ok} type="button"
                        className="px-2.5 py-1 text-xs rounded border border-edge bg-surface hover:bg-primary-50 hover:border-primary-300 hover:text-primary-600 transition-colors"
                        onClick={() => addOverride(wIdx, ok)}>
                        {ok}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab content */}
                {activeTab === 'base' ? (
                  <WidgetTabContent isBase
                    fields={{ key: w.key, displayName: w.displayName, datakey: w.datakey }}
                    onFieldChange={(field, value) => updateWidget(wIdx, field, value)}
                    attributes={w.attributes || []}
                    onAttrChange={(aIdx, field, value) => updateAttr(wIdx, aIdx, field, value)}
                    onAddAttr={() => addAttr(wIdx)}
                    onRemoveAttr={(aIdx) => removeAttr(wIdx, aIdx)} />
                ) : (
                  <WidgetTabContent isBase={false}
                    fields={w.overrides?.[activeTab] || {}}
                    onFieldChange={(field, value) => updateOverrideField(wIdx, activeTab, field, value)}
                    attributes={w.overrides?.[activeTab]?.attributes || []}
                    onAttrChange={(aIdx, field, value) => updateOverrideAttr(wIdx, activeTab, aIdx, field, value)}
                    onAddAttr={() => addOverrideAttr(wIdx, activeTab)}
                    onRemoveAttr={(aIdx) => removeOverrideAttr(wIdx, activeTab, aIdx)} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Create/Edit Form ─── */
function TemplateForm({ formData, setFormData, editingItem, onSubmit, onCancel }) {
  const descId = useId();
  const widgets = formData.widgets || [];
  const setWidgets = (w) => setFormData({ ...formData, widgets: w });

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        <Input label="Page Code" value={formData.page} onChange={(e) => setFormData({ ...formData, page: e.target.value })} required />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Component" value={formData.component || ''} onChange={(e) => setFormData({ ...formData, component: e.target.value })} />
        <Select label="Component Type" value={formData.componentType || 'grid'}
          onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
          options={[{ value: 'grid', label: 'Data Grid' }, { value: 'form', label: 'Form' }, { value: 'custom', label: 'Custom' }]} />
        <Input label="Access Level" value={formData.accessLevel || 'USR'} onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })} />
      </div>
      <div>
        <label htmlFor={descId} className="block text-sm font-medium text-content-secondary mb-1">Description</label>
        <textarea id={descId} className="w-full px-3 py-2 border border-edge rounded-lg bg-surface text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          rows={2} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      </div>
      {!editingItem && (
        <Input label="Version" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} />
      )}

      <WidgetEditor widgets={widgets} setWidgets={setWidgets} />

      <div className="flex justify-end space-x-3 pt-4 border-t border-edge">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{editingItem ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

/* ─── Version Bump Form ─── */
function VersionBumpForm({ templateId, currentVersion, onSuccess, onCancel }) {
  const commentId = useId();
  const [version, setVersion] = useState('');
  const [comment, setComment] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!version) { toast.error('Version is required'); return; }
    if (!jiraKey || !JIRA_KEY_REGEX.test(jiraKey)) { toast.error('Valid Jira ticket key required (e.g. PROJ-123)'); return; }
    if (!comment) { toast.error('Comment is required'); return; }

    setSubmitting(true);
    try {
      await uiTemplatesAPI.bumpVersion(templateId, {
        version,
        comment: { comment, author: '', reason: [jiraKey] },
      });
      toast.success(`Version bumped to ${version}`);
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Version bump failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-content-muted">Current version: <strong>{currentVersion}</strong></p>
      <Input label="New Version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.1.0" required />
      <Input label="Jira Ticket" value={jiraKey} onChange={(e) => setJiraKey(e.target.value.toUpperCase())} placeholder="PROJ-123" required />
      <div>
        <label htmlFor={commentId} className="block text-sm font-medium text-content-secondary mb-1">Comment</label>
        <textarea id={commentId} className="w-full px-3 py-2 border border-edge rounded-lg bg-surface text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required />
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Bumping...' : 'Bump Version'}</Button>
      </div>
    </form>
  );
}

/* ─── Add Comment Form ─── */
function AddCommentForm({ templateId, onSuccess, onCancel }) {
  const commentId = useId();
  const [comment, setComment] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jiraKey || !JIRA_KEY_REGEX.test(jiraKey)) { toast.error('Valid Jira ticket key required'); return; }

    setSubmitting(true);
    try {
      await uiTemplatesAPI.addComment(templateId, { comment, author: '', reason: [jiraKey] });
      toast.success('Comment added');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Jira Ticket" value={jiraKey} onChange={(e) => setJiraKey(e.target.value.toUpperCase())} placeholder="PROJ-123" required />
      <div>
        <label htmlFor={commentId} className="block text-sm font-medium text-content-secondary mb-1">Comment</label>
        <textarea id={commentId} className="w-full px-3 py-2 border border-edge rounded-lg bg-surface text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required />
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>Add Comment</Button>
      </div>
    </form>
  );
}

/* ─── Table columns ─── */
function buildColumns({ onView, onEdit, onPreview, onBumpVersion, onToggle, onAddComment, onDelete }) {
  return [
    { key: 'name', title: 'Name' },
    { key: 'page', title: 'Page' },
    { key: 'component', title: 'Component', render: (v) => v || '-' },
    { key: 'version', title: 'Version', render: (v) => <Badge variant="primary">{v}</Badge> },
    { key: 'componentType', title: 'Type', render: (v) => v || 'grid' },
    {
      key: 'status', title: 'Status',
      render: (v) => { const active = isStatusActive(v); return <Badge variant={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Badge>; },
    },
    {
      key: 'actions', title: 'Actions',
      render: (_, item) => (
        <div className="flex items-center space-x-1">
          <button onClick={(e) => { e.stopPropagation(); onView(item); }} className="p-1 text-content-muted hover:text-primary-600" title="View JSON"><Code size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1 text-content-muted hover:text-primary-600" title="Edit"><Pencil size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onPreview(item); }} className="p-1 text-content-muted hover:text-blue-600" title="Preview"><Eye size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onBumpVersion(item); }} className="p-1 text-content-muted hover:text-purple-600" title="Bump Version"><GitBranch size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onAddComment(item); }} className="p-1 text-content-muted hover:text-green-600" title="Add Comment"><MessageSquarePlus size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onToggle(item); }} className="p-1 text-content-muted hover:text-yellow-600" title="Toggle Status">
            {isStatusActive(item.status) ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="p-1 text-red-500 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
const UISchemaManagement = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0, pages: 0 });

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ ...DEFAULT_FORM });

  const resetPage = useCallback(() => setPagination((p) => ({ ...p, page: 0 })), []);
  const { templates, loading, fetchData } = useTemplatesData(search, filterStatus, filterPage, pagination, setPagination);

  const resetForm = () => { setFormData({ ...DEFAULT_FORM }); setEditingItem(null); };

  // ── CRUD handlers ──
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await uiTemplatesAPI.create({ ...formData, widgets: stripOverrides(formData.widgets || []) });
      toast.success('Template created');
      setFormModalOpen(false); resetForm(); fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { version, status, ...updateData } = formData;
      await uiTemplatesAPI.update(editingItem._id, { ...updateData, widgets: stripOverrides(updateData.widgets || []) });
      toast.success('Template updated');
      setFormModalOpen(false); resetForm(); fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update'); }
  };

  const handleToggle = async (item) => {
    try {
      await uiTemplatesAPI.toggleStatus(item._id);
      toast.success(`Status toggled to ${isStatusActive(item.status) ? 'Inactive' : 'Active'}`);
      fetchData();
    } catch { toast.error('Failed to toggle status'); }
  };

  const handleDelete = async (item) => {
    if (!globalThis.confirm(`Delete template "${item.name}"?`)) return;
    try {
      await uiTemplatesAPI.delete(item._id);
      toast.success('Template deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  // ── Modal openers ──
  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      page: item.page || '',
      component: item.component || '',
      componentType: item.componentType || 'grid',
      version: item.version || '1.0.0',
      accessLevel: item.accessLevel || 'USR',
      usage: item.usage || [],
      widgets: item.widgets || [],
      status: item.status || 'A',
    });
    setFormModalOpen(true);
  };

  const openPreview = (item) => { setSelectedItem(item); setPreviewModalOpen(true); };
  const openDetail = (item) => { setSelectedItem(item); setDetailModalOpen(true); };
  const openVersionBump = (item) => { setSelectedItem(item); setVersionModalOpen(true); };
  const openAddComment = (item) => { setSelectedItem(item); setCommentModalOpen(true); };

  const handleSearchChange = (v) => { setSearch(v); resetPage(); };
  const handleStatusChange = (e) => { setFilterStatus(e.target.value); resetPage(); };
  const handlePageFilterChange = (e) => { setFilterPage(e.target.value); resetPage(); };
  const handlePageChange = (p) => setPagination((prev) => ({ ...prev, page: p }));

  const columns = buildColumns({
    onView: openDetail, onEdit: openEdit, onPreview: openPreview,
    onBumpVersion: openVersionBump, onToggle: handleToggle,
    onAddComment: openAddComment, onDelete: handleDelete,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content">UI Schema Templates</h1>
          <p className="text-content-muted mt-1">Manage JSON-based UI templates for grids and forms</p>
        </div>
        <Button onClick={() => { resetForm(); setFormModalOpen(true); }}>
          <Plus size={16} className="mr-2" /> New Template
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput value={search} onChange={handleSearchChange} placeholder="Search by name, page, component..." />
          </div>
          <div className="w-40">
            <Select value={filterStatus} onChange={handleStatusChange}
              options={[{ value: '', label: 'All Status' }, { value: 'A', label: 'Active' }, { value: 'I', label: 'Inactive' }]} />
          </div>
          <div className="w-48">
            <Input placeholder="Filter by page code" value={filterPage} onChange={handlePageFilterChange} />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table columns={columns} data={templates} loading={loading} />
        {pagination.pages > 1 && (
          <Pagination currentPage={pagination.page} totalPages={pagination.pages}
            total={pagination.total} limit={pagination.limit} onPageChange={handlePageChange} />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal isOpen={formModalOpen} onClose={() => { setFormModalOpen(false); resetForm(); }}
        title={editingItem ? 'Edit Template' : 'New Template'} size="xl">
        <TemplateForm formData={formData} setFormData={setFormData} editingItem={editingItem}
          onSubmit={editingItem ? handleUpdate : handleCreate}
          onCancel={() => { setFormModalOpen(false); resetForm(); }} />
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="Template Preview" size="xl">
        <UITemplatePreview template={selectedItem} />
        <div className="flex justify-end pt-4"><Button variant="secondary" onClick={() => setPreviewModalOpen(false)}>Close</Button></div>
      </Modal>

      {/* Detail / JSON Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Template JSON" size="xl">
        {selectedItem && (
          <div className="space-y-4">
            <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] text-sm font-mono">
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setDetailModalOpen(false)}>Close</Button></div>
          </div>
        )}
      </Modal>

      {/* Version Bump Modal */}
      <Modal isOpen={versionModalOpen} onClose={() => setVersionModalOpen(false)} title="Bump Version" size="lg">
        {selectedItem && (
          <VersionBumpForm templateId={selectedItem._id} currentVersion={selectedItem.version}
            onSuccess={() => { setVersionModalOpen(false); fetchData(); }}
            onCancel={() => setVersionModalOpen(false)} />
        )}
      </Modal>

      {/* Add Comment Modal */}
      <Modal isOpen={commentModalOpen} onClose={() => setCommentModalOpen(false)} title="Add Comment" size="lg">
        {selectedItem && (
          <AddCommentForm templateId={selectedItem._id}
            onSuccess={() => { setCommentModalOpen(false); fetchData(); }}
            onCancel={() => setCommentModalOpen(false)} />
        )}
      </Modal>
    </div>
  );
};

export default UISchemaManagement;
