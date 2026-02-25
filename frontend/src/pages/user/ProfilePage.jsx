import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { User, Mail, Shield, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { Badge } from '../../components/shared';

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

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
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
            <label className="input-label">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type="email"
                value={user?.email || ''}
                className="input-field pl-10 bg-neutral-50"
                disabled
              />
            </div>
            <p className="text-xs text-neutral-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="input-label">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
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
            <label className="input-label">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
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

      {/* Roles & Access */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-title">Roles & Access</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {user?.roles?.map((role) => (
                <Badge key={role} variant="primary" className="flex items-center gap-1">
                  <Shield size={12} />
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Groups
            </label>
            <div className="flex flex-wrap gap-2">
              {user?.groups?.length > 0 ? user.groups.map((group) => (
                <Badge key={group} variant="success">
                  {group}
                </Badge>
              )) : (
                <span className="text-neutral-500 text-sm">No groups assigned</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Domain Access
            </label>
            <div className="flex flex-wrap gap-2">
              {user?.domains?.length > 0 ? user.domains.map((domain) => (
                <Badge key={domain} variant="warning">
                  {domain}
                </Badge>
              )) : (
                <Badge variant="default">
                  {user?.roles?.some(r => ['super-administrator', 'administrator'].includes(r)) ? 'All Domains' : 'No Domains Assigned'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mt-4">
          Contact your administrator to change roles or access levels.
        </p>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-title">Change Password</h2>
        </div>
        
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="input-label">
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="password"
                value={passwordData.password}
                onChange={handlePasswordChange}
                className="input-field pl-10 pr-10"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="input-label">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                className="input-field pl-10"
                placeholder="Enter new password"
                required
              />
            </div>
          </div>

          <div>
            <label className="input-label">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                className="input-field pl-10"
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>

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
