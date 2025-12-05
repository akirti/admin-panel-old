import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../components/shared';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    username: '',
    full_name: ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getCurrentUser();
      setUser(response.data);
      setProfileData({
        username: response.data.username || '',
        full_name: response.data.full_name || ''
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await authAPI.updateProfile(profileData.username, profileData.full_name);
      toast.success('Profile updated successfully');
      setEditMode(false);
      fetchUserProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await authAPI.changePassword(passwordData.current_password, passwordData.new_password);
      toast.success('Password changed successfully');
      setPasswordMode(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">User not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Information */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Profile Information</h2>
            {!editMode && (
              <Button onClick={() => setEditMode(true)} variant="secondary" size="sm">
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        <div className="p-6">
          {!editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Username</label>
                  <p className="mt-1 text-gray-900">{user.username || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Full Name</label>
                  <p className="mt-1 text-gray-900">{user.full_name || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge variant={user.is_active ? 'success' : 'danger'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {user.is_super_admin && (
                <div className="pt-4 border-t">
                  <Badge variant="primary" size="lg">Super Administrator</Badge>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Account Created</label>
                  <p className="mt-1 text-gray-900">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="mt-1 text-gray-900">
                    {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Login</label>
                  <p className="mt-1 text-gray-900">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (Read-only)</label>
                  <input
                    type="text"
                    value={user.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <Input
                  label="Username"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>
              <Input
                label="Full Name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                placeholder="Enter full name"
              />
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditMode(false);
                    setProfileData({
                      username: user.username || '',
                      full_name: user.full_name || ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {/* Roles, Groups, and Customers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Roles</h3>
          {user.roles && user.roles.length > 0 ? (
            <div className="space-y-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="primary">{role}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No roles assigned</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Groups</h3>
          {user.groups && user.groups.length > 0 ? (
            <div className="space-y-2">
              {user.groups.map((group) => (
                <Badge key={group} variant="info">{group}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No groups assigned</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Customers</h3>
          {user.customers && user.customers.length > 0 ? (
            <div className="space-y-2">
              {user.customers.map((customer) => (
                <Badge key={customer} variant="success">{customer}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No customers assigned</p>
          )}
        </Card>
      </div>

      {/* Security Section */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Security</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your password and security settings</p>
            </div>
            {!passwordMode && (
              <Button onClick={() => setPasswordMode(true)} variant="secondary" size="sm">
                Change Password
              </Button>
            )}
          </div>
        </div>

        <div className="p-6">
          {!passwordMode ? (
            <div className="text-gray-600">
              <p className="text-sm">
                Password last updated: {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Unknown'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Keep your password secure and change it regularly to protect your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                type="password"
                label="Current Password *"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                placeholder="Enter current password"
                required
              />
              <Input
                type="password"
                label="New Password *"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                placeholder="Enter new password (min 8 characters)"
                required
              />
              <Input
                type="password"
                label="Confirm New Password *"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                placeholder="Confirm new password"
                required
              />
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPasswordMode(false);
                    setPasswordData({
                      current_password: '',
                      new_password: '',
                      confirm_password: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Change Password</Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {/* Account Stats */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Account Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{user.roles?.length || 0}</div>
            <div className="text-sm text-gray-500">Roles</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{user.groups?.length || 0}</div>
            <div className="text-sm text-gray-500">Groups</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{user.customers?.length || 0}</div>
            <div className="text-sm text-gray-500">Customers</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {user.created_at ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0}
            </div>
            <div className="text-sm text-gray-500">Days Active</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
