import apiClient from './api';
import { setToken, setUser, getToken, getUser, clearSession } from './session';

/** Sign-in, sign-up and account endpoints (/api/auth). */
const authService = {
  async login(emailOrUsername, password) {
    const response = await apiClient.post('/auth/login', { emailOrUsername: emailOrUsername.trim(), password });
    if (response.success && response.token) {
      await setToken(response.token);
      await setUser(response.user);
    }
    return response;
  },

  /** { fullName, email, password, phone? } → signed in on success. 409 { code: 'ACCOUNT_EXISTS' } if the email is taken. */
  async register({ fullName, email, password, phone }) {
    const response = await apiClient.post('/auth/register', {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone ? phone.trim() : undefined,
    });
    if (response.success && response.token) {
      await setToken(response.token);
      await setUser(response.user);
    }
    return response;
  },

  async logout() {
    const token = await getToken();
    await clearSession();
    if (token) {
      // Tell the server in the background; the device is already signed out.
      apiClient.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    return { success: true };
  },

  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    if (response.success && response.user) await setUser(response.user);
    return response;
  },

  /** PUT /auth/profile with camelCase fields (fullName, phone, nationality, dietaryPreferences, …). */
  async updateProfile(fields) {
    const response = await apiClient.put('/auth/profile', fields);
    return response;
  },

  verifyEmail: (token) => apiClient.post('/auth/verify-email', { token }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword, confirmPassword) => apiClient.post('/auth/reset-password', { token, newPassword, confirmPassword }),
  changePassword: (currentPassword, newPassword, confirmPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword, confirmPassword }),
  checkPasswordRequirements: () => apiClient.get('/auth/check-password-requirements'),

  getToken,
  getUser,
  isAuthenticated: async () => Boolean(await getToken()),
};

export default authService;
