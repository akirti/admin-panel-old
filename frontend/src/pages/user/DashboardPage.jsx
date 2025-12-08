import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { domainAPI, scenarioRequestAPI } from '../../services/api';
import { Layers, FileText, Settings, ArrowRight, TrendingUp, Users, Activity, MessageSquarePlus, ClipboardList, Clock, CheckCircle } from 'lucide-react';

function DashboardPage() {
  const { user, isSuperAdmin, canManageUsers, isEditor } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestStats, setRequestStats] = useState({
    total: 0,
    submitted: 0,
    inProgress: 0,
    deployed: 0,
    recent: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [domainsRes, statsRes] = await Promise.all([
          domainAPI.getAll(),
          scenarioRequestAPI.getStats()
        ]);
        setDomains(domainsRes.data || []);
        setRequestStats(statsRes.data || {
          total: 0, submitted: 0, inProgress: 0, deployed: 0, recent: []
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, {user?.full_name || user?.username || 'User'}!
        </h2>
        <p className="text-red-100">
          Here's an overview of your available domains and actions and new scenario requests.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Available Domains</p>
              <p className="stat-value">{domains.length}</p>
            </div>
            <div className="stat-icon">
              <Layers size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Your Roles</p>
              <p className="stat-value">{user?.roles?.length || 0}</p>
            </div>
            <div className="stat-icon">
              <Users size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Groups</p>
              <p className="stat-value">{user?.groups?.length || 0}</p>
            </div>
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Status</p>
              <p className="text-lg font-semibold text-green-600">Active</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <Activity size={24} />
            </div>
          </div>
        </div>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Available Domains</p>
              <p className="stat-value">{domains.length}</p>
            </div>
            <div className="stat-icon">
              <Layers size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">My Requests</p>
              <p className="stat-value">{requestStats.total}</p>
            </div>
            <div className="stat-icon">
              <ClipboardList size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">In Progress</p>
              <p className="stat-value text-yellow-600">{requestStats.inProgress}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600">
              <Clock size={24} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Completed</p>
              <p className="stat-value text-green-600">{requestStats.deployed}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </div>
      </div>
      {/* Recent Requests */}
      {requestStats.recent && requestStats.recent.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">Recent Requests</h3>
            <Link to="/my-requests" className="text-red-600 hover:text-red-700 text-sm font-medium">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {requestStats.recent.map((request) => (
              <Link
                key={request.requestId}
                to={`/my-requests/${request.requestId}`}
                className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-red-600">{request.requestId}</span>
                  <span className="text-neutral-800">{request.name}</span>
                </div>
                <span className={`badge ${
                  request.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  ['in-progress', 'development', 'review', 'testing'].includes(request.status) ? 'bg-yellow-100 text-yellow-700' :
                  ['deployed', 'active', 'snapshot'].includes(request.status) ? 'bg-green-100 text-green-700' :
                  request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-neutral-100 text-neutral-700'
                }`}>
                  {request.status === 'submitted' ? 'Submitted' :
                    request.status === 'in-progress' ? 'In Progress' :
                    request.status === 'development' ? 'Development' :
                    request.status === 'review' ? 'Review' :
                    request.status === 'testing' ? 'Testing' :
                    request.status === 'deployed' ? 'Deployed' :
                    request.status === 'active' ? 'Active' :
                    request.status === 'rejected' ? 'Rejected' :
                    request.status === 'accepted' ? 'Accepted' :
                    request.statusDescription || request.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to="/ask-scenario" className="card hover:shadow-md hover:border-red-200 transition-all group bg-red-50 border-red-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <MessageSquarePlus size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-800">Ask Scenario</h3>
              <p className="text-sm text-neutral-500">Request new feature</p>
            </div>
            <ArrowRight className="text-red-400 group-hover:text-red-600 transition-colors" size={20} />
          </div>
        </Link>

        <Link to="/my-requests" className="card hover:shadow-md hover:border-red-200 transition-all group">
          <div className="flex items-center gap-4">
            <div className="stat-icon">
              <ClipboardList size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-800">My Requests</h3>
              <p className="text-sm text-neutral-500">{requestStats.total} requests</p>
            </div>
            <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
          </div>
        </Link>

        <Link to="/domains" className="card hover:shadow-md hover:border-red-200 transition-all group">
          <div className="flex items-center gap-4">
            <div className="stat-icon">
              <Layers size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-800">My Domains</h3>
              <p className="text-sm text-neutral-500">{domains.length} available</p>
            </div>
            <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
          </div>
        </Link>

        <Link to="/profile" className="card hover:shadow-md hover:border-red-200 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
              <Settings size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-800">Profile Settings</h3>
              <p className="text-sm text-neutral-500">Manage your account</p>
            </div>
            <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {canManageUsers() && (
          <Link 
            to={isSuperAdmin() ? '/admin' : '/management'} 
            className="card hover:shadow-md hover:border-red-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <FileText size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-800">
                  {isSuperAdmin() ? 'Admin Panel' : 'Management'}
                </h3>
                <p className="text-sm text-neutral-500">
                  {isSuperAdmin() ? 'Full system access' : 'Manage your area'}
                </p>
              </div>
              <ArrowRight className="text-neutral-400 group-hover:text-red-600 transition-colors" size={20} />
            </div>
          </Link>
        )}
      </div>
      
      {/* Domains List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="section-title">Your Domains</h3>
          <Link to="/domains" className="text-red-600 hover:text-red-700 text-sm font-medium">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : domains.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            No domains available. Contact your administrator.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.slice(0, 6).map((domain) => (
              <Link
                key={domain.key}
                to={`/domains/${domain.key}`}
                className="p-4 border border-neutral-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Layers className="text-red-600" size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-neutral-800">{domain.name}</h4>
                    <p className="text-sm text-neutral-500">{domain.key}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="card">
        <h3 className="section-title mb-4">Your Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-neutral-500 mb-2">Roles</p>
            <div className="flex flex-wrap gap-1">
              {user?.roles?.map((role) => (
                <span key={role} className="badge badge-primary">
                  {role}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Groups</p>
            <div className="flex flex-wrap gap-1">
              {user?.groups?.length > 0 ? user.groups.map((group) => (
                <span key={group} className="badge badge-success">
                  {group}
                </span>
              )) : (
                <span className="text-neutral-400 text-sm">None</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Domains Access</p>
            <div className="flex flex-wrap gap-1">
              {user?.domains?.length > 0 ? user.domains.map((domain) => (
                <span key={domain} className="badge badge-warning">
                  {domain}
                </span>
              )) : (
                <span className="badge badge-neutral">
                  All
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-neutral-500 mb-2">Email</p>
            <p className="text-neutral-800 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
