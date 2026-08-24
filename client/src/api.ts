import type {
  NewTripPlan,
  PackingPlan,
  Place,
  StopPhoto,
  Trip,
  TripPlan,
} from "./travel-types";
export type * from "./travel-types";

export type User = {
  id: string;
  email: string;
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  style: string | null;
  gender: string | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  bodyType: string | null;
  seasonColorType: string | null;
  stylePrefs: string[];
  wearFeel: string[];
  wearFeelOther: string | null;
  travelHabits: string[];
  travelHabitsOther: string | null;
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

/** Step-1 credentials, held in memory until the questionnaire completes. */
export type Credentials = {
  email: string;
  password: string;
};

/**
 * The profile questionnaire payload. Keyed by the field keys the server
 * publishes via /api/profile-options rather than typed field by field: the
 * form is built from that catalog, so a new question needs no client change.
 * Only name/gender/age/heightCm/weightKg are required — the server enforces that.
 */
export type Profile = Record<string, string | number | string[]>;
export type ProfileUpdate = Profile;

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
  /** Present when this field offers a free-text "other" choice. */
  otherId?: string;
  /** The payload key the free text is sent under. */
  otherKey?: string;
  otherMax?: number;
};

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

export type AssistantPage =
  | "home"
  | "trips"
  | "tripSetup"
  | "itinerary"
  | "wardrobe"
  | "profile"
  | "packing";
export type AssistantClientAction =
  | { type: "navigate"; page: AssistantPage; scenario?: string }
  | { type: "profileUpdated"; user: User }
  | { type: "wardrobeChanged" }
  | { type: "tripCreated" }
  | { type: "packingChanged"; balance?: number; checked?: string[]; unchecked?: string[] };

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

export function saveTripPlan(plan: NewTripPlan): Promise<{ plan: TripPlan }> {
  return request<{ plan: TripPlan }>("/api/trip-plans", {
    method: "POST",
    body: JSON.stringify(plan),
  });
}

/** Queue the analytical agent; generation continues on the server. */
export type TripGenerationEstimate = {
  minSeconds: number;
  maxSeconds: number;
};

export function generateTripPlan(
  plan: NewTripPlan
): Promise<{ plan: TripPlan; estimate: TripGenerationEstimate }> {
  return request<{ plan: TripPlan; estimate: TripGenerationEstimate }>(
    "/api/trip-plans/generate",
    {
      method: "POST",
      body: JSON.stringify(plan),
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

export type OutfitPieceKind = "top" | "bottom" | "shoes" | "accessory";
export type OutfitTone = "red" | "yellow" | "blue" | "black" | "white";
export type AccessoryStyle = "bag" | "hat" | "glasses" | "scarf" | "watch" | "necklace";
export type GarmentStyle = "tee" | "shirt" | "knit" | "trousers" | "skirt" | "jeans" | "loafers" | "sneakers";

export type OutfitPiece = {
  id: string;
  kind: OutfitPieceKind;
  label: string;
  labelEn: string;
  tone: OutfitTone;
  garmentStyle: GarmentStyle | null;
  accessoryStyle: AccessoryStyle | null;
  wardrobeItemId: string | null;
  hasPhoto: boolean;
};

export type OutfitDay = {
  id: string;
  dayNumber: number;
  date: string;
  place: string;
  scene: string;
  pieces: OutfitPiece[];
};

export type OutfitPlan = {
  destination: string;
  destinationDetail: string;
  scenario: string;
  startDate: string;
  endDate: string;
  lat: number;
  lon: number;
  usesWardrobe: boolean;
  days: OutfitDay[];
};

export function getOutfitPlan(): Promise<{ plan: OutfitPlan }> {
  return request<{ plan: OutfitPlan }>("/api/outfit-plan");
}
