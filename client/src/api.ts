export type User = {
  id: string;
  email: string;
  name: string;
};

type AuthResponse = { token: string; user: User };

const TOKEN_KEY = "smartpack_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // A dead backend surfaces as a fetch TypeError ("Failed to fetch"), which
  // reads like a validation bug. Name the real problem instead.
  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new Error(
      "Cannot reach the SmartPack server. Is it running? Start everything with: npm run dev"
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

/** Step-1 credentials, held in memory until the questionnaire completes. */
export type Credentials = {
  email: string;
  password: string;
};

/** The style questionnaire — registration is only accepted with all of it. */
export type Profile = {
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  style: string;
};

export function checkEmail(email: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/check-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function register(
  credentials: Credentials,
  profile: Profile
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/register", {
    method: "POST",
    body: JSON.stringify({ ...credentials, ...profile }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>("/api/me");
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/logout", { method: "POST" });
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function chat(messages: ChatMessage[]): Promise<{ reply: string }> {
  return request<{ reply: string }>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
