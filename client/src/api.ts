import type {
  NewTripPlan,
  PackingPlan,
  Place,
  StopPhoto,
  Trip,
  TripPlan,
} from "./travel-types";
import type { OutfitPlan } from "../../shared/outfit-types";
import type {
  AssistantClientAction,
  ChatMessage,
  Credentials,
  Profile,
  ProfileField,
  ProfileUpdate,
  RecognizeResponse,
  Scenario,
  TripGenerationEstimate,
  TripWeather,
  User,
  WardrobeItem,
  Weather,
} from "./api-types";
export type * from "./travel-types";
export type * from "../../shared/outfit-types";
export type * from "./api-types";

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
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Error(
      `请求失败：无法连接 SmartPack 服务。${detail}（请求：${path}）。请确认后端已启动。`
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

/** The questionnaire catalog. Unauthenticated: needed during sign-up step 2. */
export function profileOptions(): Promise<{ fields: ProfileField[] }> {
  return request<{ fields: ProfileField[] }>("/api/profile-options");
}

export function analyzePersonalColor(image: string): Promise<{ analysis: string; season: string | null }> {
  return request<{ analysis: string; season: string | null }>("/api/personal-color/analyze", {
    method: "POST",
    body: JSON.stringify({ image }),
  });
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

export function scenarios(): Promise<{ scenarios: Scenario[] }> {
  return request<{ scenarios: Scenario[] }>("/api/scenarios");
}

export function me(): Promise<{ user: User }> {
  return request<{ user: User }>("/api/me");
}

export function updateProfile(profile: ProfileUpdate): Promise<{ user: User }> {
  return request<{ user: User }>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/logout", { method: "POST" });
}

// ---- 衣柜:拍照识别 + 电商搜同款 ----

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

/** Without coordinates the server answers for its default city. */
export function weather(lat?: number, lon?: number): Promise<Weather> {
  const query =
    lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
  return request<Weather>(`/api/weather${query}`);
}

export function getTripWeather(id: string): Promise<TripWeather> {
  return request<TripWeather>(
    `/api/trip-plans/${encodeURIComponent(id)}/weather`
  );
}

export function chat(messages: ChatMessage[]): Promise<{ reply: string; actions?: AssistantClientAction[] }> {
  return request<{ reply: string; actions?: AssistantClientAction[] }>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

// ---- 行程规划(左侧总行程图 + 右侧每天行程)----

/** 已由分析 Agent 生成并持久化的行程列表。 */
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
/** balance: 0 = pack lightest, 100 = most outfit variety (US 6.3). */
export function getPackingPlan(
  balance: number,
  tripPlanId: string
): Promise<{ plan: PackingPlan }> {
  return request<{ plan: PackingPlan }>(
    `/api/packing?balance=${encodeURIComponent(balance)}&tripPlanId=${encodeURIComponent(tripPlanId)}`
  );
}

// ---- 行程计划(目的地 + 日期区间)----
// 地点搜索走后端代理 /api/places(AGENTS.md §3):第三方地理编码服务只在
// 服务端对接,未来 iOS 端调同一个接口。

export function searchPlaces(
  query: string,
  lang: "en" | "zh"
): Promise<{ places: Place[] }> {
  return request<{ places: Place[] }>(
    `/api/places?q=${encodeURIComponent(query)}&lang=${lang}`
  );
}

/** Queue the analytical agent; generation continues on the server. */
export function generateTripPlan(
  plan: NewTripPlan,
  replaceFailedPlanId?: string
): Promise<{ plan: TripPlan; estimate: TripGenerationEstimate }> {
  return request<{ plan: TripPlan; estimate: TripGenerationEstimate }>(
    "/api/trip-plans/generate",
    {
      method: "POST",
      body: JSON.stringify({ ...plan, replaceFailedPlanId }),
    }
  );
}

/** Poll one queued plan without reloading the full dashboard. */
export function getTripPlan(
  id: string
): Promise<{ plan: TripPlan; estimate: TripGenerationEstimate }> {
  return request<{ plan: TripPlan; estimate: TripGenerationEstimate }>(
    `/api/trip-plans/${encodeURIComponent(id)}`
  );
}

export function listTripPlans(): Promise<{ plans: TripPlan[] }> {
  return request<{ plans: TripPlan[] }>("/api/trip-plans");
}

export function deleteTripPlan(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/trip-plans/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// ---- 今日 / 行程穿搭 ----

export function getOutfitPlan(
  tripPlanId?: string
): Promise<{ plan: OutfitPlan }> {
  const query = tripPlanId
    ? `?tripPlanId=${encodeURIComponent(tripPlanId)}`
    : "";
  return request<{ plan: OutfitPlan }>(`/api/outfit-plan${query}`);
}
