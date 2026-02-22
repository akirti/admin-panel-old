import React from 'react';
import { Link } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';

function V1Breadcrumbs({ items = [] }) {
  // items: [{ label: string, path?: string }]
  return (
    <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
      <Link to="/explorer" className="flex items-center gap-1 hover:text-red-600 transition-colors">
        <Home size={14} />
        <span>Explorer</span>
      </Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="text-neutral-300" />
          {item.path ? (
            <Link to={item.path} className="hover:text-red-600 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-800 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default V1Breadcrumbs;
