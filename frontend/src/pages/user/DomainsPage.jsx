import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { domainAPI } from '../../services/api';
import { Layers, ArrowRight, Search } from 'lucide-react';

function DomainsPage() {
  const { hasAccessToDomain } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const response = await domainAPI.getAll();
        setDomains(response.data);
      } catch (error) {
        console.error('Failed to fetch domains:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
  }, []);

  const filteredDomains = domains.filter(domain =>
    domain.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-content">My Domains</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-64"
          />
        </div>
      </div>

      {filteredDomains.length === 0 ? (
        <div className="card text-center py-12">
          <Layers className="mx-auto text-content-muted mb-4" size={48} />
          <h3 className="text-lg font-medium text-content mb-2">No Domains Found</h3>
          <p className="text-content-muted">
            {searchTerm
              ? 'No domains match your search criteria.'
              : 'You don\'t have access to any domains yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDomains.map((domain) => (
            <Link
              key={domain.key}
              to={`/domains/${domain.key}`}
              className="card hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {domain.icon ? (
                    <img
                      src={domain.icon}
                      alt={domain.name}
                      className="w-7 h-7 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  <Layers
                    className="text-primary-600"
                    size={24}
                    style={{ display: domain.icon ? 'none' : 'block' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-content group-hover:text-primary-600 transition-colors">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-content-muted mb-2">{domain.key}</p>
                  {domain.description && (
                    <p className="text-sm text-content-secondary line-clamp-2">
                      {domain.description}
                    </p>
                  )}
                </div>
                <ArrowRight
                  className="text-content-muted group-hover:text-primary-600 transition-colors flex-shrink-0"
                  size={20}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default DomainsPage;
