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
      <div className={`${collapsed ? 'w-16' : 'w-56'} bg-surface border-r border-edge flex items-center justify-center`}>
        <Loader2 className="animate-spin text-primary-600" size={24} />
      </div>
    );
  }

  return (
    <div className={`${collapsed ? 'w-16' : 'w-56'} bg-surface border-r border-edge flex flex-col transition-all duration-200`}>
      <div className="flex items-center justify-between p-3 border-b border-edge">
        {!collapsed && <span className="text-sm font-semibold text-content-secondary">Data Domains</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-surface-hover text-content-muted"
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
                      ? 'bg-primary-600 text-white'
                      : 'text-content-secondary hover:bg-primary-50 hover:text-primary-600'
                  }`
                }
                title={domain.name}
              >
                {({ isActive }) => (
                  <>
                    <span className="w-5 h-5 shrink-0 flex items-center justify-center overflow-hidden">
                      {domain.icon && !isActive ? (
                        <img
                          src={domain.icon}
                          alt=""
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <Layers
                        size={18}
                        className="shrink-0"
                        style={{ display: domain.icon && !isActive ? 'none' : 'block' }}
                      />
                    </span>
                    {!collapsed && <span className="truncate">{domain.name}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default V1ExplorerSidebar;
