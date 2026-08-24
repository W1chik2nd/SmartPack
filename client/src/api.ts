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

/**
 * The profile questionnaire payload. Keyed by the field keys the server
 * publishes via /api/profile-options rather than typed field by field: the
 * form is built from that catalog, so a new question needs no client change.
 * Only name/age/heightCm/weightKg are required — the server enforces that.
 */
export type Profile = Record<string, string | number | string[]>;

/** One selectable answer. `id` is stored; the labels are display-only. */
export type ProfileOption = {
  id: string;
  en: string;
  zh: string;
};

export type ProfileField = {
  key: string;
  kind: "text" | "int" | "decimal" | "single" | "multi";
  required: boolean;
  min?: number;
  max?: number;
  options?: ProfileOption[];
};

/** The questionnaire catalog. Unauthenticated: needed during sign-up step 2. */
export function profileOptions(): Promise<{ fields: ProfileField[] }> {
  return request<{ fields: ProfileField[] }>("/api/profile-options");
}

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

export type Scenario = {
  id: string;
  label: string;
  image: string;
};

export function scenarios(): Promise<{ scenarios: Scenario[] }> {
  return request<{ scenarios: Scenario[] }>("/api/scenarios");
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>("/api/me");
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/logout", { method: "POST" });
}

// ---- 衣柜:拍照识别 + 电商搜同款 ----

/** 落库后的衣柜单品。细节字段供后续穿搭推荐分析。 */
export type WardrobeItem = {
  id: string;
  title: string; // 大标题,如“黄色宽松工装裤”
  category: string;
  subtype: string; // 具体款式,如“工装裤”
  count: number;
  colors: string[];
  fit: string;
  material: string;
  seasons: string[];
  styleTags: string[];
  details: string;
  hasPhoto: boolean;
  createdAt: string;
};

export type Product = {
  title: string;
  imageUrl: string;
  price: string;
  url: string;
};

export type RecognizeResponse = {
  item: WardrobeItem;
  provider: "jd" | "taobao" | null;
  products: Product[];
  productsError?: string;
};

export function recognizeClothing(
  imageDataUrl: string
): Promise<RecognizeResponse> {
  return request<RecognizeResponse>("/api/wardrobe/recognize", {
    method: "POST",
    body: JSON.stringify({ image: imageDataUrl }),
  });
}

export function listWardrobeItems(): Promise<{ items: WardrobeItem[] }> {
  return request<{ items: WardrobeItem[] }>("/api/wardrobe/items");
}

export function deleteWardrobeItem(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/wardrobe/items/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

/** 照片地址。带 token 查询参数,因为 <img> 标签发不出 Authorization 头。 */
export function wardrobePhotoUrl(id: string): string {
  return `/api/wardrobe/photo/${encodeURIComponent(id)}?token=${encodeURIComponent(
    getToken() ?? ""
  )}`;
}

// ---- 扫码上传:手机拍照 → 电脑接收 ----

/** 电脑端创建上传会话,拿到编进二维码的一次性 token。 */
export function createUploadSession(): Promise<{ uploadToken: string }> {
  return request<{ uploadToken: string }>("/api/upload-session", {
    method: "POST",
  });
}

/** 手机端上传照片。不需要登录态,token 即凭证。 */
export function uploadSessionPhoto(
  uploadToken: string,
  imageDataUrl: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/upload-session/photo", {
    method: "POST",
    body: JSON.stringify({ uploadToken, image: imageDataUrl }),
  });
}

/** 电脑端轮询取照片;image 为 null 表示手机还没传。 */
export function fetchUploadedPhoto(
  uploadToken: string
): Promise<{ image: string | null }> {
  return request<{ image: string | null }>(
    `/api/upload-session/photo?uploadToken=${encodeURIComponent(uploadToken)}`
  );
}

/** 关闭二维码弹窗时结束会话。 */
export function endUploadSession(uploadToken: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/upload-session?uploadToken=${encodeURIComponent(uploadToken)}`,
    { method: "DELETE" }
  );
}

// ---- 天气 / AI 助手 ----

export type Weather = {
  tempC: number;
  condition: string;
};

/** Without coordinates the server answers for its default city. */
export function weather(lat?: number, lon?: number): Promise<Weather> {
  const query =
    lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
  return request<Weather>(`/api/weather${query}`);
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
