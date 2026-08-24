import type { NewItem } from "./wardrobe.ts";

/**
 * The explicit demo wardrobe used for product QA and recovery seeding.
 * Titles are unique and descriptions are intentionally varied so every
 * supported pixel silhouette, colour and material can be checked at once.
 */
export const DEMO_WARDROBE_ITEMS: NewItem[] = [
  { title: "雾蓝轻薄衬衫", category: "上衣", subtype: "衬衫", colors: ["蓝色"], fit: "修身", material: "棉麻", seasons: ["春", "夏"], styleTags: ["通勤", "简约"], details: "长袖, 可卷袖口" },
  { title: "白色纯棉T恤", category: "上衣", subtype: "T恤", colors: ["白色"], fit: "宽松", material: "棉", seasons: ["春", "夏"], styleTags: ["休闲", "基础"], details: "圆领, 短袖" },
  { title: "黑色针织上衣", category: "上衣", subtype: "针织衫", colors: ["黑色"], fit: "标准", material: "羊毛混纺", seasons: ["秋", "冬"], styleTags: ["简约", "保暖"], details: "细针织, 长袖" },
  { title: "奶油色针织开衫", category: "上衣", subtype: "针织衫", colors: ["米色"], fit: "宽松", material: "羊绒混纺", seasons: ["秋", "冬"], styleTags: ["柔和", "层次"], details: "开襟, 轻暖" },
  { title: "砖红色短袖衬衫", category: "上衣", subtype: "衬衫", colors: ["红色"], fit: "宽松", material: "亚麻", seasons: ["夏"], styleTags: ["度假", "色彩"], details: "古巴领, 短袖" },
  { title: "藏蓝轻薄夹克", category: "上衣", subtype: "夹克", colors: ["蓝色"], fit: "标准", material: "尼龙", seasons: ["春", "秋"], styleTags: ["机能", "防风"], details: "防风面料, 拉链" },
  { title: "黄色连帽卫衣", category: "上衣", subtype: "卫衣", colors: ["黄色"], fit: "宽松", material: "棉", seasons: ["秋", "冬"], styleTags: ["休闲", "明亮"], details: "连帽, 长袖" },
  { title: "灰色速干运动上衣", category: "上衣", subtype: "运动上衣", colors: ["灰色"], fit: "标准", material: "速干聚酯", seasons: ["春", "夏", "秋"], styleTags: ["运动", "轻量"], details: "透气, 速干" },
  { title: "黑色直筒西裤", category: "下装", subtype: "长裤", colors: ["黑色"], fit: "标准", material: "羊毛混纺", seasons: ["春", "秋", "冬"], styleTags: ["商务", "通勤"], details: "直筒, 有褶" },
  { title: "卡其色工装裤", category: "下装", subtype: "工装裤", colors: ["卡其色"], fit: "宽松", material: "棉斜纹", seasons: ["春", "秋"], styleTags: ["休闲", "户外"], details: "多口袋, 耐磨" },
  { title: "蓝色直筒牛仔裤", category: "下装", subtype: "牛仔裤", colors: ["蓝色"], fit: "标准", material: "丹宁", seasons: ["春", "秋", "冬"], styleTags: ["休闲", "基础"], details: "直筒, 中腰" },
  { title: "白色阔腿裤", category: "下装", subtype: "长裤", colors: ["白色"], fit: "宽松", material: "棉麻", seasons: ["春", "夏"], styleTags: ["度假", "清爽"], details: "阔腿, 高腰" },
  { title: "橄榄绿户外长裤", category: "下装", subtype: "长裤", colors: ["绿色"], fit: "标准", material: "尼龙弹力", seasons: ["春", "秋"], styleTags: ["户外", "机能"], details: "弹力, 防泼水" },
  { title: "棕色灯芯绒长裤", category: "下装", subtype: "长裤", colors: ["棕色"], fit: "标准", material: "灯芯绒", seasons: ["秋", "冬"], styleTags: ["复古", "温暖"], details: "直筒, 厚实" },
  { title: "深灰运动短裤", category: "下装", subtype: "短裤", colors: ["灰色"], fit: "宽松", material: "速干聚酯", seasons: ["夏"], styleTags: ["运动", "轻量"], details: "抽绳, 透气" },
  { title: "米白色A字半裙", category: "下装", subtype: "半裙", colors: ["米色"], fit: "标准", material: "棉", seasons: ["春", "夏"], styleTags: ["柔和", "通勤"], details: "A字, 过膝" },
  { title: "黑色防水徒步鞋", category: "鞋履", subtype: "运动鞋", colors: ["黑色"], fit: "标准", material: "网布橡胶", seasons: ["春", "夏", "秋"], styleTags: ["户外", "防水"], details: "防滑, 防水" },
  { title: "白色复古运动鞋", category: "鞋履", subtype: "运动鞋", colors: ["白色"], fit: "标准", material: "皮革橡胶", seasons: ["春", "夏", "秋"], styleTags: ["休闲", "基础"], details: "低帮, 舒适" },
  { title: "棕色乐福鞋", category: "鞋履", subtype: "乐福鞋", colors: ["棕色"], fit: "标准", material: "皮革", seasons: ["春", "秋"], styleTags: ["商务", "经典"], details: "便鞋, 软底" },
  { title: "黑色短靴", category: "鞋履", subtype: "靴子", colors: ["黑色"], fit: "标准", material: "皮革", seasons: ["秋", "冬"], styleTags: ["通勤", "保暖"], details: "侧拉链, 防滑" },
  { title: "米色帆布鞋", category: "鞋履", subtype: "帆布鞋", colors: ["米色"], fit: "标准", material: "帆布橡胶", seasons: ["春", "夏"], styleTags: ["休闲", "轻量"], details: "低帮, 透气" },
  { title: "黄色帆布托特包", category: "配饰", subtype: "包", colors: ["黄色"], fit: "大容量", material: "帆布", seasons: ["春", "夏", "秋"], styleTags: ["休闲", "明亮"], details: "可肩背, 大容量" },
  { title: "黑色通勤托特包", category: "配饰", subtype: "包", colors: ["黑色"], fit: "大容量", material: "皮革", seasons: ["春", "秋", "冬"], styleTags: ["商务", "通勤"], details: "可放电脑" },
  { title: "藏蓝棒球帽", category: "配饰", subtype: "帽子", colors: ["蓝色"], fit: "可调节", material: "棉", seasons: ["春", "夏"], styleTags: ["休闲", "遮阳"], details: "弯檐, 可调节" },
  { title: "红色太阳镜", category: "配饰", subtype: "眼镜", colors: ["红色"], fit: "标准", material: "醋酸纤维", seasons: ["春", "夏"], styleTags: ["度假", "色彩"], details: "偏光镜片" },
  { title: "灰色轻薄围巾", category: "配饰", subtype: "围巾", colors: ["灰色"], fit: "宽松", material: "羊毛", seasons: ["秋", "冬"], styleTags: ["保暖", "简约"], details: "可折叠" },
  { title: "银色简约腕表", category: "配饰", subtype: "手表", colors: ["白色"], fit: "标准", material: "不锈钢", seasons: ["春", "夏", "秋", "冬"], styleTags: ["商务", "简约"], details: "防泼水" },
  { title: "金色细链项链", category: "配饰", subtype: "项链", colors: ["黄色"], fit: "标准", material: "合金", seasons: ["春", "夏", "秋", "冬"], styleTags: ["精致", "首饰"], details: "细链, 小吊坠" },
  { title: "绿色防水腰包", category: "配饰", subtype: "包", colors: ["绿色"], fit: "标准", material: "尼龙", seasons: ["春", "夏", "秋"], styleTags: ["户外", "机能"], details: "防泼水, 贴身" },
  { title: "棕色皮带", category: "配饰", subtype: "腰带", colors: ["棕色"], fit: "标准", material: "皮革", seasons: ["春", "夏", "秋", "冬"], styleTags: ["经典", "基础"], details: "金属扣" },
];
