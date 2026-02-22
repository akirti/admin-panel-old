import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { Layers, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useExplorer } from './v1_ExplorerContext';

function V1ExplorerSidebar() {
  const { domains, loading } = useExplorer();
  const navigate = useNavigate();
  const { dataDomain } = useParams();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-navigate to first domain if none selected
  useEffect(() => {
    if (!dataDomain && domains.length > 0 && !loading) {
      const defaultDomain = domains.find(d => d.defaultSelected) || domains[0];
      if (defaultDomain) {
        navigate(`/explorer/${defaultDomain.key}`, { replace: true });
      }
    }
  }, [domains, dataDomain, loading, navigate]);

  if (loading) {
    return (
      <div className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-neutral-200 flex items-center justify-center`}>
        <Loader2 className="animate-spin text-red-600" size={24} />
      </div>
    );
  }

  return (
    <div className={`${collapsed ? 'w-16' : 'w-56'} bg-white border-r border-neutral-200 flex flex-col transition-all duration-200`}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-200">
        {!collapsed && <span className="text-sm font-semibold text-neutral-700">Data Domains</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-neutral-100 text-neutral-500"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-1">
          {domains.map((domain) => (
            <li key={domain.key}>
              <NavLink
                to={`/explorer/${domain.key}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'text-neutral-700 hover:bg-red-50 hover:text-red-600'
                  }`
                }
                title={domain.name}
              >
                <Layers size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{domain.name}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default V1ExplorerSidebar;
