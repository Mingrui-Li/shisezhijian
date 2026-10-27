# Cocos 构建与抖音导入记录

本文记录真实编辑器构建，自动结果以 `artifacts/build/*.result.json` 和 `*.manifest.json` 为准。编译通过与实际运行验收分别记录。

## 开发环境

- 引擎：本机 Cocos Creator **3.8.8**，与 `game/package.json` 一致。
- 项目：`game/`。入口场景：`assets/scenes/Boot.scene`；场景 UUID：`c9a7eca9-0b99-43f9-a12f-783b070b91bc`。
- 界面：引擎原生 Graphics、Label、Sprite、Tween、Audio；没有另写一份网页游戏来代替抖音客户端。
- 裁剪引擎模块：2D、UI、Graphics、Tween、Audio、Base、WebGL 与内置渲染管线。
- 本机抖音开发者工具：4.5.6。导入使用官方 `tt-minigame-ide-cli`。

## 可重复命令

从仓库根目录运行：

```sh
node tools/build/build-cocos.mjs web-mobile
node tools/build/inspect-build.mjs web-mobile
node tools/build/build-cocos.mjs douyin
node tools/build/inspect-build.mjs douyin
node tools/douyin/project.mjs open
```

脚本默认查找本机安装的 3.8.8，可用 `COCOS_EDITOR` 指定同版本的官方可执行文件。Cocos CLI 使用 macOS 图形会话，受限沙箱可能需要正常的应用执行授权。成功退出码为 **36**；构建脚本将该退出码和实际入口文件共同判定为成功，向调用者返回 0。

`tools/build/douyin.json` 已配置用户提供的真实 AppID `ttad3cdb8133424e0102`。如需临时覆盖，可通过 `DOUYIN_APP_ID` 环境变量传入，覆盖配置生成在本地产物目录。包检查会核对输出 AppID 与本次构建输入相同。首轮探测时未配置 AppID，Cocos 自身写入了 `testappId`；该探测包不作为最终交付。

## 产物

| 用途 | 目录 | 入口 |
| --- | --- | --- |
| 同源 Cocos Web 测试包 | `game/build/web-mobile/` | `index.html` |
| 导入抖音开发者工具 | `game/build/bytedance-mini-game/` | `game.js`、`game.json`、`project.config.json` |
| 完整编译日志 | `artifacts/build/` | `web-mobile.log`、`douyin.log` |
| 编译与输入摘要 | `artifacts/build/` | `*.result.json` |
| 包结构与每文件 SHA-256 | `artifacts/build/` | `*.manifest.json` |

Web 测试包与抖音包来自同一 Cocos 场景、同一业务脚本与同一百关数据。Web 包用于便捷体验；抖音专有接口仍须在开发者工具或真机验证。

## 当前验收边界

- 首轮 Web 基线已由真实 Cocos CLI 构建成功，退出码 36。它只证明工程能够进入正式构建流程，开发期间的基线不作为最终版本。
- 最终构建会在源码停止修改后重跑，并检查构建期间输入摘要没有变化。
- `open` 返回成功只表示已向抖音开发者工具发出打开请求，不能代替模拟器编译和画面验收。
- 抖音预览链接须由官方 `preview` 接口返回真实 `shortUrl`；登录、AppID 或测试号未就绪时不生成替代链接冒充抖音预览。
- 编译、包检查不代表真机触控、音频、前后台、真实激励视频或上线审核已通过。

## 官方依据

- [Cocos 3.8 命令行发布与退出码](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html)
- [Cocos 3.8 发布到抖音小游戏](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-bytedance-mini-game.html)
