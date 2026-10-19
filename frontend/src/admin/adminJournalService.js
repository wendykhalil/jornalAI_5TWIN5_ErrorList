
import authService from "../services/authService";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

const JOURNAL_URL = `${API_BASE_URL}/admin/journal/`;

/**
 * Make authenticated requests to Django.
 * Uses the same JWT authentication as the normal app.
 */
async function request(
  endpoint = "",
  options = {},
  retry = true
) {
  const { accessToken } = authService.getTokens();

  if (!accessToken) {
    throw new Error(
      "No Django JWT token found. Please sign in using your Django admin account."
    );
  }

  const response = await fetch(
    `${JOURNAL_URL}${endpoint}`,
    {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // Refresh an expired access token once.
  if (response.status === 401 && retry) {
    const refreshed =
      await authService.refreshAccessToken();

    if (refreshed) {
      return request(endpoint, options, false);
    }

    throw new Error(
      "Your Django session has expired. Please log in again."
    );
  }

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      data.detail ||
      data.error ||
      `Django API error: ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const adminJournalService = {
  getStats() {
    return request("stats/");
  },

  getEntries(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();

    return request(
      queryString ? `?${queryString}` : ""
    );
  },

  getEntry(id) {
    return request(
      `${encodeURIComponent(id)}/`
    );
  },

  deleteEntry(id) {
    return request(
      `${encodeURIComponent(id)}/`,
      { method: "DELETE" }
    );
  },
};

export default adminJournalService;
