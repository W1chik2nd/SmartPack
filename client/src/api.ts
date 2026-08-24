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

// ---- 行程规划(左侧总行程图 + 右侧每天行程)----

/** 停靠点类型:景点 / 交通 / 餐饮 / 住宿。 */
export type StopKind = "spot" | "transit" | "meal" | "hotel";

export type TripStop = {
  id: string;
  position: number;
  kind: StopKind;
  name: string;
  nameEn: string;
  startTime: string;
  duration: string;
  note: string;
  noteEn: string;
  photoQuery: string;
  /** 后端已解析过的配图;null 表示还要去 /api/itinerary/photo 补。 */
  photoUrl: string | null;
  photoCredit: string | null;
  photoSourceUrl: string | null;
};

export type TripDay = {
  id: string;
  dayNumber: number;
  /** 手绘稿里的 "x.xx"。 */
  dateLabel: string;
  city: string;
  cityEn: string;
  summary: string;
  summaryEn: string;
  stops: TripStop[];
};

export type Trip = {
  id: string;
  title: string;
  titleEn: string;
  scenario: string;
  departLabel: string;
  createdAt: string;
  days: TripDay[];
};

export type StopPhoto = {
  imageUrl: string;
  credit: string;
  sourceUrl: string;
};

/** 行程列表。UI 阶段后端会在空列表时自动补一份演示行程。 */
export function itineraryTrips(
  scenario?: string
): Promise<{ trips: Trip[]; photoProvider: string }> {
  const query = scenario ? `?scenario=${encodeURIComponent(scenario)}` : "";
  return request<{ trips: Trip[]; photoProvider: string }>(
    `/api/itinerary/trips${query}`
  );
}

export function itineraryTrip(
  id: string
): Promise<{ trip: Trip; photoProvider: string }> {
  return request<{ trip: Trip; photoProvider: string }>(
    `/api/itinerary/trips/${encodeURIComponent(id)}`
  );
}

/** 补一张景点配图。查不到时 photo 为 null,卡片显示占位块。 */
export function stopPhoto(
  stopId: string
): Promise<{ photo: StopPhoto | null }> {
  return request<{ photo: StopPhoto | null }>(
    `/api/itinerary/photo/${encodeURIComponent(stopId)}`
  );
}

// Packing plan — shapes mirror server/packing.ts. The server owns all the
// packing logic (AGENTS.md §3); the client only renders these and sends the
// slider value back.
export type PackingItem = { id: string; label: string; reuse: number };
export type PackingCategory = { id: string; title: string; items: PackingItem[] };
export type EssentialItem = { id: string; label: string };
export type CorePiece = { id: string; label: string; reuse: number };

export type PackingPlan = {
  balance: number;
  tripDays: number;
  summary: string;
  categories: PackingCategory[];
  essentials: EssentialItem[];
  corePieces: CorePiece[];
};

/** balance: 0 = pack lightest, 100 = most outfit variety (US 6.3). */
export function getPackingPlan(balance: number): Promise<{ plan: PackingPlan }> {
  return request<{ plan: PackingPlan }>(
    `/api/packing?balance=${encodeURIComponent(balance)}`
  );
}
