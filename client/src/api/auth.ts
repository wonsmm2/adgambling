import type { AuthUser } from "../types";

const API_BASE = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000"}/api`;

interface AuthResponse {
  token: string;
  user: AuthUser;
}

async function handle(res: Response): Promise<AuthResponse> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "요청에 실패했습니다.");
  return data as AuthResponse;
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handle(res);
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "인증에 실패했습니다.");
  return data.user as AuthUser;
}

const TOKEN_KEY = "seotda_token";

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
