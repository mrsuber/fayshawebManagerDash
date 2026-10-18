import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const UserManagement = () => {
  const { token, hasPermission, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters and pagination
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [loginHistory, setLoginHistory] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'

  // Check permissions
  const canViewUsers = hasPermission('users', 'view');
  const canCreateUsers = hasPermission('users', 'create');
  const canEditUsers = hasPermission('users', 'edit');
  const canDeleteUsers = hasPermission('users', 'delete');

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (roleFilter) queryParams.append('role', roleFilter);
      if (statusFilter) queryParams.append('status', statusFilter);

      const response = await fetch(`${API_URL}/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_URL}/users/roles/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  // Fetch login history
  const fetchLoginHistory = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/login-history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setLoginHistory(data.history);
        setShowLoginHistory(true);
      } else {
        setError('Failed to fetch login history');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // Update user status
  const updateUserStatus = async (userId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('User status updated successfully');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to update user status');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // Delete user (soft delete)
  const deleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`${API_URL}/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('User deleted successfully');
        setShowDeleteModal(false);
        setSelectedUser(null);
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // Permanently delete user and ALL data
  const permanentlyDeleteUser = async () => {
    if (!selectedUser) return;

    // Double confirmation for permanent delete
    const confirmMessage = `⚠️ PERMANENT DELETE WARNING ⚠️\n\nYou are about to PERMANENTLY delete:\n\nUser: ${selectedUser.full_name || selectedUser.email}\nEmail: ${selectedUser.email}\n\nThis will DELETE ALL:\n• User account\n• All bookings (${selectedUser.email})\n• All wellness data\n• All messages\n• All rewards\n• All login history\n• ALL other user data\n\n❌ THIS ACTION CANNOT BE UNDONE ❌\n\nType "DELETE" to confirm:`;

    const userInput = prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      setError('Permanent deletion cancelled - confirmation failed');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${selectedUser.id}/permanent`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ ${data.message}\n\nDeleted ${data.summary?.total_records_deleted || 0} total records`);
        setShowDeleteModal(false);
        setSelectedUser(null);
        fetchUsers();

        // Show detailed summary in console
        console.log('[PERMANENT DELETE SUCCESS]', data.summary);

        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(data.error || 'Failed to permanently delete user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // Unlock user account
  const unlockUser = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/unlock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('User account unlocked successfully');
        fetchUsers();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to unlock user account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // View user profile
  const viewUserProfile = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setProfileUser(data.user);
        setShowProfileModal(true);
      } else {
        setError('Failed to fetch user profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  useEffect(() => {
    if (canViewUsers) {
      fetchUsers();
      fetchRoles();
    }
  }, [page, roleFilter, statusFilter]);

  if (!canViewUsers) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>You do not have permission to view users.</p>
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-800';
      case 'content_manager':
        return 'bg-blue-100 text-blue-800';
      case 'editor':
        return 'bg-green-100 text-green-800';
      case 'guest':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'pending_verification':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User & Role Management</h1>
        <p className="text-gray-600">Manage system users and their roles</p>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
          <button onClick={() => setError('')} className="text-sm underline mt-1">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <p>{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Roles & Permissions
          </button>
        </nav>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Filters and Actions */}
          <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 flex-wrap">
              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Roles</option>
                <option value="guest">🏨 Guests (Mobile App Users)</option>
                {roles.filter(role => role.name !== 'guest').map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.display_name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="pending_verification">Pending Verification</option>
              </select>
            </div>

            {canCreateUsers && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-md"
              >
                + Create New User
              </button>
            )}
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No users found.</p>
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold text-sm">
                              {user.full_name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            <div className="text-xs text-gray-400">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role_name)}`}>
                            {user.role_display_name}
                          </span>
                          {user.role_name === 'guest' && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              📱 Mobile App User
                            </span>
                          )}
                          {user.is_password_temporary && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                              🔑 Temp Password
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                            {user.status.replace('_', ' ')}
                          </span>
                          {!user.email_verified && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Email not verified
                            </span>
                          )}
                          {user.is_locked && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              🔒 Locked
                            </span>
                          )}
                          {user.failed_login_attempts > 0 && !user.is_locked && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                              ⚠️ {user.failed_login_attempts} failed attempt{user.failed_login_attempts > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => viewUserProfile(user.id)}
                            className="text-indigo-600 hover:text-indigo-900 font-semibold"
                            title="View profile"
                          >
                            Profile
                          </button>

                          <button
                            onClick={() => fetchLoginHistory(user.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View login history"
                          >
                            History
                          </button>

                          {canEditUsers && user.id !== currentUser.id && user.is_locked && (
                            <button
                              onClick={() => unlockUser(user.id)}
                              className="text-purple-600 hover:text-purple-900 font-semibold"
                              title="Unlock account"
                            >
                              🔓 Unlock
                            </button>
                          )}

                          {canEditUsers && user.id !== currentUser.id && (
                            <>
                              {user.status === 'active' ? (
                                <button
                                  onClick={() => updateUserStatus(user.id, 'inactive')}
                                  className="text-yellow-600 hover:text-yellow-900"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateUserStatus(user.id, 'active')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Activate
                                </button>
                              )}
                            </>
                          )}

                          {canDeleteUsers && user.id !== currentUser.id && (
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'roles' && (
        <RolesView roles={roles} />
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          roles={roles}
          token={token}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
            setSuccess('User created successfully!');
            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <DeleteUserModal
          user={selectedUser}
          currentUserRole={currentUser?.role}
          onConfirm={deleteUser}
          onPermanentDelete={permanentlyDeleteUser}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Login History Modal */}
      {showLoginHistory && (
        <LoginHistoryModal
          history={loginHistory}
          onClose={() => {
            setShowLoginHistory(false);
            setLoginHistory([]);
          }}
        />
      )}

      {/* User Profile Modal */}
      {showProfileModal && profileUser && (
        <UserProfileModal
          user={profileUser}
          token={token}
          canEdit={canEditUsers}
          onClose={() => {
            setShowProfileModal(false);
            setProfileUser(null);
          }}
          onUpdate={() => {
            fetchUsers();
            setSuccess('User profile updated successfully');
            setTimeout(() => setSuccess(''), 3000);
          }}
        />
      )}
    </div>
  );
};

// Roles View Component
const RolesView = ({ roles }) => {
  return (
    <div className="space-y-6">
      {roles.map((role) => (
        <div key={role.id} className="bg-white shadow-md rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{role.display_name}</h3>
              <p className="text-sm text-gray-600 mt-1">{role.description}</p>
              {role.is_system_role && (
                <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  System Role
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Permissions:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(role.permissions).map(([resource, actions]) => (
                <div key={resource} className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
                    {resource}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(actions).map(([action, allowed]) => (
                      <div key={action} className="flex items-center text-xs">
                        <span className={`mr-1 ${allowed ? 'text-green-500' : 'text-red-500'}`}>
                          {allowed ? '✓' : '✗'}
                        </span>
                        <span className={allowed ? 'text-gray-700' : 'text-gray-400'}>
                          {action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Create User Modal Component
const CreateUserModal = ({ roles, token, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    fullName: '',
    roleId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setCreatedUser({
          ...data.user,
          temporaryPassword: data.temporaryPassword
        });
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (createdUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-green-600 mb-4">✓ User Created Successfully!</h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Important - Save These Credentials</p>
            <p className="text-xs text-yellow-800 mb-3">Share these credentials with the user. The temporary password will not be shown again.</p>

            <div className="space-y-2 bg-white p-3 rounded border border-yellow-300">
              <div>
                <span className="text-xs text-gray-600">Email:</span>
                <p className="font-mono text-sm font-semibold">{createdUser.email}</p>
              </div>
              <div>
                <span className="text-xs text-gray-600">Username:</span>
                <p className="font-mono text-sm font-semibold">{createdUser.username}</p>
              </div>
              <div>
                <span className="text-xs text-gray-600">Temporary Password:</span>
                <p className="font-mono text-sm font-semibold text-red-600">{createdUser.temporaryPassword}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            The user will be required to change this password on first login.
          </p>

          <button
            onClick={onSuccess}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New User</h2>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="johndoe"
            />
            <p className="text-xs text-gray-500 mt-1">Letters, numbers, and underscores only</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              required
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete User Modal Component
const DeleteUserModal = ({ user, currentUserRole, onConfirm, onPermanentDelete, onCancel }) => {
  const isSuperAdmin = currentUserRole === 'superadmin';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Delete User?</h2>
        <div className="mb-6 space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{user.full_name || user.username}</strong> ({user.email})?
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Soft Delete:</strong> User account will be deactivated but data will be preserved in the database.
            </p>
          </div>

          {isSuperAdmin && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm text-red-800 font-semibold mb-2">
                ⚠️ Superadmin Only: Permanent Delete Option
              </p>
              <p className="text-xs text-red-700">
                Permanently deletes ALL user data including bookings, wellness data, messages, rewards, and login history. This action CANNOT be undone!
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={onConfirm}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Soft Delete User
          </button>

          {isSuperAdmin && (
            <button
              onClick={onPermanentDelete}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold border-2 border-red-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              PERMANENT DELETE - Purge All Data
            </button>
          )}

          <button
            onClick={onCancel}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Login History Modal Component
const LoginHistoryModal = ({ history, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Login History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-600">No login history found.</p>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border ${
                  entry.login_successful
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          entry.login_successful ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {entry.login_successful ? '✓ Successful' : '✗ Failed'}
                      </span>
                      {!entry.login_successful && entry.failure_reason && (
                        <span className="text-xs text-red-600">({entry.failure_reason})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      IP: {entry.ip_address || 'Unknown'}
                    </div>
                    {entry.user_agent && (
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.user_agent.substring(0, 60)}...
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// User Profile Modal Component
const UserProfileModal = ({ user, token, canEdit, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: user.full_name || '',
    phone: user.phone || '',
    dateOfBirth: user.date_of_birth || '',
    nationality: user.nationality || '',
    emergencyContact: user.emergency_contact || '',
    emergencyPhone: user.emergency_phone || '',
    dietaryPreferences: user.dietary_preferences || '',
    allergies: user.allergies || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setIsEditing(false);
        onUpdate();
        onClose();
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit User Profile' : 'User Profile'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Basic Information</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nationality
                </label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter nationality"
                />
              </div>

              {/* Emergency Contact */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-4 border-b pb-2">Emergency Contact</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter emergency contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="+1234567890"
                />
              </div>

              {/* Preferences */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-4 border-b pb-2">Preferences & Health</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Preferences
                </label>
                <textarea
                  value={formData.dietaryPreferences}
                  onChange={(e) => setFormData({ ...formData, dietaryPreferences: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows="3"
                  placeholder="Vegetarian, Vegan, Gluten-free, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies
                </label>
                <textarea
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows="3"
                  placeholder="List any allergies"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Account Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-base font-medium text-gray-900">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Username</p>
                  <p className="text-base font-medium text-gray-900">@{user.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="text-base font-medium text-gray-900">{user.role_display_name || user.role_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-base font-medium text-gray-900 capitalize">{user.status}</p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="text-base font-medium text-gray-900">{user.full_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="text-base font-medium text-gray-900">{user.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date of Birth</p>
                  <p className="text-base font-medium text-gray-900">{formatDate(user.date_of_birth)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Nationality</p>
                  <p className="text-base font-medium text-gray-900">{user.nationality || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Contact Name</p>
                  <p className="text-base font-medium text-gray-900">{user.emergency_contact || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact Phone</p>
                  <p className="text-base font-medium text-gray-900">{user.emergency_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Preferences & Health */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Preferences & Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Dietary Preferences</p>
                  <p className="text-base font-medium text-gray-900">{user.dietary_preferences || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Allergies</p>
                  <p className="text-base font-medium text-gray-900">{user.allergies || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Activity Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Last Login</p>
                  <p className="text-base font-medium text-gray-900">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Account Created</p>
                  <p className="text-base font-medium text-gray-900">
                    {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-semibold"
                >
                  Edit Profile
                </button>
              )}
              <button
                onClick={onClose}
                className={`${canEdit ? 'flex-1' : 'w-full'} bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold`}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
