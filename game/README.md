# Cocos 客户端

引擎：**Cocos Creator 3.8.8**；客户端源码版本：**1.1.0**；启动场景：`assets/scenes/Boot.scene`。

唯一玩法为点击填空：上方固定提示与空槽，下方候选池。先选色、再点空槽；已填块可改放或收回任意空候选槽。候选用按钮分页，槽位不自动压缩重排。100关全部使用倒计时，时间耗尽失败，失败后可以免费重开或自愿完成视频续时30秒，每局最多两次。规则见[游戏设计](../docs/GAME_DESIGN.md)。

当前首页入口为开始/继续、关卡、动画教程、道具和设置。新玩家点睛、窥色、续时各1个；通关按表现计分，积分可购买道具。点睛归位并锁定1块，窥色显示一条色路答案3秒，续时增加30秒。收藏与体验版测试入口已经移除。

激励视频适配器保留失败续时、道具补货和通关双倍积分的接入。未配置真实广告位时明确不可用，不模拟已观看。受控SDK模拟只用于自动测试，不代表真实广告投放。当前100项自动测试与Cocos双目标构建通过；本轮Web、抖音首页与真机边界以[开发状态](../docs/DEVELOPMENT_STATUS.md)为准。

抖音固定唯一导入目录为项目根的 `releases/douyin`。本机Web试玩 `http://127.0.0.1:7468/` 依赖本地预览服务运行。

工程资源从唯一 `data/levels/levels.v0.6.json` 与 `assets/design/design-tokens.json` 生成：

```sh
node tools/design/sync-theme.mjs
node tools/build/sync-content.mjs
node tools/build/check-client.mjs
```

以上命令在项目根目录运行。检查器使用本机Cocos 3.8.8的真实 `cc.d.ts` 做严格TypeScript检查，并核对Boot场景组件链接；不启动编辑器，也不生成抖音包。Cocos首次打开时会生成缓存和资源元数据。构建结果、导入和平台验收不能用类型检查结果替代。
