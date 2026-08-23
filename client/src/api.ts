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

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function register(
  email: string,
  name: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/register", {
    method: "POST",
    body: JSON.stringify({ email, name, password }),
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
