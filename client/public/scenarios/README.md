# 场景卡片图片

放在这里的图片对应后端 `/api/scenarios` 返回的 `image` 路径,文件名要一致:

- `commute.jpg` — 通勤
- `travel.jpg` — 旅行
- `business.jpg` — 出差
- `date.jpg` — 约会
- `sport.jpg` — 运动
- `formal.jpg` — 正式场合

暂时没有图片也没关系:卡片会退化成纯色占位块(见 `Home.tsx` 的 `onError`
处理和 `styles.css` 里 `.scenario-image` 的占位背景)。补图片时只需把同名文件
丢进这个目录,前端无需改动。
