const API_BASE = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"}/api/admin`;
const ADMIN_TOKEN_KEY = "seotda_admin_token";

export function saveAdminToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export interface AdminUser {
  id: string;
  username: string;
  chips: number;
  createdAt: string;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "요청에 실패했습니다.");
  return data;
}

export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "로그인에 실패했습니다.");
  return data.token as string;
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const data = await authedFetch("/users");
  return data.users;
}

export async function createUser(username: string, password: string, chips?: number): Promise<AdminUser> {
  const data = await authedFetch("/users", {
    method: "POST",
    body: JSON.stringify({ username, password, chips }),
  });
  return data.user;
}

export async function updateUserChips(id: string, chips: number): Promise<AdminUser> {
  const data = await authedFetch(`/users/${id}/chips`, {
    method: "PATCH",
    body: JSON.stringify({ chips }),
  });
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  await authedFetch(`/users/${id}`, { method: "DELETE" });
}

export async function resetPassword(id: string, password: string): Promise<AdminUser> {
  const data = await authedFetch(`/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
  return data.user;
}
