
const API_URL = "/api/auth";

function getCsrfToken() {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="));

  return cookie
    ? decodeURIComponent(cookie.split("=")[1])
    : "";
}

async function apiRequest(path, options = {}) {
  // Obtain the CSRF cookie before modifying data
  if (options.method && options.method !== "GET") {
    await fetch(`${API_URL}/csrf/`, {
      credentials: "include",
    });
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.errors?.join(", ") ||
      "Une erreur est survenue."
    );
  }

  return data;
}

export const authService = {
  register: (userData) =>
    apiRequest("/register/", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  login: (username, password) =>
    apiRequest("/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    apiRequest("/logout/", {
      method: "POST",
    }),

  me: () => apiRequest("/me/"),
};
