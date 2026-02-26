import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Compass, FileText, Layers } from 'lucide-react';
import { useExplorer } from '../../components/explorer/v1_ExplorerContext';
import V1Breadcrumbs from '../../components/explorer/v1_Breadcrumbs';
import V1SearchBar from '../../components/explorer/v1_SearchBar';

function V1ExplorerDomainPage() {
  const { dataDomain } = useParams();
  const navigate = useNavigate();
  const { getScenariosByDomain, getDomainByKey } = useExplorer();
  const [searchQuery, setSearchQuery] = useState('');

  const domain = getDomainByKey(dataDomain);
  const allScenarios = getScenariosByDomain(dataDomain);

  const filteredScenarios = useMemo(() => {
    if (!searchQuery.trim()) return allScenarios;
    const query = searchQuery.toLowerCase();
    return allScenarios.filter(
      (s) =>
        s.name?.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
    );
  }, [allScenarios, searchQuery]);

  const handleExplore = (scenario) => {
    navigate(`/explorer/${dataDomain}/${scenario.key}`);
  };

  return (
    <div>
      <V1Breadcrumbs
        items={[{ label: domain?.name || dataDomain }]}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center overflow-hidden">
            {domain?.icon ? (
              <img
                src={domain.icon}
                alt={domain.name}
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
            ) : null}
            <Layers
              size={24}
              className="text-primary-600"
              style={{ display: domain?.icon ? 'none' : 'block' }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content">
              {domain?.name || dataDomain}
            </h1>
            {domain?.description && (
              <p className="text-sm text-content-muted mt-1">{domain.description}</p>
            )}
          </div>
        </div>
        <V1SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {filteredScenarios.length === 0 ? (
        <div className="text-center py-12 text-content-muted">
          <FileText size={48} className="mx-auto mb-4 text-content-muted" />
          <p className="text-lg font-medium">No scenarios found</p>
          <p className="text-sm mt-1">
            {searchQuery ? 'Try a different search term' : 'No scenarios available for this domain'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <div
              key={scenario.key}
              className="bg-surface rounded-lg border border-edge shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="p-5">
                <h3 className="text-lg font-semibold text-content group-hover:text-primary-600 transition-colors mb-2">
                  {scenario.name}
                </h3>
                <p className="text-sm text-content-muted line-clamp-3 mb-4">
                  {scenario.description || 'No description available'}
                </p>
                <button
                  onClick={() => handleExplore(scenario)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                >
                  <Compass size={16} />
                  Explore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default V1ExplorerDomainPage;
