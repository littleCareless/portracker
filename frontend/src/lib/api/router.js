/**
 * Router API Client
 * Frontend API methods for router configuration and port forwarding management
 */

const API_BASE = "/api/router";

// Helper function to handle fetch errors
async function handleResponse(res) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Get all router configurations
 */
export async function getRouterConfigs() {
  const res = await fetch(`${API_BASE}/config`, {
    credentials: "include",
  });
  const data = await handleResponse(res);
  return data.routers || [];
}

/**
 * Get a single router configuration
 */
export async function getRouterConfig(id) {
  const res = await fetch(`${API_BASE}/config/${id}`, {
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Test router connection
 */
export async function testRouterConnection({ routerUrl, port, username, password }) {
  const res = await fetch(`${API_BASE}/config/test`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routerUrl, port, username, password }),
  });
  return handleResponse(res);
}

/**
 * Add a new router configuration
 */
export async function addRouterConfig({ name, routerUrl, port, authType, username, password }) {
  const res = await fetch(`${API_BASE}/config`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, routerUrl, port, authType, username, password }),
  });
  return handleResponse(res);
}

/**
 * Update a router configuration
 */
export async function updateRouterConfig(id, updates) {
  const res = await fetch(`${API_BASE}/config/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

/**
 * Delete a router configuration
 */
export async function deleteRouterConfig(id) {
  const res = await fetch(`${API_BASE}/config/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Get port forwardings for a router
 */
export async function getPortForwardings(routerId, options = {}) {
  const params = new URLSearchParams();
  if (options.fetchFromRouter) params.append('fetch', 'true');
  
  const url = `${API_BASE}/config/${routerId}/forwardings${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, {
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Add a port forwarding rule
 */
export async function addPortForwarding(routerId, config) {
  const res = await fetch(`${API_BASE}/config/${routerId}/forwardings`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return handleResponse(res);
}

/**
 * Update a port forwarding rule
 */
export async function updatePortForwarding(id, updates) {
  const res = await fetch(`${API_BASE}/forwardings/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

/**
 * Delete a port forwarding rule
 */
export async function deletePortForwarding(id) {
  const res = await fetch(`${API_BASE}/forwardings/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Sync port forwardings to router
 */
export async function syncRouter(routerId) {
  const res = await fetch(`${API_BASE}/config/${routerId}/sync`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

/**
 * Batch operation on port forwardings
 */
export async function batchPortForwardingOperation(routerId, operation, forwardingIds) {
  const res = await fetch(`${API_BASE}/batch`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routerId, operation, forwardingIds }),
  });
  return handleResponse(res);
}

/**
 * Enable a port forwarding rule
 */
export async function enablePortForwarding(id) {
  return updatePortForwarding(id, { enabled: true });
}

/**
 * Disable a port forwarding rule
 */
export async function disablePortForwarding(id) {
  return updatePortForwarding(id, { enabled: false });
}

/**
 * Import port forwardings from router to local database
 */
export async function importRouterForwardings(routerId) {
  const res = await fetch(`${API_BASE}/config/${routerId}/import-forwardings`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(res);
}
