# 抖音小游戏导入与测试

本项目使用 Cocos Creator 的 `bytedance-mini-game` 构建目标。传入抖音开发者工具的是构建目录，目录内必须存在 `game.js`、`game.json` 和 `project.config.json`。不要导入 Cocos 源工程，也不要把 Cocos Web 预览链接称为抖音小游戏预览。

## 本机环境与官方接口

2026-10-27 检查：本机安装了 `/Applications/抖音开发者工具.app`，版本 **4.5.6**。官方小游戏命令行包是 `tt-minigame-ide-cli`，项目内固定为 **2.1.2**。不使用 IDE 私有接口、调试端口、账号数据库或系统 UI 自动化。

工具依赖只安装在 `tools/douyin/node_modules`，不改全局 Node 环境：

```bash
npm ci --prefix tools/douyin --ignore-scripts
```

本轮已实际安装并执行 `tmg --help`、`tmg open --help`、`tmg preview --help`；公开的 `checkSession()` 返回未确认有效登录。封装会压缩第三方错误日志，避免第三方网络报错展开请求对象。

官方依据：[小游戏命令行调用](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/development-assistance/ide-cli)、[小游戏开发工具概览](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/mini-app-developer-instrument)。

## 导入构建产物

请导入当前 UI 测试包 `0.2.0-ui.1`：`releases/douyin-test-33977f449933`。该目录包含完整的 44 个构建文件，约 9.76 MiB，AppID 为 `ttad3cdb8133424e0102`，不会被下一次 Cocos 构建清空。已接入 image 加载/首页插画与公共图标，首次进入首页。旧的 `game/build/bytedance-mini-game` 是临时构建输出；构建期间开发者工具可能报 `project.config.json` 的 ENOENT 错误。

2026-10-27 白屏修复：旧包 `douyin-test-1a7d6e8ac4ff` 的 `BrowserTestBridge` 误把抖音适配器的 `document` 当作完整浏览器 DOM，调用 `replaceChildren()` 时阻断 Boot 初始化。修复为先检查 Cocos `sys.isBrowser`，小游戏环境完全跳过 DOM 辅助层。官方 Cocos 3.8.8 重建成功（退出码 36），平台测试 26 项通过，其中两项覆盖此环境隔离与浏览器原有行为；仍需开发者工具重新导入新包确认运行。

在抖音开发者工具中关闭旧项目，重新导入上述独立目录，选择小游戏，再重新编译。文件结构检查已通过，模拟器运行仍需在开发者工具中确认；若仍然白屏，应查看调试器 Console 的第一条红色错误。

后续构建完成后执行 `node tools/build/stage-douyin.mjs`，脚本先核验构建，再复制并逐文件校验 SHA-256，最后公布新的独立目录；已交付的目录不覆盖。

构建成功后，从仓库根目录运行：

```bash
node tools/douyin/project.mjs check
node tools/douyin/project.mjs open
```

工具会在 `game/build` 内寻找抖音构建目录；如果有多个目录，应在命令后传入本次构建的绝对路径。`check` 只验证必要文件与配置存在，不代表 IDE 编译通过。`open` 使用官方 `open({ project: { path, mode: 'lite' } })` 发出打开请求；仍应区分“已发出打开请求”“IDE 已编译”和“真机已验收”。

## AppID 与登录

正式 AppID 应属于本项目，开发者账号需有对应权限。开发工具提供的测试号也可用于预览调试，但不能上传发布。工具不会猜测 AppID、借用别的游戏 ID 或搜索用户的私人项目。

生成官方预览前，需要 `project.config.json` 配有有效 AppID（正式或工具分配的测试号），并且官方 CLI 登录有效。IDE 和 CLI 的登录状态可能不同。可只读检查 CLI 状态：

```bash
node tools/douyin/project.mjs session
```

检查结果只输出是否有效，不输出账号名称或凭据。如果未登录，由开发者使用官方交互登录完成；不在聊天或命令参数中填写密码：

```bash
tools/douyin/node_modules/.bin/tmg login
```

## 生成抖音真机测试入口

```bash
node tools/douyin/project.mjs preview
```

此命令调用官方 `preview` 接口创建测试预览，**不会调用上传发布、提审或上线接口**。成功才会生成：

- `artifacts/douyin-preview/preview.png`：手机抖音扫一扫使用的二维码。
- `artifacts/douyin-preview/preview.json`：官方返回的 `shortUrl`、`expireTime` 与生成时间。

预览链接有有效期，应使用实际返回值；没有接口成功结果时不能编造测试链接。扫码账号权限与具体错误以抖音平台返回和开发工具提示为准。

## 本次测试包体积

2026-10-27 当前 UI 构建 `game/build/bytedance-mini-game` 有 44 个文件，总体积约 9.76 MiB（精确字节见 `artifacts/build/douyin.manifest.json`）。新插画与图标已打入包内；此抖音包不再输出 source map，保留调试日志。Web 调试包仍保留 source map。

[抖音普通代码包文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/basic-function/subpackages/introduction) 区分未分包整包 20 MB 与分包时的主包 4 MB。项目内官方 CLI 2.1.2 的代码核验按文件原始字节大小累加，并从体积统计中排除 `**/**.js.map`；其新链路也会向平台获取动态限额，不能用静态文档代替平台最终返回。`.map` 仍属于 CLI 打包白名单，因此“排除体积统计”不等于“不上传”。本次包低于 CLI 新链路 16 MB 的默认回退总包限额，无须仅为这个体积问题重构分包；是否可正常预览仍需实际登录、AppID 和云端编译结果确认。

## 测试范围

优先检查：首页进入、点击候选颜色再点击空槽、取回和改放、固定提示色不可操作、完成判定、保存恢复、第五关起的步数、道具与失败状态。广告位未配置时必须显示真实不可用状态；本地模拟广告成功不能算正式广告验收。

Web 构建可辅助桌面操作检查，但 Cocos Web 的链接、截图或自动化结果都不替代抖音开发工具编译、手机抖音真机运行与正式广告验证。
