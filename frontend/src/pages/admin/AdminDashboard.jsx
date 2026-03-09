import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, scenarioRequestAPI, feedbackAPI } from '../../services/api';
import { Badge } from '../../components/shared';
import {
  Users, Layers, FileText, Shield, ArrowRight, TrendingUp,
  ClipboardList, Clock, CheckCircle, XCircle, Settings,
  Upload, Database, Key, Building, MessageSquare, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── helper: rank badge color ─── */
function getRankBadgeClass(index) {
  if (index === 0) return 'bg-yellow-100 text-yellow-700';
  if (index === 1) return 'bg-surface-hover text-content-secondary';
  if (index === 2) return 'bg-orange-100 text-orange-700';
  return 'bg-blue-100 text-blue-700';
}

/* ─── StatCard (reusable) ─── */
function StatCard({ to, label, value, bgColor, textColor, Icon }) {
  const content = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-content-muted">{label}</p>
        <p className={`text-2xl font-bold ${textColor || 'text-content'}`}>{value}</p>
      </div>
      <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center ${textColor || ''}`}>
        <Icon size={24} />
      </div>
    </div>
  );
  if (to) {
    return <Link to={to} className="card p-4 hover:shadow-md transition-all">{content}</Link>;
  }
  return <div className="card p-4">{content}</div>;
}

/* ─── Row 1: User & Access Stats ─── */
function UserStatsRow({ stats, isSuperAdmin }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        to={isSuperAdmin() ? '/admin/users' : '/management/users'}
        label="Total Users"
        value={stats?.total_users || 0}
        bgColor="bg-blue-50"
        textColor="text-blue-600"
        Icon={Users}
      />
      <StatCard
        label="Active Users"
        value={stats?.active_users || 0}
        bgColor="bg-green-50"
        textColor="text-green-600"
        Icon={CheckCircle}
      />
      <StatCard
        to={isSuperAdmin() ? '/admin/roles' : '#'}
        label="Total Roles"
        value={stats?.total_roles || 0}
        bgColor="bg-purple-50"
        textColor="text-purple-600"
        Icon={Shield}
      />
      <StatCard
        to={isSuperAdmin() ? '/admin/groups' : '#'}
        label="Total Groups"
        value={stats?.total_groups || 0}
        bgColor="bg-indigo-50"
        textColor="text-indigo-600"
        Icon={Users}
      />
    </div>
  );
}

/* ─── Row 2: Data Stats (domains, scenarios, playboards, configs) ─── */
function DataStatsRow({ stats, isSuperAdmin }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        to={isSuperAdmin() ? '/admin/domains' : '/management/domains'}
        label="Domains"
        value={stats?.total_domains || 0}
        bgColor="bg-teal-50"
        textColor="text-teal-600"
        Icon={Layers}
      />
      <StatCard
        to={isSuperAdmin() ? '/admin/scenarios' : '#'}
        label="Scenarios"
        value={stats?.total_scenarios || 0}
        bgColor="bg-pink-50"
        textColor="text-pink-600"
        Icon={FileText}
      />
      <StatCard
        to={isSuperAdmin() ? '/admin/playboards' : '#'}
        label="Playboards"
        value={stats?.total_playboards || 0}
        bgColor="bg-orange-50"
        textColor="text-orange-600"
        Icon={Database}
      />
      <StatCard
        to={isSuperAdmin() ? '/admin/configurations' : '#'}
        label="Configurations"
        value={stats?.total_configurations || 0}
        bgColor="bg-cyan-50"
        textColor="text-cyan-600"
        Icon={Settings}
      />
    </div>
  );
}

/* ─── Row 3: Request Stats ─── */
function RequestStatsRow({ requestStats }) {
  return (
    <>
      <div>
        <h4 className="text-l font-bold text-content">
          Scenario Request Statistics
        </h4>
        <p className="text-content-muted mt-1">Overview of reaquested scenarios</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="text-blue-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-content-muted">Submitted</p>
            <p className="text-xl font-bold text-blue-600">{requestStats.submitted}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
            <TrendingUp className="text-yellow-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-content-muted">In Progress</p>
            <p className="text-xl font-bold text-yellow-600">{requestStats.inProgress}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-content-muted">Deployed</p>
            <p className="text-xl font-bold text-green-600">{requestStats.deployed}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <XCircle className="text-red-600" size={20} />
          </div>
          <div>
            <p className="text-xs text-content-muted">Rejected</p>
            <p className="text-xl font-bold text-red-600">{requestStats.rejected}</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Row 4: Feedback Stats ─── */
function FeedbackStatsRow({ feedbackStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Link to="/admin/feedback" className="card p-4 hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-content-muted">Total Feedback</p>
            <p className="text-2xl font-bold text-content">{feedbackStats.total_feedback}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
            <MessageSquare size={24} />
          </div>
        </div>
      </Link>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-content-muted">Average Rating</p>
            <p className="text-2xl font-bold text-amber-600">{feedbackStats.avg_rating.toFixed(1)}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600">
            <Star size={24} />
          </div>
        </div>
        <div className="flex gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={14}
              className={star <= Math.round(feedbackStats.avg_rating) ? 'fill-amber-400 text-amber-400' : 'text-content-muted'}
            />
          ))}
        </div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-content-muted">This Week</p>
            <p className="text-2xl font-bold text-green-600">{feedbackStats.this_week_count}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
            <Clock size={24} />
          </div>
        </div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-content-muted">Rating Distribution</p>
        </div>
        <div className="flex gap-1">
          {Object.entries(feedbackStats.rating_distribution).map(([rating, count]) => (
            <div key={rating} className="flex-1 text-center">
              <div className="text-xs text-content-muted">{rating}★</div>
              <div className="text-sm font-semibold text-content-secondary">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Trend Chart ─── */
function ActivityTrendChart({ activityTrend }) {
  if (!activityTrend || activityTrend.length === 0) return null;
  const maxCount = Math.max(...activityTrend.map(t => t.count), 1);
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Activity Trend (Last 7 Days)</h3>
      <div className="flex items-end space-x-2 h-48">
        {activityTrend.map((item) => {
          const height = (item.count / maxCount) * 100;
          return (
            <div key={item.date} className="flex-1 flex flex-col items-center">
              <div className="text-xs font-medium text-content mb-1">{item.count}</div>
              <div
                className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors"
                style={{ height: `${height}%`, minHeight: item.count > 0 ? '8px' : '0' }}
                title={`${item.date}: ${item.count} activities`}
              />
              <span className="text-xs text-content-muted mt-2">
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Role Distribution ─── */
function RoleDistribution({ roleDistribution }) {
  if (!roleDistribution || roleDistribution.length === 0) return null;
  const total = roleDistribution.reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Role Distribution</h3>
      <div className="space-y-3">
        {roleDistribution.slice(0, 5).map((role) => {
          const percentage = total > 0 ? ((role.count / total) * 100).toFixed(1) : 0;
          return (
            <div key={role.role}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-content-secondary truncate">{role.role}</span>
                <span className="text-sm text-content-muted">{role.count} ({percentage}%)</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Analytics Section (chart + role distribution) ─── */
function AnalyticsSection({ analytics }) {
  if (!analytics) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ActivityTrendChart activityTrend={analytics.activity_trend} />
      <RoleDistribution roleDistribution={analytics.role_distribution} />
    </div>
  );
}

/* ─── Top Active Users ─── */
function TopActiveUsers({ users }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Top Active Users (Last 7 Days)</h3>
      <div className="space-y-3">
        {(!users || users.length === 0) ? (
          <p className="text-content-muted text-center py-4">No activity data available</p>
        ) : (
          users.map((user, index) => (
            <div key={user.user_email} className="flex items-center justify-between py-2 border-b border-edge-light last:border-0">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${getRankBadgeClass(index)}`}>
                  <span className="font-medium text-sm">{index + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-content truncate max-w-[180px]">{user.user_email}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-primary-600">{user.activities} activities</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Recent Signups ─── */
function RecentSignups({ signups }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Recent User Signups</h3>
      <div className="space-y-3">
        {(!signups || signups.length === 0) ? (
          <p className="text-content-muted text-center py-4">No recent signups</p>
        ) : (
          signups.map((signup, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-edge-light last:border-0">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <span className="text-green-700 font-medium text-sm">
                    {signup.full_name?.charAt(0) || signup.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-content">{signup.full_name || 'N/A'}</p>
                  <p className="text-xs text-content-muted">{signup.email}</p>
                </div>
              </div>
              <span className="text-xs text-content-muted">
                {signup.created_at ? new Date(signup.created_at).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Configurations Overview ─── */
function ConfigurationsOverview({ summary, stats }) {
  if (!summary?.configurations) return null;
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-content">Configurations Overview</h3>
        <Link to="/admin/configurations" className="text-sm text-primary-600 hover:text-primary-700">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center p-4 bg-surface-secondary rounded-lg">
          <div className="text-2xl font-bold text-content">{stats?.total_configurations || 0}</div>
          <div className="text-sm text-content-muted">Total Configs</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{summary?.configurations?.['process-config'] || 0}</div>
          <div className="text-sm text-content-muted">Process</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{summary?.configurations?.['lookup-data'] || 0}</div>
          <div className="text-sm text-content-muted">Lookup</div>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{summary?.configurations?.['gcs-data'] || 0}</div>
          <div className="text-sm text-content-muted">GCS Files</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{summary?.configurations?.['snapshot-data'] || 0}</div>
          <div className="text-sm text-content-muted">Snapshot</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Entity Status Summary ─── */
function EntityStatusSummary({ summary }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Entity Status Summary</h3>
      <div className="space-y-4">
        {summary && Object.entries(summary)
          .filter(([key]) => !key.includes('module') && !key.includes('configurations'))
          .map(([entity, statusData]) => (
            <div key={entity} className="flex items-center justify-between py-2 border-b border-edge-light last:border-0">
              <span className="text-content-muted capitalize">{entity}</span>
              <div className="flex items-center space-x-3">
                <Badge variant="success">{statusData.active || 0} Active</Badge>
                <Badge variant="danger">{statusData.inactive || 0} Inactive</Badge>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── Recent Logins ─── */
function RecentLogins({ recentLogins }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Recent Logins</h3>
      <div className="space-y-3">
        {recentLogins.length === 0 ? (
          <p className="text-content-muted text-center py-4">No recent logins</p>
        ) : (
          recentLogins.map((login, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-edge-light last:border-0">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                  <span className="text-primary-700 font-medium text-sm">
                    {login.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-content">{login.full_name}</p>
                  <p className="text-xs text-content-muted">{login.email}</p>
                </div>
              </div>
              <span className="text-xs text-content-muted">
                {login.last_login ? new Date(login.last_login).toLocaleString() : 'Never'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Quick Actions ─── */
function QuickActions({ isSuperAdmin }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-content mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link
          to={isSuperAdmin() ? '/admin/users' : '/management/users'}
          className="flex flex-col items-center p-4 rounded-lg border border-edge hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Users className="w-8 h-8 text-primary-600 mb-2" />
          <span className="text-sm font-medium text-content-secondary">Add User</span>
        </Link>
        <Link
          to="/admin/roles"
          className="flex flex-col items-center p-4 rounded-lg border border-edge hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Shield className="w-8 h-8 text-primary-600 mb-2" />
          <span className="text-sm font-medium text-content-secondary">Manage Roles</span>
        </Link>
        <Link
          to="/admin/permissions"
          className="flex flex-col items-center p-4 rounded-lg border border-edge hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Key className="w-8 h-8 text-primary-600 mb-2" />
          <span className="text-sm font-medium text-content-secondary">Permissions</span>
        </Link>
        <Link
          to="/admin/configurations"
          className="flex flex-col items-center p-4 rounded-lg border border-edge hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Settings className="w-8 h-8 text-primary-600 mb-2" />
          <span className="text-sm font-medium text-content-secondary">Configurations</span>
        </Link>
        <Link
          to="/admin/bulk-upload"
          className="flex flex-col items-center p-4 rounded-lg border border-edge hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <Upload className="w-8 h-8 text-primary-600 mb-2" />
          <span className="text-sm font-medium text-content-secondary">Bulk Upload</span>
        </Link>
      </div>
    </div>
  );
}

/* ─── Loading Spinner ─── */
function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

/* ─── Default stats objects ─── */
const DEFAULT_REQUEST_STATS = { total: 0, submitted: 0, inProgress: 0, deployed: 0, rejected: 0, recent: [] };
const DEFAULT_FEEDBACK_STATS = { total_feedback: 0, avg_rating: 0, this_week_count: 0, rating_distribution: {} };

/* ─── Data fetching helper ─── */
async function fetchAllDashboardData() {
  const [statsRes, summaryRes, loginsRes, analyticsRes, requestsRes, feedbackRes] = await Promise.all([
    dashboardAPI.getStats(),
    dashboardAPI.getSummary(),
    dashboardAPI.getRecentLogins(5),
    dashboardAPI.getAnalytics(),
    scenarioRequestAPI.getStats(),
    feedbackAPI.getStats().catch(() => ({ data: DEFAULT_FEEDBACK_STATS }))
  ]);
  return {
    stats: statsRes.data,
    summary: summaryRes.data,
    recentLogins: loginsRes.data.recent_logins || [],
    analytics: analyticsRes.data,
    requestStats: requestsRes.data || DEFAULT_REQUEST_STATS,
    feedbackStats: feedbackRes.data || DEFAULT_FEEDBACK_STATS,
  };
}

/* ─── Analytics Users & Signups ─── */
function AnalyticsUsersSection({ analytics }) {
  if (!analytics) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TopActiveUsers users={analytics.top_active_users} />
      <RecentSignups signups={analytics.recent_signups} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
function AdminDashboard() {
  const { isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentLogins, setRecentLogins] = useState([]);
  const [requestStats, setRequestStats] = useState(DEFAULT_REQUEST_STATS);
  const [feedbackStats, setFeedbackStats] = useState(DEFAULT_FEEDBACK_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllDashboardData()
      .then((data) => {
        setStats(data.stats);
        setSummary(data.summary);
        setRecentLogins(data.recentLogins);
        setAnalytics(data.analytics);
        setRequestStats(data.requestStats);
        setFeedbackStats(data.feedbackStats);
      })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLoading />;

  const title = isSuperAdmin() ? 'Admin Dashboard' : 'Management Dashboard';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{title}</h1>
        <p className="text-content-muted mt-1">Overview of your admin panel</p>
      </div>

      <UserStatsRow stats={stats} isSuperAdmin={isSuperAdmin} />
      <DataStatsRow stats={stats} isSuperAdmin={isSuperAdmin} />
      <RequestStatsRow requestStats={requestStats} />
      <FeedbackStatsRow feedbackStats={feedbackStats} />
      <AnalyticsSection analytics={analytics} />
      <AnalyticsUsersSection analytics={analytics} />
      <ConfigurationsOverview summary={summary} stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EntityStatusSummary summary={summary} />
        <RecentLogins recentLogins={recentLogins} />
      </div>

      <QuickActions isSuperAdmin={isSuperAdmin} />
    </div>
  );
}

export default AdminDashboard;
