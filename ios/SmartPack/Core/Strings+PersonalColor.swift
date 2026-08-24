import Foundation

extension Strings {
    static let personalColorHelp = LocalizedText(
        en: "Not sure of your season? Analyse a photo →",
        zh: "不知道自己的四季型？照片分析 →"
    )
    static let personalColorKicker = LocalizedText(en: "Personal color analysis", zh: "个人色彩分析")
    static let personalColorTitle = LocalizedText(en: "Find your season", zh: "找到你的四季型")
    static let personalColorIntro = LocalizedText(
        en: "Upload a portrait. WearRoute will analyse its visible colour relationships and recommend a seasonal palette.",
        zh: "上传一张真人照片，WearRoute 会分析照片中可见的色彩关系，并推荐适合你的四季型。"
    )
    static let personalColorUpload = LocalizedText(en: "Choose a portrait", zh: "上传真人照片")
    static let personalColorReplace = LocalizedText(en: "Choose another photo", zh: "重新上传")
    static let personalColorPhotoHint = LocalizedText(
        en: "Front-facing, natural light, no filter",
        zh: "建议正面、自然光、避免滤镜"
    )
    static let personalColorCoverage = LocalizedText(en: "The analysis covers:", zh: "分析将覆盖：")
    static let personalColorCoverageItems: [LocalizedText] = [
        .init(en: "Warm or cool visible skin tone and a Spring / Summer / Autumn / Winter direction", zh: "可见肤色冷暖调与春夏秋冬四季型"),
        .init(en: "Brightness, saturation and facial colour contrast", zh: "明度、饱和度与五官色彩对比度"),
        .init(en: "Clothing, makeup, hair colour and accessory-metal suggestions", zh: "服装、妆容、发色与配饰金属建议"),
        .init(en: "Colours that brighten the complexion or make it look dull", zh: "更显气色与容易显灰暗的颜色"),
    ]
    static let personalColorStart = LocalizedText(en: "Start analysis", zh: "开始专业分析")
    static let personalColorAnalysing = LocalizedText(en: "Analysing…", zh: "正在分析…")
    static let personalColorResult = LocalizedText(en: "Your personal colour report", zh: "你的个人色彩分析")
    static let personalColorNote = LocalizedText(
        en: "Lighting and screen colour can affect AI analysis. Confirm important styling decisions with an in-person draping session.",
        zh: "AI 分析会受照片光线和屏幕色差影响，重要造型决策可结合线下布诊复核。"
    )
    static let personalColorUse = LocalizedText(en: "Use this season", zh: "使用这个四季型")
    static let personalColorFailed = LocalizedText(en: "Could not read this photo.", zh: "无法读取这张照片。")

    static func personalColorSeason(_ id: String, _ lang: Lang) -> String {
        let names: [String: LocalizedText] = [
            "spring": .init(en: "Spring", zh: "春季型"),
            "summer": .init(en: "Summer", zh: "夏季型"),
            "autumn": .init(en: "Autumn", zh: "秋季型"),
            "winter": .init(en: "Winter", zh: "冬季型"),
        ]
        return names[id]?(lang) ?? id
    }
}
