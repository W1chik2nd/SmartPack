# WearRoute iOS

原生 SwiftUI 客户端。和 web 端是**同一个后端、同一套设计令牌**——两端只共享后端 API，
不共享代码（AGENTS.md §3）。

## 目录

```
ios/
  SmartPack.xcodeproj/        Xcode 工程（file-system synchronized group，
                              新增 .swift 文件不用改工程文件）
  Config/Info.plist           权限、ATS、后端地址
  SmartPack/
    SmartPackApp.swift        入口
    Theme/                    设计令牌 + 包豪斯基础组件（对应 theme.css / styles.css）
    Core/                     API 客户端、模型、i18n、会话与导航状态
    Features/
      Landing  Auth  Home  Trips  Itinerary  Wardrobe  Packing  Outfit  Profile  Chat
      Trips/TripWeatherView.swift  行程逐日天气（同源 `/api/trip-plans/:id/weather`）
      Shared/                 页面骨架、SVG 解析、宽度测量
    Resources/                与 client/public 同源的图片和 SVG
```

## 跑起来

1. 先起后端（仓库根目录）：

```bash
npm run dev
```

2. 打开工程并运行到模拟器：

```bash
open ios/SmartPack.xcodeproj
```

选 `SmartPack` scheme + 任意 iPhone 模拟器，⌘R。

**真机**：模拟器和 Mac 共用 `localhost`，真机不行。把 `Config/Info.plist` 里的
`SmartPackAPIBaseURL` 改成 Mac 的局域网地址（形如 `http://192.168.1.20:4177`），
并在 `NSAppTransportSecurity → NSExceptionDomains` 里加上同一个域名/IP。
后端上 HTTPS 之后，这两处开发期例外都应该删掉。

连接已部署的 HTTPS 后端时，按照
[iOS 连接生产后端说明](../docs/ios-production-backend.md)配置地址、验证健康检查并重新安装 App。

## 和 web 端的对应关系

| web | iOS |
| --- | --- |
| `client/src/theme.css` | `Theme/Theme.swift` |
| `client/src/api.ts` | `Core/APIClient.swift` + `Core/Models.swift` + `Core/TravelModels.swift` |
| `client/src/i18n/strings.ts` | `Core/Strings+App.swift` + `Core/Strings+Trip.swift` + `Core/Strings+PersonalColor.swift` |
| `client/src/App.tsx` | `Features/Shared/RootView.swift` + `Core/AppState.swift` |
| `pages/*.tsx` | `Features/<模块>/*View.swift` |
| `outfit*.css` 的 clip-path | `Features/Outfit/PixelShapes.swift` |

后端接口一个没动。`/api/*` 路径与 `client/src/api.ts` 逐条对应。

## 手机适配（风格不变，只改布局和交互）

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 落地页 | 行李箱压在右下角，标题 56px | 单列：标题 → 行李箱 → 箭头按钮，拇指够得到 |
| 今日卡片 | 三栏网格 | 竖向堆叠，粗黑分隔线保留，仍是一个整体卡片 |
| 主导航 | 右侧磁贴栏 | 原生 Liquid Glass 悬浮底栏（iOS 26+；旧系统回退）：今天、行程、衣橱、我的、AI |
| 页面层级 | 全站 Header + 页面内文字返回 | Header 仅首页展示；顶级 Tab 无返回，详情页使用系统 Back 与左缘滑动 |
| 行程天气 | 三栏逐日卡片 | 单卡横滑分页，保留温度、降雨、UV 和风速 |
| 场景选择 | 无限轮播 + 左右箭头 | 分页横滑（触屏本来就该滑，克隆循环和箭头去掉） |
| 行程设置 | 左地图右日历 | 上下堆叠，各占满宽 |
| 总行程图 | 360pt 蛇形曲线 | 曲线原样保留，等比缩放到屏宽；上方加一排日期 chip |
| 每日行程 | 卡片挂在中央竖线两侧 | 竖线移到左边缘，卡片占满剩余宽度 |
| 穿搭总览 | 三栏 | 竖向：当日穿搭 → 行程信息 → 分日网格 |
| 打包清单 | 左侧竖向滑杆 | 顶部整宽横向滑杆 |
| 衣橱 | 扫码让手机拍照 | 直接调相机/相册（web 在手机浏览器下也是这条分支） |
| 个人档案 | 头像与四季型照片分析弹层 | 头像完整等比显示；相册选图后调用同一 `/api/personal-color/analyze` |
| 助手 | 悬浮面板 | sheet，跟随键盘 |

## 已知边界

- **字号是固定值**，和 web 端一样，不跟随动态字体。这是为了 §8 的排版比例不走样；
  无障碍依赖 VoiceOver（每个控件都有 label）和系统缩放。
- **地图用 OSM 官方瓦片**，和 web 端同源。官方瓦片只允许轻量使用，上线前要换自建或
  商业瓦片服务；右下角的归属声明是硬性要求，不要去掉。
- token 存 Keychain（web 端存 localStorage），这是 iOS 上的对应位置。

## 验证

这台机器上的 Xcode beta 当前位于 `/Applications/Xcode-beta.app`（Xcode 27.0，
build 27A5237l）。命令行可直接使用当前 `xcode-select`，或显式指定：

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild -project ios/SmartPack.xcodeproj -scheme SmartPack -destination 'platform=iOS Simulator,name=iPhone 17' build
```

回归测试：

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild -project ios/SmartPack.xcodeproj -scheme SmartPack -destination 'platform=iOS Simulator,name=iPhone 17' test
```

**当前状态：BUILD SUCCEEDED，测试通过，零项目警告**，并已在 iPhone 17 Pro 模拟器
（iOS 27.0）安装启动；原生 Liquid Glass 导航、穿搭紧凑布局与旧响应兼容均已验证。
