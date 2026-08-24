// 渲染检查用的入口:把左右两栏真实组件渲染成静态 HTML。
// 由 scripts/itinerary-render-check.mjs 用 esbuild 打包后执行。
//
// 为什么要有这个:摆位算法(labelBox)从曲线形状推出标签位置,光靠肉眼
// 看不出标签会不会压到线上。这里渲染真实组件、把内联样式抠出来做碰撞检测,
// 检的就是真正会渲染出来的东西,而不是另抄一份数学。
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "../client/src/i18n/useLang";
import TripSpine from "../client/src/components/TripSpine";
import DayPlan from "../client/src/components/DayPlan";
import Profile from "../client/src/pages/Profile";
import Home from "../client/src/pages";

/** 造一趟 days 天、每天 stopsPerDay 个停靠点的假行程。 */
function makeTrip(days, stopsPerDay) {
  return {
    id: "trip-1",
    title: "测试行程",
    titleEn: "Test Trip",
    scenario: "travel",
    departLabel: "3.14",
    createdAt: "2024-03-14",
    days: Array.from({ length: days }, (_, d) => ({
      id: `day-${d + 1}`,
      dayNumber: d + 1,
      dateLabel: `3.${14 + d}`,
      city: "成都",
      cityEn: "Chengdu",
      summary: "测试",
      summaryEn: "Test",
      stops: Array.from({ length: stopsPerDay }, (_, s) => ({
        id: `stop-${d + 1}-${s + 1}`,
        position: s,
        kind: ["spot", "meal", "transit", "hotel"][s % 4],
        name: `景点 ${s + 1}`,
        nameEn: `Stop ${s + 1}`,
        startTime: "09:30",
        duration: "2h",
        note: "备注",
        noteEn: "Note",
        photoQuery: "",
        photoUrl: null,
        photoCredit: null,
        photoSourceUrl: null,
      })),
    })),
  };
}

export function renderSpine(days) {
  const trip = makeTrip(days, 3);
  return renderToStaticMarkup(
    <LangProvider>
      <TripSpine trip={trip} activeDayId="day-1" onPickDay={() => {}} />
    </LangProvider>
  );
}

export function renderDay(stops) {
  const trip = makeTrip(1, stops);
  return renderToStaticMarkup(
    <LangProvider>
      <DayPlan day={trip.days[0]} />
    </LangProvider>
  );
}

export function renderProfile(gender = "female") {
  return renderToStaticMarkup(
    <LangProvider>
      <Profile
        user={{
          id: "user-1",
          email: "anna@example.com",
          name: "Anna",
          age: 28,
          heightCm: 168,
          weightKg: 56,
          style: null,
          gender,
          bustCm: 84,
          waistCm: 66,
          hipCm: 90,
          bodyType: "hourglass",
          seasonColorType: "spring",
          stylePrefs: ["minimalist"],
          wearFeel: ["runs-cold"],
          wearFeelOther: null,
          travelHabits: ["packs-light"],
          travelHabitsOther: null,
        }}
        onBack={() => {}}
        onSaved={() => {}}
      />
    </LangProvider>
  );
}

export function renderHome() {
  return renderToStaticMarkup(
    <LangProvider>
      <Home
        user={{ id: "user-1", email: "anna@example.com", name: "Anna" }}
        onOpenTrips={() => {}}
        onOpenWardrobe={() => {}}
        onOpenItinerary={() => {}}
        onOpenPacking={() => {}}
        onOpenProfile={() => {}}
      />
    </LangProvider>
  );
}
