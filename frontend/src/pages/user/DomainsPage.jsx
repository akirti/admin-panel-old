import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Domains</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
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
          <Layers className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No Domains Found</h3>
          <p className="text-gray-500">
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
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Layers className="text-blue-600" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">{domain.key}</p>
                  {domain.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {domain.description}
                    </p>
                  )}
                </div>
                <ArrowRight
                  className="text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0"
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
