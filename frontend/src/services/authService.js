/**
 * Authentication service for managing user registration, login, logout, and token management.
 * Communicates with Django REST backend using JWT tokens.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const TOKEN_KEY = "mindlog_access_token";
const REFRESH_TOKEN_KEY = "mindlog_refresh_token";
const USER_KEY = "mindlog_user";

/**
 * Generic API request handler with token injection
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add access token to authorized requests
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 by attempting token refresh
  if (response.status === 401 && token && !options.skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the request with new token
      return apiRequest(endpoint, { ...options, skipRefresh: true });
    } else {
      // Refresh failed, clear auth
      clearAuth();
      // Don't redirect here - let caller decide based on context
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * Store access and refresh tokens
 */
function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * Get stored access token
 */
function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Clear all authentication data
 */
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Validate and set tokens after successful login
 * Ensures tokens are only set if both access and refresh tokens are present in the response
 * @param {Object} loginResponse - Response from login endpoint containing user, access, refresh
 * @returns {boolean} - True if tokens were successfully set, false if response was invalid
 */
function validateAndSetTokens(loginResponse) {
  // Validate response structure
  if (!loginResponse || typeof loginResponse !== 'object') {
    return false;
  }

  // Both tokens and user must be present for valid login response
  const hasAccessToken = typeof loginResponse.access === 'string' && loginResponse.access.length > 0;
  const hasRefreshToken = typeof loginResponse.refresh === 'string' && loginResponse.refresh.length > 0;
  const hasUser = loginResponse.user && typeof loginResponse.user === 'object';

  if (!hasAccessToken || !hasRefreshToken || !hasUser) {
    console.error("Invalid login response: missing required fields");
    return false;
  }

  // Only clear old tokens after validation succeeds
  clearAuth();

  // Set new tokens and user
  setTokens(loginResponse.access, loginResponse.refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));

  return true;
}

/**
 * Attempt to refresh the access token using the refresh token
 */
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const data = await apiRequest("/auth/token/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
      skipRefresh: true,
    });

    if (data.access) {
      setTokens(data.access, refreshToken);
      return true;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
    clearAuth();
  }

  return false;
}

/**
 * Register a new user
 * Registration must NOT use tokens from a currently authenticated session.
 * This prevents an admin's JWT from being attached to registration requests.
 * @param {Object} userData - { username, email, password, password_confirm, first_name, last_name }
 * @returns {Promise<Object>} - User data and success message
 */
export async function register(userData) {
  // Use fetch directly without attached JWT to ensure registration is independent
  const url = `${API_BASE_URL}/auth/register/`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Registration failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Login user and store tokens
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User data and tokens
 * @throws {Error} - If login fails or response is invalid
 */
export async function login(usernameOrEmail, password) {
  const response = await apiRequest("/auth/login/", {
    method: "POST",
    body: JSON.stringify({
      username_or_email: usernameOrEmail,
      password,
    }),
  });

  // Validate and set tokens - this will throw if response is invalid
  const tokensSet = validateAndSetTokens(response);
  if (!tokensSet) {
    throw new Error("Invalid login response from server");
  }

  return response;
}

/**
 * Get current authenticated user
 * @returns {Promise<Object>} - Current user data
 */
export async function getCurrentUser() {
  try {
    const response = await apiRequest("/auth/me/", {
      method: "GET",
    });
    return response;
  } catch (error) {
    clearAuth();
    throw error;
  }
}

/**
 * Logout user and clear tokens
 * @returns {Promise<Object>} - Success response
 */
export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await apiRequest("/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }
  } catch (error) {
    console.error("Logout request failed:", error);
  }

  // Clear local auth data regardless of server response
  clearAuth();
}

/**
 * Change user password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @param {string} newPasswordConfirm - New password confirmation
 * @returns {Promise<Object>} - Success response
 */
export async function changePassword(oldPassword, newPassword, newPasswordConfirm) {
  return apiRequest("/auth/change-password/", {
    method: "POST",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    }),
  });
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getAccessToken();
}

/**
 * Get cached user data (from localStorage)
 * @returns {Object|null} - User object or null
 */
export function getCachedUser() {
  const userJson = localStorage.getItem(USER_KEY);
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

/**
 * Set cached user data (usually called after getCurrentUser)
 * @param {Object} user - User object to cache
 */
export function setCachedUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Get the appropriate login redirect path for the current auth state
 * @returns {string} - Either "/login" for clients or "/admin/login" for admins
 */
export function getLoginRedirectPath() {
  const user = getCachedUser();
  return user?.role === "admin" ? "/admin/login" : "/login";
}

/**
 * Get stored tokens (for debugging or testing)
 * @returns {Object} - { accessToken, refreshToken }
 */
export function getTokens() {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
  };
}

export default {
  register,
  login,
  logout,
  getCurrentUser,
  changePassword,
  isAuthenticated,
  getCachedUser,
  setCachedUser,
  getLoginRedirectPath,
  getTokens,
  clearAuth,
  setTokens,
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
};
