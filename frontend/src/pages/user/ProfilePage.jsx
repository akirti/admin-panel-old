import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { User, Mail, Shield, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { Badge } from '../../components/shared';

function validatePasswordChange(passwordData) {
  if (passwordData.new_password !== passwordData.confirm_password) {
    return 'New passwords do not match';
  }
  if (passwordData.new_password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

function isAdminRole(roles) {
  return roles?.some(r => ['super-administrator', 'administrator'].includes(r));
}

function getDomainAccessLabel(user) {
  if (user?.domains?.length > 0) return null;
  return isAdminRole(user?.roles) ? 'All Domains' : 'No Domains Assigned';
}

function BadgeList({ items, variant, emptyText, icon: Icon }) {
  if (!items || items.length === 0) {
    return <span className="text-content-muted text-sm">{emptyText}</span>;
  }
  return items.map((item) => (
    <Badge key={item} variant={variant} className={Icon ? 'flex items-center gap-1' : undefined}>
      {Icon && <Icon size={12} />}
      {item}
    </Badge>
  ));
}

function DomainAccessBadges({ domains, domainAccessLabel }) {
  if (domains && domains.length > 0) {
    return domains.map((domain) => (
      <Badge key={domain} variant="warning">{domain}</Badge>
    ));
  }
  return <Badge variant="default">{domainAccessLabel}</Badge>;
}

function RolesAccessSection({ user, domainAccessLabel }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="section-title">Roles & Access</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-content-secondary mb-2 block">Roles</label>
          <div className="flex flex-wrap gap-2">
            <BadgeList items={user?.roles} variant="primary" emptyText="No roles assigned" icon={Shield} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-content-secondary mb-2 block">Groups</label>
          <div className="flex flex-wrap gap-2">
            <BadgeList items={user?.groups} variant="success" emptyText="No groups assigned" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-content-secondary mb-2 block">Domain Access</label>
          <div className="flex flex-wrap gap-2">
            <DomainAccessBadges domains={user?.domains} domainAccessLabel={domainAccessLabel} />
          </div>
        </div>
      </div>

      <p className="text-xs text-content-muted mt-4">
        Contact your administrator to change roles or access levels.
      </p>
    </div>
  );
}

function PasswordField({ label, name, value, onChange, showPasswords, toggleVisibility, placeholder }) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
        <input
          type={showPasswords ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          className={`input-field pl-10${toggleVisibility ? ' pr-10' : ''}`}
          placeholder={placeholder}
          required
        />
        {toggleVisibility && (
          <button
            type="button"
            onClick={toggleVisibility}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
          >
            {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
  });

  const [passwordData, setPasswordData] = useState({
    password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile(profileData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    const validationError = validatePasswordChange(passwordData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPasswordLoading(true);

    try {
      await authAPI.updatePassword(passwordData.password, passwordData.new_password);
      toast.success('Password updated successfully');
      setPasswordData({ password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const domainAccessLabel = getDomainAccessLabel(user);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="page-title">Profile Settings</h1>

      {/* Profile Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-title">Personal Information</h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="input-label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
              <input
                type="email"
                value={user?.email || ''}
                className="input-field pl-10 bg-surface-secondary"
                disabled
              />
            </div>
            <p className="text-xs text-content-muted mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="input-label">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
              <input
                type="text"
                name="full_name"
                value={profileData.full_name}
                onChange={handleProfileChange}
                className="input-field pl-10"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div>
            <label className="input-label">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={20} />
              <input
                type="text"
                name="username"
                value={profileData.username}
                onChange={handleProfileChange}
                className="input-field pl-10"
                placeholder="Enter your username"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <RolesAccessSection user={user} domainAccessLabel={domainAccessLabel} />

      {/* Change Password */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-title">Change Password</h2>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <PasswordField
            label="Current Password"
            name="password"
            value={passwordData.password}
            onChange={handlePasswordChange}
            showPasswords={showPasswords}
            toggleVisibility={() => setShowPasswords(!showPasswords)}
            placeholder="Enter current password"
          />

          <PasswordField
            label="New Password"
            name="new_password"
            value={passwordData.new_password}
            onChange={handlePasswordChange}
            showPasswords={showPasswords}
            placeholder="Enter new password"
          />

          <PasswordField
            label="Confirm New Password"
            name="confirm_password"
            value={passwordData.confirm_password}
            onChange={handlePasswordChange}
            showPasswords={showPasswords}
            placeholder="Confirm new password"
          />

          <button
            type="submit"
            disabled={passwordLoading}
            className="btn-primary flex items-center gap-2"
          >
            <Lock size={18} />
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;
