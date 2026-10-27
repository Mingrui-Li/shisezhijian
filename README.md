# 拾色之间

竖屏颜色填空小游戏，目标平台为抖音小游戏。**五章100关，先点击下方色块，再点击上方空槽填入。** 开局只有固定提示色块；取回、改放、撤销、有限道具和失败复活均围绕点击填空实现。

当前为纠偏后的开发基线：Cocos Creator 3.8.8 + TypeScript，已完成题库迁移与规则/源码检查；引擎运行、抖音导入、真机与正式广告尚未验收。实际完成状态只记录在[开发状态](docs/DEVELOPMENT_STATUS.md)。

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
