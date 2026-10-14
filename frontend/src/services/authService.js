
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
 * - Profile updates
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
 * Format API errors.
 */
function getErrorMessage(data, fallback) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  const messages = Object.entries(data).flatMap(
    ([field, errors]) => {
      const values = Array.isArray(errors)
        ? errors
        : [errors];

      return values.map((error) => {
        const message =
          typeof error === "string"
            ? error
            : JSON.stringify(error);

        return `${field}: ${message}`;
      });
    }
  );

  return messages.length
    ? messages.join(" | ")
    : fallback;
}

/**
 * Generic authenticated API request.
 */
async function apiRequest(endpoint, options = {}) {
  const { skipRefresh = false, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...fetchOptions.headers,
  };

  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  /**
   * Refresh the access token when it expires.
   */
  if (
    response.status === 401 &&
    token &&
    !skipRefresh
  ) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiRequest(endpoint, {
        ...fetchOptions,
        skipRefresh: true,
      });
    }

    clearAuth();

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  /**
   * Handle API errors.
   */
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      getErrorMessage(
        errorData,
        `API error: ${response.status}`
      )
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

  setCachedUser(loginResponse.user);

  return true;
}

/**
 * Refresh expired JWT access token.
 */
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  try {
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
 * Register a new user.
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
      getErrorMessage(
        errorData,
        `Registration failed: ${response.status}`
      )
    );
  }

  return response.json();
}

/**
 * Login and store JWT tokens.
 */
export async function login(
  usernameOrEmail,
  password
) {
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
      getErrorMessage(
        errorData,
        `Login failed: ${response.status}`
      )
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
 * Get the currently authenticated user.
 *
 * GET /api/auth/me/
 */
export async function getCurrentUser() {
  try {
    const user = await apiRequest("/auth/me/", {
      method: "GET",
    });

    setCachedUser(user);

    return user;
  } catch (error) {
    // Preserve authentication data for temporary
    // server errors. Clear only expired sessions.
    if (error.message.includes("Session expired")) {
      clearAuth();
    }

    throw error;
  }
}

/**
 * Update authenticated user's profile.
 *
 * PATCH /api/auth/me/
 *
 * The backend must support PATCH on this endpoint.
 */
export async function updateProfile(profileData) {
  const allowedFields = [
    "first_name",
    "last_name",
    "username",
    "email",
  ];

  const payload = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(
      profileData,
      field
    )) {
      payload[field] = profileData[field];
    }
  }

  const updatedUser = await apiRequest(
    "/auth/me/",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  // Keep localStorage synchronized with Django.
  setCachedUser(updatedUser);

  return updatedUser;
}

/**
 * Logout and blacklist refresh token.
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

        // Never refresh JWT during logout.
        skipRefresh: true,
      });
    }
  } catch (error) {
    console.error(
      "Logout request failed:",
      error
    );
  } finally {
    clearAuth();
  }
}

/**
 * Change authenticated user's password.
 */
export async function changePassword(
  oldPassword,
  newPassword,
  newPasswordConfirm
) {
  return apiRequest(
    "/auth/change-password/",
    {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      }),
    }
  );
}

/**
 * Check whether an access token exists.
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
    return userJson
      ? JSON.parse(userJson)
      : null;
  } catch {
    return null;
  }
}

/**
 * Save updated user information.
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
 * Get stored JWT tokens.
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
  updateProfile,
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
