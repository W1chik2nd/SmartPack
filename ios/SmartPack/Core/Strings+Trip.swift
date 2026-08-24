import Foundation

// Trip planning, wardrobe, packing, itinerary, outfit, and assistant copy.
extension Strings {

    // MARK: - Trip planner (scenario picker)

    static let tripHello = LocalizedText(en: "Hello", zh: "你好")
    static let tripGoingTo = LocalizedText(en: "You are going to…", zh: "你将要去…")
    static let tripLoadError = LocalizedText(en: "Could not load scenarios.", zh: "无法加载场景。")
    static let pickScenario = LocalizedText(en: "Pick a scenario", zh: "选择一个场景")

    // MARK: - Trip setup (map + calendar)

    static let tripSetupTitle = LocalizedText(en: "Where and when?", zh: "去哪里,什么时候?")
    static let backToScenarios = LocalizedText(en: "Back to scenarios", zh: "返回场景选择")
    static let searchPlace = LocalizedText(en: "Search a destination…", zh: "搜索目的地…")
    static let searchAction = LocalizedText(en: "Search", zh: "搜索")
    static let searching = LocalizedText(en: "Searching…", zh: "搜索中…")
    static let noPlaces = LocalizedText(en: "No places found.", zh: "没有找到地点。")
    static let placeSearchFailed = LocalizedText(en: "Place search failed.", zh: "地点搜索失败。")
    static let pickDates = LocalizedText(en: "Pick your dates", zh: "选择日期")
    static let prevMonth = LocalizedText(en: "Previous month", zh: "上个月")
    static let nextMonth = LocalizedText(en: "Next month", zh: "下个月")
    static let clearDates = LocalizedText(en: "Clear dates", zh: "清除日期")
    static let noDates = LocalizedText(en: "No dates picked", zh: "未选择日期")
    static let mapLabel = LocalizedText(en: "Destination map", zh: "目的地地图")
    static let needPlaceAndDates = LocalizedText(
        en: "Pick a destination and your dates first.",
        zh: "请先选择目的地和日期。"
    )
    static let saveTripFailed = LocalizedText(en: "Could not save the trip.", zh: "行程保存失败。")
    static let tripAgendaKicker = LocalizedText(en: "Agent context", zh: "Agent 上下文")
    static let tripAgendaTitle = LocalizedText(en: "What must this trip cover?", zh: "这趟行程必须覆盖什么?")
    static let tripAgendaHint = LocalizedText(
        en: "Add meetings, reservations, activities, pace, luggage limits, or anything that changes what you wear and carry.",
        zh: "补充会议、预约、活动、节奏、行李限制,以及任何会影响穿搭和装备的安排。"
    )
    static let tripAgendaPlaceholder = LocalizedText(
        en: "Example: client meeting on day 1, museum and dinner on day 2; carry-on only; no early starts…",
        zh: "例如:第 1 天客户会议,第 2 天博物馆和晚餐;只带登机箱;不要安排太早…"
    )
    static let generateTrip = LocalizedText(en: "Generate complete plan", zh: "生成完整旅行方案")
    static let generatingTrip = LocalizedText(en: "Agent is planning…", zh: "Agent 正在规划…")
    static let tripAgentNote = LocalizedText(
        en: "Combines profile, wardrobe, scenario, agenda, destination weather, itinerary, outfits, equipment, and packing.",
        zh: "综合个人资料、衣橱、场景、安排、当地天气,一次生成行程、穿搭、装备和清单。"
    )
    static let tripAgentWorking = LocalizedText(
        en: "Checking destination weather and building a day-by-day plan. This can take a little while.",
        zh: "正在核对目的地天气并生成逐日方案,可能需要一点时间。"
    )
    static let tripQueuedTitle = LocalizedText(en: "Trip accepted", zh: "行程已进入后台规划")
    static let tripQueuedButton = LocalizedText(en: "Planning in background", zh: "正在后台规划")
    static let tripEstimateLabel = LocalizedText(en: "Estimated time", zh: "预计用时")
    static let tripMinutesShort = LocalizedText(en: "min", zh: "分钟")
    static let tripEstimateHint = LocalizedText(
        en: "This is an approximate window; destination research and provider traffic can change it.",
        zh: "这是预计区间；目的地资料量和模型服务繁忙程度可能影响实际用时。"
    )
    static let tripEstimateExceeded = LocalizedText(
        en: "Taking longer than estimated — the Agent is still working.",
        zh: "已超出预计区间，Agent 仍在继续规划。"
    )
    static let tripElapsedLabel = LocalizedText(en: "Elapsed", zh: "已等待")
    static let tripReadyTitle = LocalizedText(en: "Your trip is ready", zh: "旅行方案已完成")
    static let tripReadyMessage = LocalizedText(
        en: "Itinerary, outfits, equipment, and packing are now synchronized.",
        zh: "行程、穿搭、装备和打包清单已同步完成。"
    )
    static let tripViewPlan = LocalizedText(en: "View completed trip", zh: "查看完整方案")
    static let nights = LocalizedText(en: "nights", zh: "晚")
    static let sameDay = LocalizedText(en: "Day trip", zh: "当天往返")

    // MARK: - Assistant

    static let chatTitle = LocalizedText(en: "Assistant", zh: "助手")
    static let chatGreeting = LocalizedText(
        en: "Hi! I'm your WearRoute assistant. Ask me what to wear today, or tell me about a trip — destination, dates, occasions — and I'll plan outfits and a packing list.",
        zh: "你好!我是你的 WearRoute 助手。可以问我今天穿什么,或告诉我行程——目的地、日期、场合——我来帮你规划穿搭和行李清单。"
    )
    static let chatPlaceholder = LocalizedText(en: "Ask about outfits or packing…", zh: "问穿搭或打包…")
    static let chatSend = LocalizedText(en: "Send", zh: "发送")
    static let chatThinking = LocalizedText(en: "Thinking…", zh: "思考中…")
    static let chatUnavailable = LocalizedText(en: "The assistant is unavailable.", zh: "助手暂不可用。")
    static let chatOpen = LocalizedText(en: "Open WearRoute assistant", zh: "打开 WearRoute 助手")
    static let chatCloseDialog = LocalizedText(en: "Close assistant", zh: "关闭助手")

    // MARK: - Wardrobe

    static let wardrobeTitle = LocalizedText(en: "Wardrobe Categories", zh: "服装品类列表")
    static let wardrobeAddPhoto = LocalizedText(en: "Add clothing by photo", zh: "拍照添加衣物")
    static let wardrobeTakePhoto = LocalizedText(en: "Take a photo", zh: "拍照")
    static let wardrobeChoosePhoto = LocalizedText(en: "Choose from library", zh: "从相册选择")
    static let wardrobeEmpty = LocalizedText(en: "Your wardrobe is empty", zh: "衣柜还是空的")
    static let wardrobeEmptyHint = LocalizedText(
        en: "Tap the camera in the top right to add your first item.",
        zh: "点右上角相机添加第一件衣物"
    )
    static let wardrobeRecognizing = LocalizedText(en: "Recognizing…", zh: "识别中…")
    static let wardrobeLoadFailed = LocalizedText(en: "Could not load your wardrobe.", zh: "加载失败")
    static let wardrobeRecognizeFailed = LocalizedText(en: "Could not recognize the item.", zh: "识别失败")
    static let wardrobePhotoFailed = LocalizedText(en: "Could not process the photo.", zh: "图片处理失败")
    static let wardrobeDeleteFailed = LocalizedText(en: "Could not delete the item.", zh: "删除失败")
    static let wardrobeDelete = LocalizedText(en: "Delete", zh: "删除")
    static let wardrobeFilter = LocalizedText(en: "Filter", zh: "筛选")
    static let wardrobeFilterAria = LocalizedText(en: "Filter by clothing category", zh: "按衣服品类筛选")
    static let wardrobeFilterAll = LocalizedText(en: "All categories", zh: "全部品类")
    static let wardrobeFilterTops = LocalizedText(en: "Tops", zh: "上装")
    static let wardrobeFilterPants = LocalizedText(en: "Pants", zh: "裤装")
    static let wardrobeFilterSkirts = LocalizedText(en: "Skirts", zh: "裙装")
    static let wardrobeFilterShoes = LocalizedText(en: "Shoes", zh: "鞋履")
    static let wardrobeFilterAccessories = LocalizedText(en: "Accessories", zh: "配饰")
    static let wardrobeShowAll = LocalizedText(en: "Show all items", zh: "查看全部衣物")

    // MARK: - Packing list

    static let pkEyebrow = LocalizedText(en: "Minimal Luggage Plan", zh: "最小行李方案")
    static let pkVariety = LocalizedText(en: "More variety", zh: "丰富造型")
    static let pkLight = LocalizedText(en: "Pack light", zh: "精简出行")
    static let pkBalanced = LocalizedText(en: "Balanced", zh: "均衡")
    static let pkSliderLabel = LocalizedText(
        en: "Packing preference: pack light to more variety",
        zh: "打包偏好:精简出行 到 丰富造型"
    )
    static let pkListTitle = LocalizedText(en: "Packing List", zh: "打包清单")
    static let pkReuse = LocalizedText(en: "Times reused", zh: "复用次数")
    static let pkEssentials = LocalizedText(en: "Don't-forget Items", zh: "重要物品提醒")
    static let pkCore = LocalizedText(en: "Core Pieces", zh: "核心单品")
    static let pkCoreTag = LocalizedText(en: "Core piece", zh: "核心单品")
    static let pkPacked = LocalizedText(en: "Packed", zh: "已打包")
    static let pkUpdating = LocalizedText(en: "updating…", zh: "更新中…")
    static let pkLoadFailed = LocalizedText(en: "Failed to load plan.", zh: "无法加载方案。")
    static let pkQuantity = LocalizedText(en: "Pack", zh: "数量")
    static let pkDays = LocalizedText(en: "Days", zh: "使用日")
    static let pkWardrobeGap = LocalizedText(en: "Wardrobe gap", zh: "衣橱缺口")

    // MARK: - Itinerary

    static let itineraryTitle = LocalizedText(en: "Itinerary", zh: "行程计划")
    static let tripOverview = LocalizedText(en: "Trip Overview", zh: "总行程图")
    static let departs = LocalizedText(en: "Departs", zh: "出发")
    static let itineraryLoading = LocalizedText(en: "Loading itinerary…", zh: "正在加载行程…")
    static let itineraryError = LocalizedText(en: "Could not load the itinerary.", zh: "无法加载行程。")
    static let itineraryEmpty = LocalizedText(en: "No itinerary yet.", zh: "还没有行程。")
    static let collapseOverview = LocalizedText(en: "Collapse trip overview", zh: "收起总行程图")
    static let expandOverview = LocalizedText(en: "Expand trip overview", zh: "展开总行程图")
    static let pickDay = LocalizedText(en: "Pick a day", zh: "选择某一天")
    static let dayStops = LocalizedText(en: "stops", zh: "个停靠点")
    static let dayWeather = LocalizedText(en: "Weather decision", zh: "天气决策")
    static let dayOutfit = LocalizedText(en: "Wear", zh: "当日穿搭")
    static let dayEquipment = LocalizedText(en: "Carry", zh: "随身装备")
    static let stopSpot = LocalizedText(en: "Sight", zh: "景点")
    static let stopTransit = LocalizedText(en: "Transit", zh: "交通")
    static let stopMeal = LocalizedText(en: "Meal", zh: "餐饮")
    static let stopHotel = LocalizedText(en: "Stay", zh: "住宿")
    static let photoPending = LocalizedText(en: "Finding a photo…", zh: "正在找配图…")
    static let photoNone = LocalizedText(en: "No photo", zh: "暂无配图")
    static let photoSource = LocalizedText(en: "Photos", zh: "图片来源")

    static func stopKindLabel(_ kind: StopKind, _ lang: Lang) -> String {
        switch kind {
        case .spot: return stopSpot(lang)
        case .transit: return stopTransit(lang)
        case .meal: return stopMeal(lang)
        case .hotel: return stopHotel(lang)
        }
    }

    // MARK: - Outfit overview

    static let outfitOverviewTitle = LocalizedText(en: "Trip Outfit Overview", zh: "行程穿搭总览")
    static let outfitTripContext = LocalizedText(en: "Trip context", zh: "行程信息")
    static let outfitDestination = LocalizedText(en: "Destination", zh: "目的地")
    static let outfitDate = LocalizedText(en: "Date", zh: "日期")
    static let outfitPlace = LocalizedText(en: "Place", zh: "地点")
    static let outfitScene = LocalizedText(en: "Scene", zh: "场景")
    static let outfitItineraryOverview = LocalizedText(en: "Itinerary Overview", zh: "行程方案总览")
    static let outfitSelectedDay = LocalizedText(en: "Selected outfit", zh: "当前穿搭")
    static let outfitDailyOverview = LocalizedText(en: "Daily Outfit Overview", zh: "分日穿搭总览")
    static let outfitPreviousDay = LocalizedText(en: "Previous day's outfit", zh: "上一天穿搭")
    static let outfitNextDay = LocalizedText(en: "Next day's outfit", zh: "下一天穿搭")
    static let outfitSuggestedPieces = LocalizedText(
        en: "Suggested basics fill wardrobe gaps. Add similar pieces to make the plan fully yours.",
        zh: "衣橱缺少的品类暂用基础建议补齐；添加相似单品后即可生成完整个人方案。"
    )
    static let outfitFromWardrobe = LocalizedText(
        en: "This look uses pieces from your wardrobe.",
        zh: "本套穿搭全部来自你的衣橱。"
    )
    static let outfitLoading = LocalizedText(en: "Building your outfit plan…", zh: "正在生成穿搭方案…")
    static let outfitLoadFailed = LocalizedText(en: "Could not load the outfit plan.", zh: "无法加载穿搭方案。")
}
