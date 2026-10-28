# Cocos 构建与抖音导入记录

日期：2026-10-28。当前1.1.0、题库0.6.0/schema4.1.0已完成真实Cocos双目标构建与包核验。自动结果以实际版本的 `artifacts/build/*.result.json` 和 `*.manifest.json` 为准；编译通过与实际运行分别记录，旧构建不证明新源码已通过。

## 开发环境

- 引擎：本机 Cocos Creator **3.8.8**，与 `game/package.json` 一致。
- 项目：`game/`。入口场景：`assets/scenes/Boot.scene`；场景 UUID：`c9a7eca9-0b99-43f9-a12f-783b070b91bc`。
- 界面：引擎原生 Graphics、Label、Sprite、Tween、Audio；没有另写一份网页游戏来代替抖音客户端。
- 裁剪引擎模块：2D、UI、Graphics、Tween、Audio、Base、WebGL 与内置渲染管线。
- 本机抖音开发者工具：4.5.6。项目窗口、编译和官方预览按 `douyinide` CLI工作流操作。

## 可重复命令

从仓库根目录运行：

```sh
node tools/build/build-cocos.mjs web-mobile
node tools/build/inspect-build.mjs web-mobile
node tools/build/build-cocos.mjs douyin
node tools/build/inspect-build.mjs douyin
node tools/build/stage-douyin.mjs
node tools/douyin/project.mjs check
```

脚本默认查找本机安装的 3.8.8，可用 `COCOS_EDITOR` 指定同版本的官方可执行文件。Cocos CLI 使用 macOS 图形会话，受限沙箱可能需要正常的应用执行授权。成功退出码为 **36**；构建脚本将该退出码和实际入口文件共同判定为成功，向调用者返回 0。

`tools/build/douyin.json` 已配置用户提供的真实 AppID `ttad3cdb8133424e0102`。如需临时覆盖，可通过 `DOUYIN_APP_ID` 环境变量传入，覆盖配置生成在本地产物目录。包检查会核对输出 AppID 与本次构建输入相同。首轮探测时未配置 AppID，Cocos 自身写入了 `testappId`；该探测包不作为最终交付。

## 产物

| 用途 | 目录 | 入口 |
| --- | --- | --- |
| 同源 Cocos Web 测试包 | `game/build/web-mobile/` | `index.html` |
| Cocos抖音临时输出 | `game/build/bytedance-mini-game/` | 重建期间可能被清空，不能长期导入 |
| 唯一抖音导入包 | `releases/douyin/` | 核验后更新，根目录含`game.js`、`game.json`、`project.config.json` |
| 完整编译日志 | `artifacts/build/` | `web-mobile.log`、`douyin.log` |
| 编译与输入摘要 | `artifacts/build/` | `*.result.json` |
| 包结构与每文件 SHA-256 | `artifacts/build/` | `*.manifest.json` |

Web 测试包与抖音包来自同一 Cocos 场景、同一业务脚本与同一百关数据。Web 包用于便捷体验；抖音专有接口仍须在开发者工具或真机验证。

## 1.1.0 真实构建结果

| 目标 | 官方CLI | 源码与配置 | 结果 |
| --- | --- | --- | --- |
| web-mobile | 退出码36 | 构建期间未变化 | 成功，包内0.6题库精确一致 |
| bytedance-mini-game | 退出码36 | 构建期间未变化 | 成功，47文件，9,468,532字节，约9.03MiB |

两个目标构建输入摘要相同：`7d267fc2be114e5c3eb792a56ef8f1cd4d18b36b07ab70e80d0d0d74a3eb3a6f`。源题库、同步运行资源与包内编译数据一致，题库SHA-256为：

```text
2ff7a3e95f038db4da5a0e2c415f61ad46f69f3a99e6362ed94c4b9db74dab4c
```

胜利插画和WinPanel已进入本轮构建，实际Web已查看。唯一导入目录 `releases/douyin` 已按清单逐文件核验更新，AppID为 `ttad3cdb8133424e0102`；没有保留冗余历史导入包。构建结果、日志与逐文件摘要见 `artifacts/build/`。

本轮100项自动回归、严格TS、42组布局及百关内容检查通过。Web已操作新版首关、非原槽交叉收回、正确通关、差额积分和短屏胜利卡，见[UI_TEST_REPORT.md](UI_TEST_REPORT.md)。官方工具已确认固定microgame窗口ID2、编译后首页正常且当前控制台无error级记录；[1.1.0官方预览](https://t.zijieimg.com/iXW53KtN/)已生成。启动链与回执见[UI验收](UI_TEST_REPORT.md)。预览按路径读取磁盘包，无协议级窗口编译revision绑定；完整原生交互、真机、真实广告和上线审核不在本次构建结论内。

## 历史构建：1.0.0 / 0.5.0

此前官方Cocos Web和抖音均成功（退出码36），抖音44文件、7,835,105字节，约7.47MiB，AppID正确，逐文件摘要检查通过。原有操作截图和官方预览回执位于 `artifacts/release-1.0.0/`。这些事实保留为历史，不将对应体积、摘要、截图或链接标成1.1.0产物。

## 官方依据

- [Cocos 3.8 命令行发布与退出码](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html)
- [Cocos 3.8 发布到抖音小游戏](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-bytedance-mini-game.html)
