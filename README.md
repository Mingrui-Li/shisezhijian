# 拾色之间

竖屏颜色填空小游戏，目标平台为抖音小游戏。**五章100关，先点击下方色块，再点击上方空槽填入。** 开局只有固定提示色块；取回、改放、撤销、有限道具和失败复活均围绕点击填空实现。

当前为 Cocos Creator 3.8.8 + TypeScript 的 `0.2.0-ui.1` 测试版。已正式构建 Web 与抖音小游戏，接入 image 生成的加载插画、首页插画和 12 个公共图标；首次进入首页，教程独立。Web 已完成实际页面操作与截图检查，抖音新包的模拟器及真机仍需确认。实际状态见[开发状态](docs/DEVELOPMENT_STATUS.md)和[本轮UI验收](docs/UI_TEST_REPORT.md)。

最新抖音导入目录：`releases/douyin-test-33977f449933`。本机 Web 测试入口：`http://127.0.0.1:7468/`（须运行本地预览服务）。

- [游戏设计](docs/GAME_DESIGN.md)：唯一现行玩法、点击细则、五章阶梯、预算、道具与商业闭环。
- [开发计划](docs/DEVELOPMENT_PLAN.md)：从首关闭环到百关和抖音发布的验收门槛。
- [美术与界面](docs/ART_DIRECTION.md)：轻暖无衬线、上轨道下候选、公共组件与精确色面。
- [自然配色](docs/COLOR_SYSTEM.md)：保留已认可的百关HEX与自然主题。
- [当前题库](data/levels/levels.v0.4.json)、[内容契约](docs/levels/README.md)、[百关图鉴](docs/levels/atlas.html)、[逐关目录](docs/levels/catalogue.md)。
- [点击填空视觉参考](assets/design/shisezhijian-tap-fill-ui-v1.png)、[真实数据开局示意](assets/reviews/colors/click-fill-openings-v0.4.png)、[视觉参数](assets/design/design-tokens.json)。
- [纯核心测试报告](docs/CORE_TEST_REPORT.md)、[Cocos工程](game/README.md)。

现行文件只保留这一套设定。旧策划、错误玩法图稿、旧题库及配套归档已删除；不通过并列版本继续维护。认可目标色与拓扑的作者源在 `data/levels/source/`，不携带旧开局或商业规则，也不进入运行时。

## 本地检查

题库工具使用Python标准库；静态色彩图额外需要Pillow。Node脚本使用Node 22；TypeScript检查默认使用本机已安装Cocos 3.8.8附带的编译器，可用 `SHISE_TSC_PATH` 指定其他机器的编译器路径。

```sh
python3 -B tools/levels/generate_levels.py
python3 -B tools/levels/validate_levels.py
node tools/levels/check_atlas.mjs
node tests/core/run.mjs
node tests/application/run.mjs
node tools/design/sync-theme.mjs
node tools/build/sync-content.mjs
node tools/build/check-client.mjs
node tools/build/check-layout.mjs
```

生成物不手改。调整目标颜色、布局或预算后，应修改作者源与生成规格、升级版本并重新验证。图鉴检查采用模拟DOM，客户端检查采用本机Cocos类型声明；它们都不等同于真实浏览器、引擎构建或手机运行。题库的人眼辨色、感知替代解、真实难度与广告效果仍待试玩。
