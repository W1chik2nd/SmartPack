// Populate one development account with varied clothing so Trip Agent output
// can be inspected locally. This is intentionally an explicit script rather
// than app-start seeding: it never modifies a user's wardrobe unexpectedly.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWardrobeStore } from "./wardrobe.ts";

const root = dirname(fileURLToPath(import.meta.url));
const dbPath = join(root, "data", "smartpack.db");
const email = process.argv[2] ?? "test@example.com";

if (!existsSync(dbPath)) {
  throw new Error(`Database not found: ${dbPath}`);
}

const db = new DatabaseSync(dbPath);
const user = db
  .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
  .get(email) as { id: string } | undefined;
if (!user) throw new Error(`No user found for ${email}`);

const wardrobe = createWardrobeStore(db, join(root, "data", "photos"));
const existingTitles = new Set(wardrobe.list(user.id).map((item) => item.title));
type SeedItem = [
  title: string,
  category: string,
  subtype: string,
  colors: string[],
  fit: string,
  material: string,
  seasons: string[],
  styleTags: string[],
  details: string,
];

const items: SeedItem[] = [
  ["雾蓝轻薄衬衫", "上衣", "衬衫", ["蓝色"], "修身", "棉麻", ["春", "夏"], ["通勤", "简约"], "长袖, 可卷袖口"],
  ["白色纯棉T恤", "上衣", "T恤", ["白色"], "宽松", "棉", ["春", "夏"], ["休闲", "基础"], "圆领, 短袖"],
  ["黑色针织上衣", "上衣", "针织衫", ["黑色"], "标准", "羊毛混纺", ["秋", "冬"], ["简约", "保暖"], "细针织, 长袖"],
  ["奶油色针织开衫", "上衣", "针织衫", ["米色"], "宽松", "羊绒混纺", ["秋", "冬"], ["柔和", "层次"], "开襟, 轻暖"],
  ["砖红色短袖衬衫", "上衣", "衬衫", ["红色"], "宽松", "亚麻", ["夏"], ["度假", "色彩"], "古巴领, 短袖"],
  ["藏蓝轻薄夹克", "上衣", "夹克", ["蓝色"], "标准", "尼龙", ["春", "秋"], ["机能", "防风"], "防风面料, 拉链"],
  ["黄色连帽卫衣", "上衣", "卫衣", ["黄色"], "宽松", "棉", ["秋", "冬"], ["休闲", "明亮"], "连帽, 长袖"],
  ["灰色速干运动上衣", "上衣", "运动上衣", ["灰色"], "标准", "速干聚酯", ["春", "夏", "秋"], ["运动", "轻量"], "透气, 速干"],
  ["黑色直筒西裤", "下装", "长裤", ["黑色"], "标准", "羊毛混纺", ["春", "秋", "冬"], ["商务", "通勤"], "直筒, 有褶"],
  ["卡其色工装裤", "下装", "工装裤", ["卡其色"], "宽松", "棉斜纹", ["春", "秋"], ["休闲", "户外"], "多口袋, 耐磨"],
  ["蓝色直筒牛仔裤", "下装", "牛仔裤", ["蓝色"], "标准", "丹宁", ["春", "秋", "冬"], ["休闲", "基础"], "直筒, 中腰"],
  ["白色阔腿裤", "下装", "长裤", ["白色"], "宽松", "棉麻", ["春", "夏"], ["度假", "清爽"], "阔腿, 高腰"],
  ["橄榄绿户外长裤", "下装", "长裤", ["绿色"], "标准", "尼龙弹力", ["春", "秋"], ["户外", "机能"], "弹力, 防泼水"],
  ["棕色灯芯绒长裤", "下装", "长裤", ["棕色"], "标准", "灯芯绒", ["秋", "冬"], ["复古", "温暖"], "直筒, 厚实"],
  ["深灰运动短裤", "下装", "短裤", ["灰色"], "宽松", "速干聚酯", ["夏"], ["运动", "轻量"], "抽绳, 透气"],
  ["米白色A字半裙", "下装", "半裙", ["米色"], "标准", "棉", ["春", "夏"], ["柔和", "通勤"], "A字, 过膝"],
  ["黑色防水徒步鞋", "鞋履", "运动鞋", ["黑色"], "标准", "网布橡胶", ["春", "夏", "秋"], ["户外", "防水"], "防滑, 防水"],
  ["白色复古运动鞋", "鞋履", "运动鞋", ["白色"], "标准", "皮革橡胶", ["春", "夏", "秋"], ["休闲", "基础"], "低帮, 舒适"],
  ["棕色乐福鞋", "鞋履", "乐福鞋", ["棕色"], "标准", "皮革", ["春", "秋"], ["商务", "经典"], "便鞋, 软底"],
  ["黑色短靴", "鞋履", "靴子", ["黑色"], "标准", "皮革", ["秋", "冬"], ["通勤", "保暖"], "侧拉链, 防滑"],
  ["米色帆布鞋", "鞋履", "帆布鞋", ["米色"], "标准", "帆布橡胶", ["春", "夏"], ["休闲", "轻量"], "低帮, 透气"],
  ["黄色帆布托特包", "配饰", "包", ["黄色"], "大容量", "帆布", ["春", "夏", "秋"], ["休闲", "明亮"], "可肩背, 大容量"],
  ["黑色通勤托特包", "配饰", "包", ["黑色"], "大容量", "皮革", ["春", "秋", "冬"], ["商务", "通勤"], "可放电脑"],
  ["藏蓝棒球帽", "配饰", "帽子", ["蓝色"], "可调节", "棉", ["春", "夏"], ["休闲", "遮阳"], "弯檐, 可调节"],
  ["红色太阳镜", "配饰", "眼镜", ["红色"], "标准", "醋酸纤维", ["春", "夏"], ["度假", "色彩"], "偏光镜片"],
  ["灰色轻薄围巾", "配饰", "围巾", ["灰色"], "宽松", "羊毛", ["秋", "冬"], ["保暖", "简约"], "可折叠"],
  ["银色简约腕表", "配饰", "手表", ["白色"], "标准", "不锈钢", ["春", "夏", "秋", "冬"], ["商务", "简约"], "防泼水"],
  ["金色细链项链", "配饰", "项链", ["黄色"], "标准", "合金", ["春", "夏", "秋", "冬"], ["精致", "首饰"], "细链, 小吊坠"],
  ["绿色防水腰包", "配饰", "包", ["绿色"], "标准", "尼龙", ["春", "夏", "秋"], ["户外", "机能"], "防泼水, 贴身"],
  ["棕色皮带", "配饰", "腰带", ["棕色"], "标准", "皮革", ["春", "夏", "秋", "冬"], ["经典", "基础"], "金属扣"],
];

let added = 0;
for (const [title, category, subtype, colors, fit, material, seasons, styleTags, details] of items) {
  if (existingTitles.has(title)) continue;
  wardrobe.add(user.id, { title, category, subtype, colors, fit, material, seasons, styleTags, details });
  added += 1;
}
console.log(`Seeded ${added} wardrobe items for ${email}; total is ${wardrobe.list(user.id).length}.`);
