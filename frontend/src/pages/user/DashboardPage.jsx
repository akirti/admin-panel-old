import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { domainAPI, scenarioRequestAPI } from '../../services/api';
import { Layers, FileText, Settings, ArrowRight, TrendingUp, Users, Activity, MessageSquarePlus, ClipboardList, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '../../components/shared';

const STATUS_VARIANT_MAP = {
  'submitted': 'info',
  'in-progress': 'warning',
  'development': 'warning',
  'review': 'warning',
  'testing': 'warning',
  'deployed': 'success',
  'active': 'success',
  'snapshot': 'success',
  'rejected': 'danger'
};

const STATUS_LABEL_MAP = {
  'submitted': 'Submitted',
  'in-progress': 'In Progress',
  'development': 'Development',
  'review': 'Review',
  'testing': 'Testing',
  'deployed': 'Deployed',
  'active': 'Active',
  'rejected': 'Rejected',
  'accepted': 'Accepted'
};

function getStatusVariant(status) {
  return STATUS_VARIANT_MAP[status] || 'default';
}

function getStatusLabel(request) {
  return STATUS_LABEL_MAP[request.status] || request.statusDescription || request.status;
}

function StatCard({ label, value, icon, valueClassName }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className={valueClassName || 'stat-value'}>{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function getDomainAccessLabel(roles) {
  const isAdmin = roles?.some(r => ['super-administrator', 'administrator'].includes(r));
  return isAdmin ? 'All' : 'None';
}

function QuickActionLink({ to, icon, title, subtitle, className }) {
  return (
    <Link to={to} className={`card hover:shadow-md hover:border-primary-200 transition-all group ${className || ''}`}>
      <div className="flex items-center gap-4">
        {icon}
        <div className="flex-1">
          <h3 className="font-semibold text-content">{title}</h3>
          <p className="text-sm text-content-muted">{subtitle}</p>
        </div>
        <ArrowRight className="text-content-muted group-hover:text-primary-600 transition-colors" size={20} />
      </div>
    </Link>
  );
}

function RecentRequestsSection({ recent }) {
  if (!recent || recent.length === 0) return null;
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="section-title">Recent Requests</h3>
        <Link to="/my-requests" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-edge">
        {recent.map((request) => (
          <Link
            key={request.requestId}
            to={`/my-requests/${request.requestId}`}
            className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-primary-600">{request.requestId}</span>
              <span className="text-content">{request.name}</span>
            </div>
            <Badge variant={getStatusVariant(request.status)}>
              {getStatusLabel(request)}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DomainsListSection({ loading, domains }) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="section-title">Your Domains</h3>
        <Link to="/domains" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          View all →
        </Link>
      </div>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}
      {!loading && domains.length === 0 && (
        <p className="text-content-muted text-center py-8">
          No domains available. Contact your administrator.
        </p>
      )}
      {!loading && domains.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domains.slice(0, 6).map((domain) => (
            <Link
              key={domain.key}
              to={`/domains/${domain.key}`}
              className="p-4 border border-edge rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Layers className="text-primary-600" size={20} />
                </div>
                <div>
                  <h4 className="font-medium text-content">{domain.name}</h4>
                  <p className="text-sm text-content-muted">{domain.key}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeList({ items, variant, emptyText }) {
  if (!items || items.length === 0) {
    return <span className="text-content-muted text-sm">{emptyText}</span>;
  }
  return items.map((item) => (
    <Badge key={item} variant={variant}>
      {item}
    </Badge>
  ));
}

function UserAccessSection({ user }) {
  return (
    <div className="card">
      <h3 className="section-title mb-4">Your Access</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-content-muted mb-2">Roles</p>
          <div className="flex flex-wrap gap-1">
            {user?.roles?.map((role) => (
              <Badge key={role} variant="primary">
                {role}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-content-muted mb-2">Groups</p>
          <div className="flex flex-wrap gap-1">
            <BadgeList items={user?.groups} variant="success" emptyText="None" />
          </div>
        </div>
        <div>
          <p className="text-sm text-content-muted mb-2">Domains Access</p>
          <div className="flex flex-wrap gap-1">
            {user?.domains?.length > 0 ? user.domains.map((domain) => (
              <Badge key={domain} variant="warning">
                {domain}
              </Badge>
            )) : (
              <Badge variant="default">
                {getDomainAccessLabel(user?.roles)}
              </Badge>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-content-muted mb-2">Email</p>
          <p className="text-content truncate">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, isSuperAdmin, canManageUsers } = useAuth();
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
        // error handled silently
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const adminPath = isSuperAdmin() ? '/admin' : '/management';
  const adminTitle = isSuperAdmin() ? 'Admin Panel' : 'Management';
  const adminSubtitle = isSuperAdmin() ? 'Full system access' : 'Manage your area';

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, {user?.full_name || user?.username || 'User'}!
        </h2>
        <p className="text-primary-100">
          Here's an overview of your available domains and actions and new scenario requests.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Available Domains" value={domains.length} icon={<div className="stat-icon"><Layers size={24} /></div>} />
        <StatCard label="Your Roles" value={user?.roles?.length || 0} icon={<div className="stat-icon"><Users size={24} /></div>} />
        <StatCard label="Groups" value={user?.groups?.length || 0} icon={<div className="stat-icon"><TrendingUp size={24} /></div>} />
        <StatCard
          label="Status"
          value="Active"
          valueClassName="text-lg font-semibold text-green-600"
          icon={<div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><Activity size={24} /></div>}
        />
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Available Domains" value={domains.length} icon={<div className="stat-icon"><Layers size={24} /></div>} />
        <StatCard label="My Requests" value={requestStats.total} icon={<div className="stat-icon"><ClipboardList size={24} /></div>} />
        <StatCard
          label="In Progress"
          value={requestStats.inProgress}
          valueClassName="stat-value text-yellow-600"
          icon={<div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600"><Clock size={24} /></div>}
        />
        <StatCard
          label="Completed"
          value={requestStats.deployed}
          valueClassName="stat-value text-green-600"
          icon={<div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircle size={24} /></div>}
        />
      </div>

      <RecentRequestsSection recent={requestStats.recent} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickActionLink
          to="/ask-scenario"
          className="bg-primary-50 border-primary-200"
          icon={<div className="w-12 h-12 rounded-lg bg-primary-600 flex items-center justify-center text-white"><MessageSquarePlus size={24} /></div>}
          title="Ask Scenario"
          subtitle="Request new feature"
        />
        <QuickActionLink
          to="/my-requests"
          icon={<div className="stat-icon"><ClipboardList size={24} /></div>}
          title="My Requests"
          subtitle={`${requestStats.total} requests`}
        />
        <QuickActionLink
          to="/domains"
          icon={<div className="stat-icon"><Layers size={24} /></div>}
          title="My Domains"
          subtitle={`${domains.length} available`}
        />
        <QuickActionLink
          to="/profile"
          icon={<div className="w-12 h-12 rounded-lg bg-surface-hover flex items-center justify-center text-content-secondary"><Settings size={24} /></div>}
          title="Profile Settings"
          subtitle="Manage your account"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {canManageUsers() && (
          <QuickActionLink
            to={adminPath}
            icon={<div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600"><FileText size={24} /></div>}
            title={adminTitle}
            subtitle={adminSubtitle}
          />
        )}
      </div>

      <DomainsListSection loading={loading} domains={domains} />

      <UserAccessSection user={user} />
    </div>
  );
}

export default DashboardPage;
