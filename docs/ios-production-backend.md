# WearRoute iOS 连接已部署后端

本文说明如何让 WearRoute 原生 iOS App 从本地后端切换到已部署的生产后端。

## 前提

- 已部署服务有公网 HTTPS 地址 `https://wearroute.onrender.com`。
- 服务的健康检查接口可以访问。
- iOS App 与 Web 共用同一套 `/api/*` 接口，不需要单独部署 iOS 后端。

## 1. 检查部署服务

在浏览器打开下面的地址，将示例域名替换成实际部署域名：

```text
https://wearroute.onrender.com/api/health
```

也可以在终端检查：

```bash
curl -i https://wearroute.onrender.com/api/health
```

正常结果应为 HTTP `200`，响应内容为：

```json
{"ok":true,"service":"wearroute"}
```

如果这里无法访问，应先检查部署平台的构建、启动命令和运行日志，iOS 端暂时无法连接。

## 2. 配置 iOS 后端地址

打开 `ios/Config/Info.plist`，找到：

```xml
<key>SmartPackAPIBaseURL</key>
<string>http://192.168.67.230:4177</string>
```

将其改为部署服务的 HTTPS 根地址：

```xml
<key>SmartPackAPIBaseURL</key>
<string>https://wearroute.onrender.com</string>
```

注意：

- 使用 `https://`。
- 不要在末尾添加 `/api`，App 会自动请求 `/api/login`、`/api/trip-plans` 等路径。
- 不要填写 Render 控制台地址、Neon 数据库地址或前端预览地址。
- 如果 Web 与 API 由同一个 Render Web Service 提供，就填写浏览器打开 WearRoute 网站时使用的域名。

## 3. 清理开发期 HTTP 例外

生产服务使用 HTTPS，不需要 `Info.plist` 中为局域网 HTTP 设置的
`NSAppTransportSecurity` 和 `NSExceptionDomains`。切换为只连接生产环境后，可以删除整个
`NSAppTransportSecurity` 字典。

如果仍需要偶尔连接电脑上的本地后端，可以暂时保留这些例外；它们不会阻止 HTTPS 请求。

## 4. 重新编译并安装

`Info.plist` 会打包进 App，修改后必须重新编译并安装。打开工程：

```bash
open ios/SmartPack.xcodeproj
```

在 Xcode 中：

1. 选择 `SmartPack` scheme。
2. 选择已信任的 iPhone 或 iPhone 模拟器。
3. 点击 Run，或按 `⌘R`。

也可以先用模拟器执行命令行构建：

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild \
  -project ios/SmartPack.xcodeproj \
  -scheme SmartPack \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build
```

已安装的旧版本仍然使用旧地址，必须安装这次重新构建的版本。

## 5. 首次连接注意事项

- 生产环境使用 Neon/PostgreSQL，与电脑本地 SQLite 数据库不是同一份数据；本地账号可能需要在生产环境重新注册。
- App 的登录令牌保存在 iOS 钥匙串。如果切换后端后一直收到 `401`，退出登录后重新登录；必要时删除 App 后重新安装。
- Render 免费实例休眠后，第一次请求可能需要等待几十秒，后续请求会恢复正常。
- 手机可以使用 Wi-Fi 或蜂窝网络访问 HTTPS 生产服务，不需要与电脑处于同一局域网。
- 原生 iOS 请求不受浏览器 CORS 限制。

## 6. 功能环境变量

基础登录、衣橱和行程数据依赖数据库配置。AI、识图和景点图片还需要在部署平台配置相应的服务端环境变量，例如：

```text
DATABASE_URL
DATABASE_SCHEMA
AI_API_KEY
AI_BASE_URL
AI_MODEL
VISION_API_KEY
VISION_BASE_URL
VISION_MODEL
PHOTO_PROVIDER
```

这些值只能放在 Render 等部署平台的服务端环境变量中，不要写入 `Info.plist` 或 Swift 代码。

## 故障排查

| 现象 | 检查项 |
| --- | --- |
| `/api/health` 无法打开 | 检查部署状态、启动命令、端口和部署日志 |
| App 仍显示局域网地址 | 确认修改的是 `ios/Config/Info.plist`，然后重新编译安装 |
| `The Internet connection appears to be offline` | 检查域名拼写、HTTPS 证书和手机网络 |
| HTTP `401` | 退出登录并使用生产环境账号重新登录或注册 |
| HTTP `503` 或 AI 不可用 | 检查生产环境的 AI/视觉模型密钥和服务日志 |
| 首次请求很慢 | 等待 Render 实例从休眠状态启动，再重试 |
