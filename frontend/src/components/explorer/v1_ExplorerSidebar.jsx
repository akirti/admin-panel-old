import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Layers, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useExplorer } from './v1_ExplorerContext';

const getSidebarWidth = (collapsed) => collapsed ? 'w-16' : 'w-56';

const getNavLinkClass = (isActive) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-content-secondary hover:bg-primary-50 hover:text-primary-600'
  }`;

const handleImgError = (e) => {
  e.target.style.display = 'none';
  e.target.nextSibling.style.display = 'block';
};

const DomainIcon = ({ icon, isActive }) => {
  const showCustomIcon = icon && !isActive;
  return (
    <span className="w-5 h-5 shrink-0 flex items-center justify-center overflow-hidden">
      {showCustomIcon && (
        <img src={icon} alt="" className="w-5 h-5 object-contain" onError={handleImgError} />
      )}
      <Layers size={18} className="shrink-0" style={{ display: showCustomIcon ? 'none' : 'block' }} />
    </span>
  );
};

const DomainNavItem = ({ domain, collapsed }) => (
  <li>
    <NavLink
      to={`/explorer/${domain.key}`}
      className={({ isActive }) => getNavLinkClass(isActive)}
      title={domain.name}
    >
      {({ isActive }) => (
        <>
          <DomainIcon icon={domain.icon} isActive={isActive} />
          {!collapsed && <span className="truncate">{domain.name}</span>}
        </>
      )}
    </NavLink>
  </li>
);

const SidebarHeader = ({ collapsed, onToggle }) => (
  <div className="flex items-center justify-between p-3 border-b border-edge">
    {!collapsed && <span className="text-sm font-semibold text-content-secondary">Data Domains</span>}
    <button onClick={onToggle} className="p-1 rounded hover:bg-surface-hover text-content-muted">
      {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  </div>
);

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
      <div className={`${getSidebarWidth(collapsed)} shrink-0 bg-surface border-r border-edge flex items-center justify-center`}>
        <Loader2 className="animate-spin text-primary-600" size={24} />
      </div>
    );
  }

  return (
    <div className={`${getSidebarWidth(collapsed)} shrink-0 bg-surface border-r border-edge flex flex-col transition-all duration-200`}>
      <SidebarHeader collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-1">
          {domains.map((domain) => (
            <DomainNavItem key={domain.key} domain={domain} collapsed={collapsed} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default V1ExplorerSidebar;
