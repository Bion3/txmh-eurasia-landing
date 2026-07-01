export class ApiClientError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function request(path, options = {}) {
  const { method = "GET", body, headers, signal } = options;
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : { success: response.ok, data: null };

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      payload?.message || `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return payload;
}

export const http = {
  get(path, signal) {
    return request(path, { method: "GET", signal });
  },
  post(path, body, signal) {
    return request(path, { method: "POST", body, signal });
  },
  patch(path, body, signal) {
    return request(path, { method: "PATCH", body, signal });
  },
};
