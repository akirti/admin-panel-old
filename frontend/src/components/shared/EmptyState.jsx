import { memo } from 'react';
import { Inbox, Plus, Search, FileText } from 'lucide-react';

const ICONS = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  default: Inbox,
};

const EmptyState = memo(function EmptyState({
  icon = 'default',
  title = 'No data found',
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  const Icon = ICONS[icon] || ICONS.default;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-content-muted" />
      </div>
      <h3 className="text-lg font-medium text-content mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-content-muted text-center max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </div>
  );
});

export default EmptyState;
