// 演示行程数据(UI 阶段的假数据)——真正的 AI 行程生成还没接。
//
// 拆成独立文件是为了守住单文件 400 行上限(AGENTS.md §7):itinerary.ts
// 只放表结构和读写逻辑,这里只放数据。
// TODO: 接入 AI 行程生成后删掉本文件,由模型产出同样结构的数据。
//
// 手绘稿里的 "x.xx" 就是 dateLabel。
//
// photoQuery 是可选的人工覆盖,不填也有图:photos.ts 的 photoQueries()
// 会从名称/城市/类型推导候选词。这里保留手写值只是为了演示数据出图更稳。
// 注:早先这里写着"英文命中率明显更高",实测(scripts/photo-hitrate-probe.mjs)
// 是反的 —— 中文名 5/5、手写英文 4/5,图库里的原始标题本来就多是中文。
import type { TripDay, TripStop } from "./itinerary.ts";

export type DemoStop = Omit<
  TripStop,
  "id" | "photoUrl" | "photoCredit" | "photoSourceUrl"
>;
export type DemoDay = Omit<TripDay, "id" | "stops"> & { stops: DemoStop[] };

export const DEMO_DEPART_LABEL = "3.14";
export const DEMO_TITLE = "成都三日";
export const DEMO_TITLE_EN = "Three Days in Chengdu";

export const DEMO_DAYS: DemoDay[] = [
  {
    dayNumber: 1,
    dateLabel: "3.14",
    city: "成都",
    cityEn: "Chengdu",
    summary: "老城散步:巷子、熊猫、夜逛锦里",
    summaryEn: "Old town: alleys, pandas, Jinli by night",
    stops: [
      {
        position: 0,
        kind: "spot",
        name: "宽窄巷子",
        nameEn: "Kuanzhai Alley",
        startTime: "09:30",
        duration: "2h",
        note: "清代街巷,早上人少好拍照",
        noteEn: "Qing-era lanes, quiet in the morning",
        photoQuery: "Kuanzhai Alley Chengdu",
      },
      {
        position: 1,
        kind: "meal",
        name: "龙抄手(午餐)",
        nameEn: "Long Chaoshou (lunch)",
        startTime: "12:00",
        duration: "1h",
        note: "老字号小吃,人均 40",
        noteEn: "Classic snack house, about ¥40 each",
        photoQuery: "Sichuan street food wonton",
      },
      {
        position: 2,
        kind: "spot",
        name: "大熊猫繁育研究基地",
        nameEn: "Giant Panda Base",
        startTime: "14:00",
        duration: "3h",
        note: "下午熊猫活动少,记得戴帽子防晒",
        noteEn: "Pandas nap in the afternoon; bring a hat",
        photoQuery: "Chengdu giant panda",
      },
      {
        position: 3,
        kind: "spot",
        name: "锦里古街",
        nameEn: "Jinli Ancient Street",
        startTime: "18:30",
        duration: "1.5h",
        note: "灯笼亮起后最好看",
        noteEn: "Best once the lanterns come on",
        photoQuery: "Jinli Ancient Street lanterns",
      },
      {
        position: 4,
        kind: "hotel",
        name: "太古里附近酒店",
        nameEn: "Hotel near Taikoo Li",
        startTime: "21:00",
        duration: "",
        note: "步行 10 分钟到地铁春熙路站",
        noteEn: "10 min walk to Chunxi Road metro",
        photoQuery: "Chengdu Taikoo Li night",
      },
    ],
  },
  {
    dayNumber: 2,
    dateLabel: "3.15",
    city: "都江堰",
    cityEn: "Dujiangyan",
    summary: "水利古迹 + 青城山半日",
    summaryEn: "Ancient waterworks and half a day on Qingcheng Mountain",
    stops: [
      {
        position: 0,
        kind: "transit",
        name: "成都东站 → 都江堰",
        nameEn: "Chengdu East → Dujiangyan",
        startTime: "08:10",
        duration: "40min",
        note: "高铁 C6108,提前 20 分钟进站",
        noteEn: "High-speed C6108, arrive 20 min early",
        photoQuery: "China high speed rail station",
      },
      {
        position: 1,
        kind: "spot",
        name: "都江堰景区",
        nameEn: "Dujiangyan Irrigation System",
        startTime: "09:30",
        duration: "3h",
        note: "两千年还在用的水利工程,走路多穿舒适鞋",
        noteEn: "2,000-year-old waterworks; wear comfortable shoes",
        photoQuery: "Dujiangyan irrigation system",
      },
      {
        position: 2,
        kind: "meal",
        name: "南桥边川菜(午餐)",
        nameEn: "Sichuan lunch by Nanqiao",
        startTime: "13:00",
        duration: "1h",
        note: "南桥夜景也值得再回来一次",
        noteEn: "Worth returning for the Nanqiao night view",
        photoQuery: "Dujiangyan Nanqiao bridge",
      },
      {
        position: 3,
        kind: "spot",
        name: "青城山前山",
        nameEn: "Mount Qingcheng",
        startTime: "14:30",
        duration: "3.5h",
        note: "山里比市区低 5°C,带一件薄外套",
        noteEn: "About 5°C cooler than the city; bring a light jacket",
        photoQuery: "Mount Qingcheng Taoist temple",
      },
      {
        position: 4,
        kind: "hotel",
        name: "青城山脚民宿",
        nameEn: "Guesthouse at Qingcheng foot",
        startTime: "19:30",
        duration: "",
        note: "山下温泉可泡,记得带泳衣",
        noteEn: "Hot springs nearby; pack swimwear",
        photoQuery: "Chinese mountain guesthouse courtyard",
      },
    ],
  },
  {
    dayNumber: 3,
    dateLabel: "3.16",
    city: "成都",
    cityEn: "Chengdu",
    summary: "博物馆 + 公园喝茶,傍晚返程",
    summaryEn: "Museum, tea in the park, fly home in the evening",
    stops: [
      {
        position: 0,
        kind: "spot",
        name: "金沙遗址博物馆",
        nameEn: "Jinsha Site Museum",
        startTime: "10:00",
        duration: "2h",
        note: "太阳神鸟金饰在这里,室内空调足",
        noteEn: "Home of the Golden Sun Bird; strong indoor A/C",
        photoQuery: "Jinsha Site Museum Chengdu",
      },
      {
        position: 1,
        kind: "meal",
        name: "人民公园鹤鸣茶社",
        nameEn: "Heming Teahouse, People's Park",
        startTime: "13:00",
        duration: "2h",
        note: "竹椅盖碗茶,可以采耳",
        noteEn: "Bamboo chairs, covered-bowl tea, ear cleaning",
        photoQuery: "Heming teahouse Chengdu People's Park",
      },
      {
        position: 2,
        kind: "spot",
        name: "东郊记忆",
        nameEn: "Eastern Suburb Memory",
        startTime: "15:30",
        duration: "1.5h",
        note: "老工厂改造的园区,红砖很好拍",
        noteEn: "Converted factory complex; great red-brick backdrops",
        photoQuery: "Eastern Suburb Memory Chengdu industrial",
      },
      {
        position: 3,
        kind: "transit",
        name: "天府机场 T2 返程",
        nameEn: "Tianfu Airport T2, flight home",
        startTime: "19:40",
        duration: "",
        note: "市区到机场约 1h,提前 2h 出发",
        noteEn: "About 1h from downtown; leave 2h ahead",
        photoQuery: "Chengdu Tianfu airport terminal",
      },
    ],
  },
];
