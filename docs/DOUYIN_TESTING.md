# 抖音小游戏导入与测试

日期：2026-10-28。当前源码 `1.1.0`，Cocos Creator `3.8.8`，目标 `bytedance-mini-game`。0.6.0/schema4.1.0已通过构建与包核验，抖音工具编译后首页和本轮官方预览均已取证。本文不表示项目已提审或上线，旧1.0.0结果单独标记。

## 唯一导入目录

开发者工具只导入以下目录：

```text
/Users/limingrui/IdeaProjects/shisezhijian/releases/douyin
```

`releases` 仅保留这个已更新到1.1.0的导入目录，逐文件核验通过，没有冗余历史包。本轮47文件、9,468,532字节，约9.03MiB；AppID为 `ttad3cdb8133424e0102`，根目录含 `game.js`、`game.json`、`project.config.json`。输入摘要、文件字节数和SHA-256见 `artifacts/build/douyin.manifest.json`。

`game/build/bytedance-mini-game` 是临时构建输出，重建时可能被清空；不要把它作为开发者工具的长期导入目录，也不要导入Cocos源工程。构建完成后由 `node tools/build/stage-douyin.mjs` 核验并更新唯一交付目录，清理旧包。构建文件检查不能替代模拟器运行检查。

## 内容与规则契约

唯一运行题库为 `data/levels/levels.v0.6.json`，schema4.1.0/content0.6.0，玩法click-fill，输入tap。本轮源文件、同步运行资源与包内题库精确一致，SHA-256：`2ff7a3e95f038db4da5a0e2c415f61ad46f69f3a99e6362ed94c4b9db74dab4c`。

上方为固定提示与空缺渐变轨道，下方是受约束洗牌的候选。先选色再点空槽；已填色块可收回任意空候选槽，无永久归还绑定。槽位不自动压缩，点睛先提正确块腾空，再将错占位收回可用候选空槽。前12关扩大结构，第13关起保持认可基线；洗牌禁止目标正序/倒序并检查错位、连续段和相邻对质量。

100关全部倒计时，时间用尽失败；可免费重开，或自愿完整观看视频续玩30秒，每局最多两次。通关表现积分购买点睛、窥色、续时，初始各1。结算视频追加本次入账与缺货补充库存分别通过幂等奖励账本处理。新版本前12关使用expanded-0.6成绩代次，保留旧钱包权益。

用户已与抖音确认适龄 **8+**，加载页按此显示标识并保留健康游戏忠告与适龄说明。该确认不代表防沉迷相关平台配置、正式审核或发行手续已经完成。

## 官方开发者工具工作流

当前工作流使用官方 `douyinide` CLI。每轮先按固定目录查询真实窗口再编译取证；本轮已确认microgame窗口ID2，编译后首页与控制台取证范围如下，不把开窗成功直接写成完整游戏交互通过。不使用IDE私有接口、调试端口、账户数据库或系统UI自动化。

同一任务客户端名固定为 `Codex`。命令参数以当前 `douyinide <command> -h` 为准。首先读取状态和真实窗口列表：

```bash
douyinide check-ide-status -c Codex
douyinide get-project-windows-info -c Codex
```

`ideOnline` 与 `loginExpired` 分开判断；连接权限错误不能直接归为未登录。命令存在但明确提示IDE未运行时，可执行一次 `douyinide start-ide`。客户端授权或登录由用户在官方工具内完成，不替换客户端名称绕过授权。

已有目标窗口直接复用。只有窗口列表中未打开固定项目时才执行：

```bash
douyinide open-project-window -c Codex --path '/Users/limingrui/IdeaProjects/shisezhijian/releases/douyin' --type microgame
```

随后重新查询窗口列表，按项目绝对路径记录真实 `windowId`。本项目为小游戏，默认Lite模式；以下命令中的 `<实际窗口ID>` 必须替换为列表返回的真实值，同一次验证持续使用同一个窗口：

```bash
douyinide simulator-compile -c Codex --window-id '<实际窗口ID>'
douyinide miniapp-image-screenshot -c Codex --window-id '<实际窗口ID>'
douyinide miniapp-get-console-messages -c Codex --window-id '<实际窗口ID>'
```

编译命令成功仅表示已触发，不能替代画面与状态验证。小游戏只有Canvas，不使用小程序Page、selector、页面栈或 `backendId`。需要交互验收时，必须保留操作前截图、返回的缩放信息、同类状态探针基线、换算后的CSS坐标、操作返回、操作后截图和状态增量。优先读取项目主动暴露的调试状态，也可比较新增console或network记录。视觉与状态均符合预期才判定通过；没有可用探针时记录未确认。

截图未指定保存位置时使用CLI默认临时目录并记录实际返回路径。刷新、编译、动画重排、尺寸变化或窗口重建后，重新取截图和基线，不能沿用旧坐标。不要仅凭命令退出0、旧截图或历史日志认定当前版本通过。

旧封装的只读包检查仍可使用：

```bash
node tools/douyin/project.mjs check
```

该检查默认固定目录，只检查包结构与配置；主导入、编译和预览流程使用官方 `douyinide`。

## 真机预览与上线的区别

预览需要有效登录、当前账号对AppID有权限，以及平台接受本地代码包。对固定路径生成预览链接：

```bash
douyinide create-preview-qrcode -c Codex --path '/Users/limingrui/IdeaProjects/shisezhijian/releases/douyin'
```

成功后使用官方返回的 `link`；失败时保留原始错误，不编造测试链接。需要二维码文件时可按实际需求传 `--output`，未指定保存位置时使用系统临时目录。若针对已验收窗口预览，可使用 `douyinide preview -c Codex --window-id '<实际窗口ID>'` 并核对返回。

小游戏只传适用的 `--minigame-*` 启动参数，不传小程序页面路径。路径预览会重新读取磁盘项目，CLI没有可绑定窗口编译的统一revision；不能声称二维码产物与刚验收的内存运行状态具有协议级版本一致性。

预览不等于上传、提审、审核通过或正式上线。本机Web链接 `http://127.0.0.1:7468/` 依赖预览服务运行，仅用于辅助浏览器验证，也不是抖音真机预览链接。手机抖音运行须另建真机验收记录。

## 真实广告待接入

用户尚未开通激励视频广告位，暂未提供 `adUnitId`。它与已有AppID不同；配置位置为 `game/assets/scripts/application/RuntimeConfig.ts` 的 `rewardedAdUnitId`。待用户提供后再填入并重新构建，现阶段保留完整入口、失败复活、补货及追加积分结算接口。

抖音环境广告位为空时必须明确提示不可用，不能伪造观看成功、发奖或消耗成功次数。取消、未完整观看、SDK错误、超时均不发奖。SDK模拟对象仅用于自动测试；正式运行包没有模拟广告入口，也不把模拟结果视为真实投放验收。拿到广告位后还需实际检查完整观看、提前关闭、网络失败、重复回调、前后台切换与晚到奖励。

## 1.1.0 已验证范围

核心48、应用20、平台32，共100项通过；百关1,795次逐秒证解与恢复、严格TS、42组布局（最小色块44.33）、数据/色彩/seed0错误、31项损坏探针拒绝、图鉴18项模拟DOM均通过，重复生成字节一致。真实Cocos双目标退出36成功，输入稳定，47文件抖音包已经更新固定目录。

Web实际完成5候选首关、色块1/2收回候选槽2/1、正确通关164分、余额104→268、回玩182分仅补18差额，并检查390×694专用胜利卡。未配置广告位点击双倍保持Won和余额268，不发奖。截图与状态见[UI验收](UI_TEST_REPORT.md)。

官方CLI已启动工具，窗口列表确认固定 `releases/douyin` 的microgame窗口ID2；同窗口编译后获取786×1704截图（CSS393×852、2×），首页正常无文字重叠，当前控制台无error级记录，仅引擎/场景信息与触摸verbose警告。[启动取证链](../artifacts/release-1.1.0/douyin-startup-visual.json)已保存。

[本轮官方预览](https://t.zijieimg.com/iXW53KtN/)已生成，`ok:true`，[回执](../artifacts/release-1.1.0/official-preview.json)对应固定磁盘包。路径预览没有与窗口编译revision的协议绑定；原生取证只确认启动与首页，未断言完整原生交互、手机或真实广告。未提审、未上线。

## 历史证据

1.0.0 / 0.5.0曾有85项自动回归、Cocos双目标与部分Web经营闭环验证，以及窗口ID2首页截图和[旧版官方预览](https://t.zijieimg.com/iXW5DBaP/)。旧证据保留于 `artifacts/release-1.0.0/`，见[UI记录](UI_TEST_REPORT.md)历史部分；不代表本轮原生或真机通过。未提审、未上线。
