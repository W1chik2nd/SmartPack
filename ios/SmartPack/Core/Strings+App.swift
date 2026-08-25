import Foundation

/// Shell, landing, auth, questionnaire, and dashboard copy. Ported from
/// `client/src/i18n/strings.ts`; keep the two files in step.
enum Strings {

    // MARK: - Nav / shell

    /// The wordmark itself is translated, not transliterated: the Chinese
    /// product name is 行装. Mirrors `brandName` in `client/src/i18n/strings.ts`.
    static let brandName = LocalizedText(en: "WearRoute", zh: "行装")

    static let navSignIn = LocalizedText(en: "Sign In", zh: "登录")
    static let navCreateAccount = LocalizedText(en: "Create Account", zh: "注册")
    static let navSignOut = LocalizedText(en: "Sign Out", zh: "退出登录")

    // MARK: - Landing

    static let landingTagline = LocalizedText(
        en: "What to wear, what to pack — leave it all to AI.",
        zh: "出门穿什么、行李带什么,都交给 AI。"
    )
    static let landingEnter = LocalizedText(en: "Start the journey", zh: "继续旅程")

    // MARK: - Sign in

    static let loginTitle = LocalizedText(en: "Sign in to WearRoute", zh: "登录 WearRoute")
    static let loginSubtitle = LocalizedText(
        en: "Your wardrobe, your trips, one plan.",
        zh: "你的衣橱、你的行程,一份方案。"
    )
    static let email = LocalizedText(en: "Email", zh: "邮箱")
    static let password = LocalizedText(en: "Password", zh: "密码")
    static let signIn = LocalizedText(en: "Sign In", zh: "登录")
    static let signingIn = LocalizedText(en: "Signing In…", zh: "正在登录…")
    static let noAccount = LocalizedText(en: "Don't have an account?", zh: "还没有账号?")
    static let createYours = LocalizedText(en: "Create yours now.", zh: "立即注册。")

    // MARK: - Sign up, step 1

    static let step1 = LocalizedText(en: "Step 1 of 2", zh: "第 1 步,共 2 步")
    static let registerTitle = LocalizedText(en: "Create your WearRoute account", zh: "创建 WearRoute 账号")
    static let registerSubtitle = LocalizedText(
        en: "One account. Every outfit. Every trip.",
        zh: "一个账号,所有穿搭与行程。"
    )
    static let passwordHint = LocalizedText(en: "At least 8 characters.", zh: "至少 8 个字符。")
    static let confirmPassword = LocalizedText(en: "Confirm Password", zh: "确认密码")
    static let continueBtn = LocalizedText(en: "Continue", zh: "继续")
    static let checking = LocalizedText(en: "Checking…", zh: "正在检查…")
    static let haveAccount = LocalizedText(en: "Already have an account?", zh: "已有账号?")
    static let signInLink = LocalizedText(en: "Sign in.", zh: "去登录。")
    static let passwordsMismatch = LocalizedText(en: "Passwords do not match.", zh: "两次输入的密码不一致。")

    // MARK: - Sign up, step 2 (questionnaire)

    static let step2 = LocalizedText(en: "Step 2 of 2", zh: "第 2 步,共 2 步")
    static let quizTitle = LocalizedText(en: "Tell us about yourself", zh: "介绍一下你自己")
    static let quizSubtitle = LocalizedText(
        en: "WearRoute tailors every outfit to you. Complete this to finish creating your account.",
        zh: "WearRoute 会为你量身定制每套穿搭。完成问卷即注册成功。"
    )
    static let optionalMark = LocalizedText(en: "optional", zh: "非必填")
    static let optionalSection = LocalizedText(
        en: "Optional — sharpens your recommendations",
        zh: "非必填 —— 让推荐更贴合你"
    )
    static let requiredSection = LocalizedText(en: "Required", zh: "必填")
    static let pickMultiple = LocalizedText(en: "Pick any that apply", zh: "可多选")
    static let otherPlaceholder = LocalizedText(en: "Tell us in your own words", zh: "请自己填写")
    static let optionsLoadError = LocalizedText(en: "Could not load the questionnaire options.", zh: "无法加载问卷选项。")
    static let requiredMissing = LocalizedText(
        en: "Please answer every required question.",
        zh: "请填写所有必填项。"
    )
    static let incompleteWarning = LocalizedText(
        en: "Some answers are missing — recommendations may be less personalized. Tap again to continue anyway.",
        zh: "信息不完善,推荐可能不够个性化。再点一次可继续提交。"
    )
    static let finishCreate = LocalizedText(en: "Finish & Create Account", zh: "完成并创建账号")
    static let creating = LocalizedText(en: "Creating Account…", zh: "正在创建账号…")
    static let backToAccount = LocalizedText(en: "Back to account details.", zh: "返回账号信息。")

    /// Labels for the server-published questionnaire fields, keyed by field key.
    static let fieldLabels: [String: LocalizedText] = [
        "name": .init(en: "Name", zh: "姓名"),
        "gender": .init(en: "Gender", zh: "性别"),
        "age": .init(en: "Age", zh: "年龄"),
        "heightCm": .init(en: "Height (cm)", zh: "身高 (cm)"),
        "weightKg": .init(en: "Weight (kg)", zh: "体重 (kg)"),
        "bustCm": .init(en: "Bust (cm)", zh: "胸围 (cm)"),
        "waistCm": .init(en: "Waist (cm)", zh: "腰围 (cm)"),
        "hipCm": .init(en: "Hip (cm)", zh: "臀围 (cm)"),
        "bodyType": .init(en: "Body type", zh: "身材类型"),
        "seasonColorType": .init(en: "Seasonal color type", zh: "四季型人"),
        "stylePrefs": .init(en: "Style preferences", zh: "风格偏好"),
        "wearFeel": .init(en: "How clothes should feel", zh: "穿着体感"),
        "travelHabits": .init(en: "Travel & packing habits", zh: "出行与打包习惯"),
    ]

    // MARK: - Dashboard

    static let goodMorning = LocalizedText(en: "Good morning", zh: "早上好")
    static let goodAfternoon = LocalizedText(en: "Good afternoon", zh: "下午好")
    static let goodEvening = LocalizedText(en: "Good evening", zh: "晚上好")
    static let goodNight = LocalizedText(en: "Good night", zh: "夜深了")
    static let upcoming = LocalizedText(en: "Upcoming", zh: "最近日程")
    static let destination = LocalizedText(en: "Destination", zh: "目的地")
    static let previousTrip = LocalizedText(en: "Previous trip", zh: "上一个行程")
    static let nextTrip = LocalizedText(en: "Next trip", zh: "下一个行程")
    static let destinationWeatherToday = LocalizedText(en: "Destination Weather Today", zh: "目的地今日天气")
    static let weatherLoading = LocalizedText(en: "Loading…", zh: "加载中…")
    static let weatherUnavailable = LocalizedText(en: "Unavailable", zh: "暂不可用")
    static let weatherNoDestination = LocalizedText(en: "Set a trip destination", zh: "请先设置行程目的地")
    static let tripWeatherTitle = LocalizedText(en: "Trip Weather", zh: "行程天气")
    static let tripWeatherDays = LocalizedText(en: "Trip days", zh: "行程天数")
    static let tripWeatherDayUnit = LocalizedText(en: "days", zh: "天")
    static let tripWeatherDates = LocalizedText(en: "Travel dates", zh: "出行日期")
    static let tripWeatherDaily = LocalizedText(en: "Daily forecast", zh: "逐日预报")
    static let tripWeatherHigh = LocalizedText(en: "High", zh: "最高")
    static let tripWeatherLow = LocalizedText(en: "Low", zh: "最低")
    static let tripWeatherRain = LocalizedText(en: "Rain", zh: "降雨")
    static let tripWeatherUV = LocalizedText(en: "UV", zh: "紫外线")
    static let tripWeatherWind = LocalizedText(en: "Wind", zh: "风速")
    static let tripWeatherSource = LocalizedText(en: "Forecast source", zh: "预报来源")
    static let tripWeatherOutsideWindow = LocalizedText(
        en: "These dates are outside the reliable forecast window. Check again closer to departure.",
        zh: "当前日期超出可靠预报范围，请在临近出发时再查看。"
    )
    static let tripWeatherLoadFailed = LocalizedText(
        en: "Could not load this trip's weather.",
        zh: "无法加载此行程的天气。"
    )
    static let tripWeatherRetry = LocalizedText(en: "Try again", zh: "重新加载")
    static let checklist = LocalizedText(en: "Checklist", zh: "物品清单")
    static let todaysOutfit = LocalizedText(en: "Today's Outfit", zh: "今日穿搭")
    static let outfitUnavailable = LocalizedText(en: "Outfit unavailable", zh: "穿搭暂不可用")
    static let itinerary = LocalizedText(en: "Itinerary", zh: "行程")
    static let noTripYet = LocalizedText(en: "No trips planned yet", zh: "还没有行程")
    static let tripNights = LocalizedText(en: "nights", zh: "晚")
    static let tripSameDay = LocalizedText(en: "Day trip", zh: "当天往返")
    static let tripGeneratingHome = LocalizedText(en: "AI planning in background", zh: "AI 正在后台规划")
    static let tripGenerationFailedHome = LocalizedText(en: "Planning failed — try again", zh: "规划失败，请重新创建")
    static let deleteTrip = LocalizedText(en: "Delete trip", zh: "删除行程")
    static let deleteTripWarning = LocalizedText(
        en: "Itinerary, outfits, equipment, and packing will all be removed.",
        zh: "行程、穿搭、装备和打包清单都会被删除。"
    )
    static let cancelDelete = LocalizedText(en: "Cancel", zh: "取消")
    static let confirmDeleteTrip = LocalizedText(en: "Delete", zh: "确认删除")
    static let deletingTrip = LocalizedText(en: "Deleting…", zh: "正在删除…")
    static let deleteTripFailed = LocalizedText(en: "Could not delete this trip.", zh: "无法删除这条行程。")
    static let digitalWardrobe = LocalizedText(en: "Digital Wardrobe", zh: "电子衣橱")
    static let tripPlanner = LocalizedText(en: "Trip Planner", zh: "行程计划")
    static let myProfile = LocalizedText(en: "My Profile", zh: "个人档案")
    static let navToday = LocalizedText(en: "Today", zh: "今天")
    static let navTrips = LocalizedText(en: "Trips", zh: "行程")
    static let navWardrobe = LocalizedText(en: "Wardrobe", zh: "衣橱")
    static let navProfile = LocalizedText(en: "Profile", zh: "我的")
    static let navAssistant = LocalizedText(en: "AI", zh: "AI")
    static let navSections = LocalizedText(en: "Primary navigation", zh: "主导航")

    static let weatherConditionLabels: [String: LocalizedText] = [
        "Clear": .init(en: "Clear", zh: "晴"),
        "Partly cloudy": .init(en: "Partly cloudy", zh: "多云间晴"),
        "Overcast": .init(en: "Overcast", zh: "阴"),
        "Fog": .init(en: "Fog", zh: "雾"),
        "Drizzle": .init(en: "Drizzle", zh: "毛毛雨"),
        "Rain": .init(en: "Rain", zh: "雨"),
        "Snow": .init(en: "Snow", zh: "雪"),
        "Showers": .init(en: "Showers", zh: "阵雨"),
        "Snow showers": .init(en: "Snow showers", zh: "阵雪"),
        "Thunderstorm": .init(en: "Thunderstorm", zh: "雷暴"),
    ]

    // MARK: - Profile

    static let profileTitle = LocalizedText(en: "Personal Profile", zh: "个人档案")
    static let profileAvatar = LocalizedText(en: "Profile portrait", zh: "档案头像")
    static let profileSaved = LocalizedText(en: "Profile saved.", zh: "个人资料已保存。")
    static let profileSaveFailed = LocalizedText(en: "Could not save profile.", zh: "个人资料保存失败。")
    static let profileNickname = LocalizedText(en: "Nickname", zh: "昵称")
    static let profileGender = LocalizedText(en: "Gender", zh: "性别")
    static let profileMeasurements = LocalizedText(en: "Measurements", zh: "身体档案")
    static let profileMeasurementsHint = LocalizedText(
        en: "Age, height, and weight are required. Extra measurements improve fit and layering decisions.",
        zh: "年龄、身高和体重为必填；补充尺寸可提升版型与叠穿判断。"
    )
    static let profileAge = LocalizedText(en: "Age", zh: "年龄")
    static let profileHeight = LocalizedText(en: "Height", zh: "身高")
    static let profileWeight = LocalizedText(en: "Weight", zh: "体重")
    static let profileBust = LocalizedText(en: "Bust", zh: "胸围")
    static let profileWaist = LocalizedText(en: "Waist", zh: "腰围")
    static let profileHip = LocalizedText(en: "Hip", zh: "臀围")
    static let profileBodyType = LocalizedText(en: "Body type", zh: "身材类型")
    static let profileChoose = LocalizedText(en: "Choose", zh: "请选择")
    static let profileSeasonType = LocalizedText(en: "Best season", zh: "四季型人")
    static let profileStylePreferences = LocalizedText(en: "Style preferences", zh: "风格偏好")
    static let profileWearFeel = LocalizedText(en: "How clothes should feel", zh: "穿着体感")
    static let profileTravelHabits = LocalizedText(en: "Travel & packing habits", zh: "出行与打包习惯")
    static let profileFinish = LocalizedText(en: "Save profile", zh: "保存资料")
    static let backToHome = LocalizedText(en: "Back to Home", zh: "返回主页")
    static let close = LocalizedText(en: "Close", zh: "关闭")
}
