import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { domainAPI, scenarioAPI } from '../../services/api';
import { ArrowLeft, Layers, FileText, ChevronRight } from 'lucide-react';
import { Badge } from '../../components/shared';

function DomainDetailPage() {
  const { domainKey } = useParams();
  const [domain, setDomain] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [domainResponse, scenariosResponse] = await Promise.all([
          domainAPI.get(domainKey),
          scenarioAPI.getByDomain(domainKey)
        ]);
        setDomain(domainResponse.data);
        setScenarios(scenariosResponse.data);
      } catch (error) {
        console.error('Failed to fetch domain data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [domainKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Domain Not Found</h2>
        <p className="text-neutral-500 mb-4">The domain you're looking for doesn't exist.</p>
        <Link to="/domains" className="btn-primary">
          Back to Domains
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link to="/domains" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft size={16} />
          Domains
        </Link>
        <ChevronRight size={16} />
        <span className="text-neutral-900">{domain.name}</span>
      </div>

      {/* Domain Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
            <Layers className="text-blue-600" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{domain.name}</h1>
            <p className="text-neutral-500">{domain.key}</p>
            {domain.description && (
              <p className="text-neutral-600 mt-2">{domain.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Scenarios */}
      <div className="card">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Scenarios ({scenarios.length})
        </h2>

        {scenarios.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto text-neutral-400 mb-4" size={48} />
            <p className="text-neutral-500">No scenarios available for this domain.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <Link
                key={scenario.key}
                to={`/domains/${domainKey}/scenarios/${scenario.key}`}
                className="flex items-center gap-4 p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <FileText className="text-neutral-600" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900">{scenario.name}</h3>
                  <p className="text-sm text-neutral-500">{scenario.key}</p>
                  {scenario.description && (
                    <p className="text-sm text-neutral-600 mt-1 line-clamp-1">
                      {scenario.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="text-neutral-400" size={20} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Domain Info */}
      <div className="card">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Domain Information</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-neutral-500">Key</dt>
            <dd className="text-neutral-900">{domain.key}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500">Status</dt>
            <dd>
              <Badge variant={domain.status === 'active' || domain.status === 'A' ? 'success' : 'default'}>
                {domain.status === 'active' || domain.status === 'A' ? 'Active' : 'Inactive'}
              </Badge>
            </dd>
          </div>
          {domain.path && (
            <div>
              <dt className="text-sm text-neutral-500">Path</dt>
              <dd className="text-neutral-900">{domain.path}</dd>
            </div>
          )}
          {domain.order !== undefined && (
            <div>
              <dt className="text-sm text-neutral-500">Order</dt>
              <dd className="text-neutral-900">{domain.order}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

export default DomainDetailPage;
