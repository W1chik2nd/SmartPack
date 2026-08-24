<p align="right">
  <a href="README.md">English</a> ·
  <b>简体中文</b>
</p>

# WearRoute（行装）— AI 场景化衣橱

> 行程交给天气,穿搭和行李交给 AI。

WearRoute 是一个 AI 驱动的衣橱与打包助手,只围绕一个承诺:**不用动脑,不会带错**。

## 它能做什么

大多数天气应用只告诉你气温,大多数时尚应用只给通用穿搭建议。WearRoute 更进一步:把你的**个人衣橱**、**穿衣偏好**、**行程场景**、**目的地天气**和**行李空间限制**揉在一起,生成可以照做的穿搭方案和打包清单。

出差前输入目的地和行程,WearRoute 一次性产出:

- 覆盖会议、通勤、晚餐等场景的每日完整穿搭组合
- 针对温差、下雨、强日照的调整方案
- 尽可能跨天复用单品的极简行李方案
- 旅行必备清单:雨伞、电源转换头、防晒霜、常备药等
- 出发前根据最新天气预报自动提醒增减物品

## 核心功能

| 功能 | 说明 |
|---|---|
| 数字衣橱管理 | 拍照或手动录入衣物,建立个人衣橱数据库,作为所有推荐的基础 |
| 穿衣偏好学习 | 学习风格偏好、忌讳与体感温度差异,推荐随使用越来越贴合本人 |
| 每日穿搭推荐 | 每天早上基于当日天气和现有衣橱,给出一套可直接穿出门的完整搭配 |
| 行程穿搭规划 | 按行程逐日、按场景(会议、通勤、晚餐、观光)生成穿搭方案 |
| 目的地天气调整 | 根据目的地温差、降雨、强日照动态调整方案 |
| 极简行李方案 | 最大化单品复用,用最少件数覆盖全部场景 |
| 旅行必备清单 | 自动生成非衣物清单:雨伞、转换头、防晒、药品 |
| 出发前智能提醒 | 监控天气预报变化,出发前提醒增减物品 |

完整用户画像与每个功能对应的 user story,见 [docs/personas-and-user-stories.md](docs/personas-and-user-stories.md)。

## 适合谁用

- **商务出差者**:在会议、通勤、晚餐之间切换,带错衣服代价很高
- **每日通勤族**:不想为穿什么费神,也不想被天气打个措手不及
- **旅行爱好者**:希望在有限箱包空间里每天都有新搭配
- **极简主义者**:用最少的单品覆盖最多的场景
- **家庭出行规划者**:要为全家人打理衣物和用品

## 商业模式

WearRoute 把天气提醒、穿搭推荐和打包清单整合成一项个性化决策服务。

- **订阅制**:核心功能免费;高级功能(多行程管理、家庭成员、更深度的个性化、无限次方案生成)需要会员
- **精准推荐**:当应用识别到用户衣橱或旅行装备确实存在缺口时,推荐可购买的商品并获取佣金 —— 只在真正相关时出现,并明确标注

## 技术栈

架构铁律是**薄客户端 + 厚后端**:推荐算法、天气对接、行李优化、业务规则一律放在 API 侧,Web 端和 iOS 端只负责展示。完整工程规约见 [AGENTS.md](AGENTS.md)。

| 层次 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript 5.9 + Vite 5 | 单页应用,手写 CSS,包豪斯风格主题 token(统一背景 `#CAF5F7`) |
| 双语界面 | `client/src/i18n` 自建 i18n | 中英文案 + `LangProvider`;选择写入 `localStorage`,并同步到 `<html lang>` |
| 后端 | Node 22.x + TypeScript | 原生类型剥离(`--experimental-strip-types`),直接用 `node:http`;单进程同时托管构建后的前端和 `/api/*` |
| 数据库 | 本地用内置 `node:sqlite` 的 SQLite,生产用 `pg` 连接 Neon 上的 PostgreSQL | 本地开发自动创建 `server/data/wearroute.db`;`migrate:sqlite` 负责把本地数据导入 Postgres |
| 认证 | `node:crypto` 的 scrypt + 每用户独立 salt,不透明 session token | 密码不会以明文存储 |
| 共享类型 | `shared/*.ts` | 穿搭、打包、衣橱、天气、行程约束等类型,全栈共用 |
| 原生 iOS | SwiftUI,iOS 17+ | 对齐 Web 端页面、调同一套 API、不含业务逻辑 —— 见 [ios/README.md](ios/README.md) |
| 测试 | 内置 `node:test` 运行器,加自研渲染 / 布局探针 | 不引入测试框架依赖 |

### 外部服务

| 服务 | 用途 | 是否需要 key |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | 目的地天气预报 | 否 |
| [Nominatim / OpenStreetMap](https://nominatim.org) | 地点搜索与地理编码 | 否 |
| OpenAI 兼容大模型 | 聊天助手与旅行规划 Agent(Responses API、联网搜索、结构化输出) | `AI_API_KEY` |
| 视觉模型(默认百炼 `qwen-vl-plus`,OpenAI 兼容) | 照片识别衣物 | `VISION_API_KEY` |
| Unsplash / Pexels / Openverse | 行程卡片的景点配图(Openverse 免 key) | 可选 |
| 京东 / 淘宝联盟 API | “搜同款”商品推荐 | 可选 |

所有 key 本地放在 `server/.env`(已 gitignore),生产放在 Render 控制台 —— 绝不要写进客户端代码。

## 文档

- [用户画像与 User Story](docs/personas-and-user-stories.md)
- [AGENTS.md](AGENTS.md) —— 工程规约与架构铁律
- [ios/README.md](ios/README.md) —— 原生客户端结构与真机配置

## 开发上手

仓库里包含 WearRoute 的 Web 应用、Node API、原生 iOS 客户端,以及本地 SQLite / 生产 PostgreSQL 两套持久化。

### 目录结构

```
client/   React + TypeScript + Vite 前端(页面、组件、i18n、主题)
server/   Node + TypeScript API —— 本地 SQLite,生产 Neon 上的 PostgreSQL
ios/      原生 SwiftUI 客户端 —— iOS 17+,调用同一套 API
shared/   全栈共用的 TypeScript 类型
scripts/  开发启动脚本,以及渲染与布局校验探针
docs/     产品文档(用户画像、user story)
```

### 环境要求

- Node.js 22.6+(用到内置的 `node:sqlite` 模块和类型剥离)
- npm —— 客户端和服务端都是 npm workspace
- 可选的原生 iOS 客户端需要 Xcode 17+

### 运行

在仓库根目录一条命令同时启动 API 服务(4177 端口)和前端(5177 端口):

```sh
npm install   # 仅首次需要
npm run dev   # 服务端 + 客户端;打开 https://localhost:5177
```

API 服务会为本地开发自动创建 `server/data/wearroute.db`。Vite 开发服务器使用自签证书跑 HTTPS 并监听局域网,因为手机拍照录入衣物必须在安全上下文中进行 —— 首次访问在浏览器里点“继续访问”即可。

### 验证

```sh
npm test   # 服务端测试 + 客户端测试 + 渲染检查 + 布局探针
npm run build
```

### 原生 iOS 应用

SwiftUI 应用位于 `ios/`,和 Web 端调用同一套 API。目录结构、Web 到 iOS 的页面对应关系、后端配置与真机设置见
[ios/README.md](ios/README.md)。

在本地模拟器构建:

```sh
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild \
  -project ios/SmartPack.xcodeproj \
  -scheme SmartPack \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build
```

### AI 助手(可选)

首页的聊天助手由 `/api/chat` 提供支持。启用它需要给服务端配一个 API key:

```sh
cp server/.env.example server/.env
# 编辑 server/.env 填入 AI_API_KEY(OpenAI 兼容供应商都可用;
# 换供应商改 AI_BASE_URL / AI_MODEL —— 文件里有注释说明)
```

`server/.env` 已被 gitignore,**绝不要提交真实 key**。仓库里默认的助手模型是 `gpt-5.6-terra`,本地需要时用 `AI_MODEL` 覆盖。没有 key 时该接口返回 503,聊天会给出明确的“未配置”提示,其余功能照常工作。

<details>
<summary>分开启动两个进程(可选)</summary>

```sh
# 终端 1 —— API 服务
cd server
node --experimental-strip-types index.ts

# 终端 2 —— 前端
cd client
pnpm install
pnpm dev
```

</details>

注册账号存在 SQLite 中(密码用 scrypt 哈希),登录时与数据库校验。Vite 开发服务器把 `/api/*` 代理到 API 服务。

## 部署到 Render + Neon

把整个仓库部署为一个 Render Web Service。Node 进程同时托管构建后的 React 应用和 `/api/*`,因此浏览器自动使用 Render 的域名,客户端里不会嵌入任何公开的 API key。

Render 设置如下:

```text
Runtime: Node
Branch: main
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/health
```

在 Render 中配置这些仅服务端可见的环境变量:

```text
DATABASE_URL=<Neon 的 pooled PostgreSQL 连接串>
DATABASE_SCHEMA=wearroute
DATABASE_POOL_SIZE=5
AI_API_KEY=<供应商 key>
AI_BASE_URL=<OpenAI 兼容的接口地址>
AI_MODEL=<模型名>
TRIP_AGENT_MODEL=<可选,覆盖旅行 Agent 的模型>
VISION_API_KEY=<视觉供应商 key>
VISION_BASE_URL=<视觉接口地址>
VISION_MODEL=<视觉模型名>
PHOTO_PROVIDER=<unsplash|pexels|openverse>
UNSPLASH_ACCESS_KEY=<可选>
PEXELS_API_KEY=<可选>
```

`DATABASE_SCHEMA=wearroute` 用于在 Neon 数据库与其他项目共用时隔离本应用的表。只配置真正用到的可选服务。**永远不要**把密钥配成 `VITE_*` 变量。

需要把本地数据迁移过去时,在 shell 里用同一个 Neon 连接串跑一次(不要提交进 Git):

```sh
DATABASE_URL='postgresql://…' npm run migrate:sqlite --workspace wearroute-server
```

该迁移是幂等的,默认读取 `server/data/wearroute.db`。要从其他位置导入数据库时,设置 `SQLITE_PATH`。

## 当前状态

项目正在活跃开发中。Web 端与原生 iOS 端目前已覆盖账号、个人档案、衣橱、行程生成、行程视图、穿搭渲染和打包清单。两端都提供中英文两套文案,并支持应用内一键切换。
