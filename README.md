# 拾色之间

竖屏颜色填空小游戏，目标平台为抖音小游戏。**五章100关，先点击下方色块，再点击上方空槽，在倒计时内补全渐变。** 开局只有固定提示色块；可以取回、改放、撤销，使用道具或在失败后自愿看视频续时。

当前客户端版本 `1.1.0`，使用 Cocos Creator 3.8.8 + TypeScript；题库为 `0.6.0`。前12关扩大结构，百关受约束洗牌；已填块可收回任意空候选槽。首页提供开始/继续、关卡、动画教程、道具积分商城和设置。通关表现发放积分，积分购买道具；失败复活和通关双倍积分均保留激励视频接口。真实广告位尚未开通，未配置时明确返回不可用，不发放观看奖励。

抖音仅保留一个导入目录：`releases/douyin`。[1.1.0官方预览](https://t.zijieimg.com/iXW53KtN/)；本机 Web 试玩入口：`http://127.0.0.1:7468/`（须运行本地预览服务）。本轮实际Web、双目标构建和抖音首页画面已核验，详见[开发状态](docs/DEVELOPMENT_STATUS.md)。真机与真实广告仍待验收，未提审上线。

- [游戏设计](docs/GAME_DESIGN.md)：唯一现行玩法、五章阶梯、倒计时、积分、道具与广告闭环。
- [开发计划](docs/DEVELOPMENT_PLAN.md)：客户端、百关和抖音发布的验收门槛。
- [美术与界面](docs/ART_DIRECTION.md)：轻暖无衬线、轨道与候选区、公共组件与精确色面。
- [自然配色](docs/COLOR_SYSTEM.md)：保留已认可的百关HEX与自然主题。
- [当前题库](data/levels/levels.v0.6.json)、[内容契约](docs/levels/README.md)、[百关图鉴](docs/levels/atlas.html)、[逐关目录](docs/levels/catalogue.md)。
- [视觉参数](assets/design/design-tokens.json)、[image素材清单](assets/design/asset-manifest.json)。
- [核心与存档测试报告](docs/CORE_TEST_REPORT.md)、[Cocos工程](game/README.md)。

现行文件只维护这一套规则。认可目标色与拓扑的作者源在 `data/levels/source/`，不携带旧开局或商业规则，也不进入运行时。

## 本地检查

题库工具使用Python标准库；静态色彩图额外需要Pillow。Node脚本使用Node 22；TypeScript检查默认使用本机已安装Cocos 3.8.8附带的编译器，可用 `SHISE_TSC_PATH` 指定其他机器的编译器路径。

```sh
python3 -B tools/levels/generate_levels.py
python3 -B tools/levels/validate_levels.py
node tools/levels/check_atlas.mjs
node tests/core/run.mjs
node tests/application/run.mjs
node tests/platform/run.mjs
node tools/design/sync-theme.mjs
node tools/build/sync-content.mjs
node tools/build/check-client.mjs
node tools/build/check-layout.mjs
```

本轮核心48项、应用20项、平台32项，共100项自动测试通过。题库100关共1795次计时放置与逐步恢复、31项损坏探针通过；图鉴18项模拟DOM与42组布局检查通过。实际运行证据分别记录，不将自动测试替代真机触摸或真实广告验收。

生成物不手改。调整目标颜色、布局或时间参数后，应修改作者源与生成规格、升级版本并重新验证。题库的人眼辨色、感知替代解、真实失败率与广告效果仍待试玩。
