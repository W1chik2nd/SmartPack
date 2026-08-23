// 衣物图像识别 — 走 OpenAI 兼容的多模态接口。
//
// 默认指向阿里云百炼(DashScope compatible-mode)+ qwen-vl-plus:
// 国内可直接开通、按量计费便宜、服装识别准确率够用。
// 想换 OpenAI:VISION_BASE_URL=https://api.openai.com/v1  VISION_MODEL=gpt-4o-mini

export type RecognizedItem = {
  /** 卡片大标题:颜色+版型+具体款式,如“黄色宽松工装外套”。 */
  title: string;
  category: string; // 例:"外套"
  /** 具体款式,如 工装裤/阔腿裤/紧身牛仔裤/飞行夹克/卫衣。 */
  subtype: string;
  colors: string[]; // 例:["黄色"]
  /** 版型,如 紧身/修身/合身/宽松/oversize/直筒/阔腿/锥形。 */
  fit: string;
  /** 材质,如 棉/羊毛/牛仔/针织/工装布。 */
  material: string;
  /** 适宜季节,如 ["春","秋"]。 */
  seasons: string[];
  styleTags: string[]; // 例:["正式","通勤"]
  /** 详细描述:结构、口袋、领型、版型细节等,供 AI 搭配分析。 */
  details: string;
};

// 细节字段不是为了展示,而是喂给后续的穿搭/打包推荐(README 的核心功能)。
// 之前 details 太笼统("宽松设计,适合日常"),对搭配没参考价值,
// 所以这版要求给出具体款式名和可观察的结构特征。
const PROMPT = `你是资深服装买手,擅长精准描述服装款式。识别图片里的主要衣物单品,只输出一个 JSON 对象,不要任何其他文字或代码块标记。

如果图片里没有衣物、鞋履或服饰配件(例如是水杯、食物、家具、宠物、风景、人脸特写等),只输出:
{"notClothing":true,"reason":"一句话说明图里是什么"}

是衣物时输出:
{"title":"颜色+版型+具体款式,如 黑色宽松工装裤 / 蓝色紧身牛仔裤","category":"大类(T恤/衬衫/针织衫/卫衣/外套/裤装/裙装/鞋履/配饰 之一)","subtype":"你判断出的具体款式名","colors":["主色在前,最多3个"],"fit":"版型","material":"材质,按厚薄和垂坠感判断","seasons":["春/夏/秋/冬"],"styleTags":["风格,如 正式/通勤/休闲/运动/街头/复古"],"details":"2-3句详细描述"}

要求:
1. subtype 用你自己判断的准确款式名,越具体越好(如 工装裤、阔腿牛仔裤、飞行夹克、连帽卫衣、切尔西靴)。不要只写大类,也不要拘泥于固定选项,按你看到的款式如实命名。
2. fit 用精确的版型词,如 紧身/修身/合身/宽松/oversize/直筒/阔腿/锥形/A字。
3. details 必须包含可观察到的结构特征,例如:口袋数量和位置(侧贴袋/工装大口袋/斜插袋)、腰头形式(松紧/抽绳/纽扣)、裤脚或袖口(束口/开口/翻边)、领型(圆领/翻领/连帽/立领)、袖长、闭合方式(拉链/纽扣/套头)、图案或印花位置、面料厚薄与垂坠感。写你真正看到的,不要套话。
4. 不要输出"适合日常穿着""百搭"这类没有信息量的话。
5. 每个字段都要给出判断,不要填"未知"。实在看不清的字段按最可能的情况推测。`;

export function visionConfigured(): boolean {
  return Boolean(process.env.VISION_API_KEY);
}

export async function recognizeClothing(
  imageDataUrl: string
): Promise<RecognizedItem> {
  const baseUrl =
    process.env.VISION_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.VISION_MODEL ?? "qwen-vl-plus";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VISION_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`vision api ${res.status}: ${detail.slice(0, 200)}`);
  }

  // 信任边界(AGENTS.md §4/§5):模型响应是外部数据,做结构校验后再用。
  const body = (await res.json()) as any;
  const text: unknown = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("vision api: empty response");

  const cleaned = text.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`vision api: non-JSON response: ${cleaned.slice(0, 120)}`);
  }
  // 模型明确判定不是衣物(水杯、食物、宠物等):抛错,不入库。
  if (parsed?.notClothing === true) {
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    throw new NotClothingError(reason || "图片里没有识别到衣物");
  }
  if (typeof parsed?.category !== "string" || typeof parsed?.title !== "string") {
    throw new Error("vision api: missing title/category");
  }

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const item: RecognizedItem = {
    title: parsed.title,
    category: parsed.category,
    subtype: str(parsed.subtype),
    colors: strings(parsed.colors),
    fit: str(parsed.fit),
    material: str(parsed.material),
    seasons: strings(parsed.seasons),
    styleTags: strings(parsed.styleTags),
    details: str(parsed.details),
  };

  // 兜底:模型没走 notClothing 分支,但关键字段全是“未知”/空,
  // 说明它其实没认出衣物(拍到水杯时就会这样)。这种也不该入库。
  if (looksUnrecognized(item)) {
    throw new NotClothingError("无法识别出衣物,请对准单件衣物重拍");
  }
  return item;
}

/** 图片不是衣物 / 认不出衣物。调用方据此拒绝入库并提示重拍。 */
export class NotClothingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotClothingError";
  }
}

const UNKNOWN_RE = /^(未知|无|不确定|不明|无法识别|unknown|n\/a|-|)$/i;

/** 关键字段基本都是“未知”时,视为没认出来。 */
function looksUnrecognized(item: RecognizedItem): boolean {
  const key = [item.title, item.category, item.subtype, item.fit, item.material];
  const unknownCount = key.filter((v) => UNKNOWN_RE.test(v.trim())).length;
  // 五个关键字段里有三个以上是未知/空,就认为识别失败。
  return unknownCount >= 3 || UNKNOWN_RE.test(item.title.trim());
}

/** 用识别结果拼电商搜索关键词:颜色 + 标题,去重。 */
export function searchKeyword(item: RecognizedItem): string {
  const color = item.colors[0] ?? "";
  return item.title.includes(color) ? item.title : `${color}${item.title}`;
}
