// Central i18n: every user-facing string lives here in both languages.
// The choice persists in localStorage so it survives refreshes and redirects.
// Keep this file to translations only; the hook lives in useLang.ts.

export type Lang = "en" | "zh";

export const STRINGS = {
  // nav / shell
  navSignIn: { en: "Sign In", zh: "登录" },
  navCreateAccount: { en: "Create Account", zh: "注册" },
  navSignOut: { en: "Sign Out", zh: "退出登录" },

  // landing
  landingTagline: {
    en: "What to wear, what to pack — leave it all to AI.",
    zh: "出门穿什么、行李带什么,都交给 AI。",
  },
  landingEnter: { en: "Start the journey", zh: "继续旅程" },

  // login
  loginTitle: { en: "Sign in to SmartPack", zh: "登录 SmartPack" },
  loginSubtitle: {
    en: "Your wardrobe, your trips, one plan.",
    zh: "你的衣橱、你的行程,一份方案。",
  },
  email: { en: "Email", zh: "邮箱" },
  password: { en: "Password", zh: "密码" },
  signIn: { en: "Sign In", zh: "登录" },
  signingIn: { en: "Signing In…", zh: "正在登录…" },
  noAccount: { en: "Don't have an account?", zh: "还没有账号?" },
  createYours: { en: "Create yours now.", zh: "立即注册。" },

  // register step 1
  step1: { en: "Step 1 of 2", zh: "第 1 步,共 2 步" },
  registerTitle: { en: "Create your SmartPack account", zh: "创建 SmartPack 账号" },
  registerSubtitle: {
    en: "One account. Every outfit. Every trip.",
    zh: "一个账号,所有穿搭与行程。",
  },
  passwordHint: { en: "At least 8 characters.", zh: "至少 8 个字符。" },
  confirmPassword: { en: "Confirm Password", zh: "确认密码" },
  continueBtn: { en: "Continue", zh: "继续" },
  checking: { en: "Checking…", zh: "正在检查…" },
  haveAccount: { en: "Already have an account?", zh: "已有账号?" },
  signInLink: { en: "Sign in.", zh: "去登录。" },
  passwordsMismatch: { en: "Passwords do not match.", zh: "两次输入的密码不一致。" },

  // questionnaire (step 2)
  step2: { en: "Step 2 of 2", zh: "第 2 步,共 2 步" },
  quizTitle: { en: "Tell us about yourself", zh: "介绍一下你自己" },
  quizSubtitle: {
    en: "SmartPack tailors every outfit to you. Complete this to finish creating your account.",
    zh: "SmartPack 会为你量身定制每套穿搭。完成问卷即注册成功。",
  },
  name: { en: "Name", zh: "姓名" },
  age: { en: "Age", zh: "年龄" },
  heightCm: { en: "Height (cm)", zh: "身高 (cm)" },
  weightKg: { en: "Weight (kg)", zh: "体重 (kg)" },
  bustCm: { en: "Bust (cm)", zh: "胸围 (cm)" },
  waistCm: { en: "Waist (cm)", zh: "腰围 (cm)" },
  hipCm: { en: "Hip (cm)", zh: "臀围 (cm)" },
  bodyType: { en: "Body type", zh: "身材类型" },
  seasonColorType: { en: "Seasonal color type", zh: "四季型人" },
  stylePrefs: { en: "Style preferences", zh: "风格偏好" },
  wearFeel: { en: "How clothes should feel", zh: "穿着体感" },
  travelHabits: { en: "Travel & packing habits", zh: "出行与打包习惯" },
  optionalMark: { en: "optional", zh: "非必填" },
  optionalSection: { en: "Optional — sharpens your recommendations", zh: "非必填 —— 让推荐更贴合你" },
  requiredSection: { en: "Required", zh: "必填" },
  pickMultiple: { en: "Pick any that apply", zh: "可多选" },
  optionsLoadError: { en: "Could not load the questionnaire options.", zh: "无法加载问卷选项。" },
  incompleteWarning: {
    en: "Some answers are missing — recommendations may be less personalized. Tap again to continue anyway.",
    zh: "信息不完善,推荐可能不够个性化。再点一次可继续提交。",
  },
  finishCreate: { en: "Finish & Create Account", zh: "完成并创建账号" },
  creating: { en: "Creating Account…", zh: "正在创建账号…" },
  backToAccount: { en: "Back to account details.", zh: "返回账号信息。" },

  // dashboard
  goodMorning: { en: "Good morning", zh: "早上好" },
  goodAfternoon: { en: "Good afternoon", zh: "下午好" },
  goodEvening: { en: "Good evening", zh: "晚上好" },
  goodNight: { en: "Good night", zh: "夜深了" },
  upcoming: { en: "Upcoming", zh: "最近日程" },
  todaysWeather: { en: "Today's Weather", zh: "今日天气" },
  weatherLoading: { en: "Loading…", zh: "加载中…" },
  weatherUnavailable: { en: "Unavailable", zh: "暂不可用" },
  checklist: { en: "Checklist", zh: "物品清单" },
  todaysOutfit: { en: "Today's Outfit", zh: "今日穿搭" },
  itinerary: { en: "Itinerary", zh: "行程" },
  digitalWardrobe: { en: "Digital Wardrobe", zh: "电子衣橱" },
  tripPlanner: { en: "Trip Planner", zh: "行程计划" },
  myProfile: { en: "My Profile", zh: "个人档案" },
  dashFooter: {
    en: "SmartPack — an AI scenario wardrobe. Sections open detailed pages as they are built.",
    zh: "SmartPack —— AI 场景衣橱。各板块的详细页面将陆续上线。",
  },

  // trip planner (scenario picker)
  tripHello: { en: "Hello", zh: "你好" },
  tripGoingTo: { en: "You are going to…", zh: "你将要去…" },
  tripLoadError: { en: "Could not load scenarios.", zh: "无法加载场景。" },
  prevScenario: { en: "Previous scenario", zh: "上一个场景" },
  nextScenario: { en: "Next scenario", zh: "下一个场景" },
  pickScenario: { en: "Pick a scenario", zh: "选择一个场景" },
  backToHome: { en: "Back to Home", zh: "返回主页" },

  // chat
  chatTitle: { en: "Assistant", zh: "助手" },
  chatGreeting: {
    en: "Hi! I'm your SmartPack assistant. Ask me what to wear today, or tell me about a trip — destination, dates, occasions — and I'll plan outfits and a packing list.",
    zh: "你好!我是你的 SmartPack 助手。可以问我今天穿什么,或告诉我行程——目的地、日期、场合——我来帮你规划穿搭和行李清单。",
  },
  chatPlaceholder: { en: "Ask about outfits or packing…", zh: "问穿搭或打包…" },
  chatSend: { en: "Send", zh: "发送" },
  chatThinking: { en: "Thinking…", zh: "思考中…" },
  chatUnavailable: { en: "The assistant is unavailable.", zh: "助手暂不可用。" },
  chatOpen: { en: "Open SmartPack assistant", zh: "打开 SmartPack 助手" },
  chatClose: { en: "Close SmartPack assistant", zh: "关闭 SmartPack 助手" },
  chatCloseDialog: { en: "Close assistant", zh: "关闭助手" },

  // city picker
  cityLabel: { en: "City", zh: "城市" },
} as const;

export type StringKey = keyof typeof STRINGS;

// Scenario labels come from the server by id; translate on the client so the
// API stays language-neutral.
export const SCENARIO_LABELS: Record<string, { en: string; zh: string }> = {
  commute: { en: "Commute", zh: "通勤" },
  travel: { en: "Travel", zh: "旅行" },
  business: { en: "Business Trip", zh: "出差" },
  date: { en: "Date", zh: "约会" },
  sport: { en: "Sport", zh: "运动" },
  formal: { en: "Formal", zh: "正式场合" },
};
