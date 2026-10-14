
/**
 * MindLog AI Authentication Service
 *
 * Handles:
 * - Registration
 * - Login
 * - Logout
 * - JWT access tokens
 * - JWT refresh tokens
 * - Current user
 * - Password changes
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api";

const TOKEN_KEY = "mindlog_access_token";
const REFRESH_TOKEN_KEY = "mindlog_refresh_token";
const USER_KEY = "mindlog_user";


/**
 * Save JWT tokens.
 */
function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refreshToken
    );
  }
}


/**
 * Get access token.
 */
function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}


/**
 * Get refresh token.
 */
function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}


/**
 * Remove authentication data.
 */
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}


/**
 * Generic API request handler.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Attempt refresh if access token expired.
  if (
    response.status === 401 &&
    token &&
    !options.skipRefresh
  ) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiRequest(endpoint, {
        ...options,
        skipRefresh: true,
      });
    }

    clearAuth();

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      errorData.detail ||
      `API error: ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}


/**
 * Validate login response and save tokens.
 */
function validateAndSetTokens(loginResponse) {
  if (
    !loginResponse ||
    typeof loginResponse !== "object"
  ) {
    return false;
  }

  const hasAccessToken =
    typeof loginResponse.access === "string" &&
    loginResponse.access.length > 0;

  const hasRefreshToken =
    typeof loginResponse.refresh === "string" &&
    loginResponse.refresh.length > 0;

  const hasUser =
    loginResponse.user &&
    typeof loginResponse.user === "object";

  if (
    !hasAccessToken ||
    !hasRefreshToken ||
    !hasUser
  ) {
    console.error(
      "Invalid login response: missing required fields"
    );

    return false;
  }

  clearAuth();

  setTokens(
    loginResponse.access,
    loginResponse.refresh
  );

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(loginResponse.user)
  );

  return true;
}


/**
 * Refresh access token.
 */
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  try {
    // Use fetch directly to avoid recursive
    // token-refresh requests.
    const response = await fetch(
      `${API_BASE_URL}/auth/token/refresh/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      clearAuth();
      return false;
    }

    const data = await response.json();

    if (!data.access) {
      clearAuth();
      return false;
    }

    setTokens(
      data.access,
      data.refresh || refreshToken
    );

    return true;
  } catch (error) {
    console.error("Token refresh failed:", error);

    clearAuth();

    return false;
  }
}


/**
 * Register user.
 */
export async function register(userData) {
  const response = await fetch(
    `${API_BASE_URL}/auth/register/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      errorData.detail ||
      JSON.stringify(errorData) ||
      `Registration failed: ${response.status}`
    );
  }

  return response.json();
}


/**
 * Login user.
 */
export async function login(
  usernameOrEmail,
  password
) {
  // Do not attach an old access token
  // when performing a new login.
  const response = await fetch(
    `${API_BASE_URL}/auth/login/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username_or_email: usernameOrEmail,
        password,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      errorData.detail ||
      JSON.stringify(errorData) ||
      `Login failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (!validateAndSetTokens(data)) {
    throw new Error(
      "Invalid login response from server"
    );
  }

  return data;
}


/**
 * Get current authenticated user.
 */
export async function getCurrentUser() {
  try {
    return await apiRequest("/auth/me/", {
      method: "GET",
    });
  } catch (error) {
    clearAuth();
    throw error;
  }
}


/**
 * Logout user.
 */
export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await apiRequest("/auth/logout/", {
        method: "POST",
        body: JSON.stringify({
          refresh: refreshToken,
        }),

        // Do not refresh tokens during logout.
        skipRefresh: true,
      });
    }
  } catch (error) {
    console.error(
      "Logout request failed:",
      error
    );
  } finally {
    // Always remove tokens locally.
    clearAuth();
  }
}


/**
 * Change password.
 */
export async function changePassword(
  oldPassword,
  newPassword,
  newPasswordConfirm
) {
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
 * Check authentication state.
 */
export function isAuthenticated() {
  return !!getAccessToken();
}


/**
 * Get cached user.
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
 * Update cached user.
 */
export function setCachedUser(user) {
  if (user) {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );
  }
}


/**
 * Get login redirect path.
 */
export function getLoginRedirectPath() {
  const user = getCachedUser();

  return user?.role === "admin"
    ? "/admin/login"
    : "/login";
}


/**
 * Get stored tokens.
 */
export function getTokens() {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
  };
}


/**
 * Default authentication service.
 */
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
