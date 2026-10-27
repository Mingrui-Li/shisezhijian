# Cocos 客户端

引擎：**Cocos Creator 3.8.8**；启动场景：`assets/scenes/Boot.scene`。

唯一玩法为点击填空：上方固定提示与空槽，下方候选池。先选色、再点空槽；已填块可改放或免费回到原候选槽。候选用按钮分页，槽位不重排。规则见[游戏设计](../docs/GAME_DESIGN.md)。

已接入点击核心、首页与顺序选关框架、上轨道/下候选布局、撤销和道具、失败/重开与明确标注的模拟视频。正式抖音环境未配置广告时返回不可用。所有这些仍需实际引擎操作验收，不能把源码与类型检查表述为已完成可玩发布包。

工程资源从唯一 `data/levels/levels.v0.4.json` 与 `assets/design/design-tokens.json` 生成：

```sh
node tools/design/sync-theme.mjs
node tools/build/sync-content.mjs
node tools/build/check-client.mjs
```

以上命令在项目根目录运行。检查器使用本机 Cocos 3.8.8 的真实 `cc.d.ts` 做严格TypeScript检查，并核对Boot场景组件链接；不启动编辑器，也不生成正式抖音包。Cocos首次打开时会生成缓存和资源元数据。构建/开发者工具/真机/正式广告状态以[开发状态](../docs/DEVELOPMENT_STATUS.md)为准。
