import React from 'react';

function GridPreview({ widgets }) {
  const sorted = [...widgets].sort((a, b) => a.index - b.index);

  const getAttr = (w, key) => {
    const attr = w.attributes?.find((a) => a.key === key);
    return attr?.value || null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-secondary">
            {sorted.map((w) => (
              <th
                key={w.key}
                className="border border-edge px-3 py-2 text-left text-sm font-medium text-content"
                style={{ minWidth: getAttr(w, 'width') || '120px' }}
              >
                <div className="flex items-center gap-1">
                  <span>{w.displayName}</span>
                  <div className="flex gap-0.5 ml-auto">
                    {getAttr(w, 'sortable') === 'true' && (
                      <span className="text-xs text-primary-500" title="Sortable">S</span>
                    )}
                    {getAttr(w, 'editable') === 'true' && (
                      <span className="text-xs text-green-500" title="Editable">E</span>
                    )}
                    {getAttr(w, 'locked') === 'true' && (
                      <span className="text-xs text-red-500" title="Locked">L</span>
                    )}
                  </div>
                </div>
                {getAttr(w, 'type') && (
                  <span className="text-xs text-content-muted font-normal block">
                    {getAttr(w, 'type')}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2].map((rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-surface' : 'bg-surface-secondary'}>
              {sorted.map((w) => (
                <td key={`${rowIdx}-${w.key}`} className="border border-edge px-3 py-2">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 opacity-50" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormFieldPreview({ type, displayName }) {
  if (type === 'textarea') {
    return <div className="w-full h-20 border border-edge rounded-lg bg-surface-secondary" />;
  }
  if (type === 'select') {
    return (
      <div className="w-full h-10 border border-edge rounded-lg bg-surface-secondary flex items-center px-3">
        <span className="text-content-muted text-sm">Select...</span>
      </div>
    );
  }
  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border border-edge rounded bg-surface-secondary" />
        <span className="text-sm text-content-muted">{displayName}</span>
      </div>
    );
  }
  return <div className="w-full h-10 border border-edge rounded-lg bg-surface-secondary" />;
}

function FormPreview({ widgets }) {
  const sorted = [...widgets].sort((a, b) => a.index - b.index);

  const getAttr = (w, key) => {
    const attr = w.attributes?.find((a) => a.key === key);
    return attr?.value || null;
  };

  return (
    <div className="space-y-4 max-w-lg">
      {sorted.map((w) => {
        const type = getAttr(w, 'type') || 'text';
        return (
          <div key={w.key}>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {w.displayName}
              {getAttr(w, 'required') === 'true' && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            <FormFieldPreview type={type} displayName={w.displayName} />
          </div>
        );
      })}
    </div>
  );
}

export default function UITemplatePreview({ template }) {
  if (!template) return null;

  const widgets = template.widgets || [];
  const componentType = template.componentType || 'grid';
  const isForm = componentType.toLowerCase().includes('form');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-content-muted">
        <span><strong>Page:</strong> {template.page}</span>
        {template.component && <span><strong>Component:</strong> {template.component}</span>}
        <span><strong>Type:</strong> {componentType}</span>
        <span><strong>Version:</strong> {template.version}</span>
      </div>

      {widgets.length === 0 && (
        <p className="text-content-muted text-center py-8">No widgets defined</p>
      )}
      {widgets.length > 0 && isForm && <FormPreview widgets={widgets} />}
      {widgets.length > 0 && !isForm && <GridPreview widgets={widgets} />}
    </div>
  );
}
