# 界面与经营闭环验收记录

日期：2026-10-28。当前1.1.0，题库0.6.0/schema4.1.0，Cocos Creator3.8.8。以下网页截图及抖音模拟器首页证据均来自1.1.0实际运行，不是Image效果图；完整原生交互、手机与真实广告另行验收。

## 1.1.0 实际Web操作

在390×844视口完成：

1. L001从5枚乱序候选开始，确认新版7格转弯轨道。
2. 将候选色块1和2放入上方，再将色块1收回候选槽2、色块2收回候选槽1；两个非原槽收回均成功，后续仍能正常选择与放置。
3. 正确补齐后进入Won，约20秒、7次操作，成绩164、实际到账164，余额104→268。
4. 点击“看视频双倍积分”，因未配置adUnitId提示不可用；状态仍Won、余额仍268，没有发奖。
5. 回玩同关取得182分，只再发历史最好提高的18分差额，未重复领取完整基础奖励。
6. 在390×694短屏检查专用WinPanel，透明色环、超大得分、到账条、两列统计、视频次按钮、下一关主按钮与首页链接完整显示，按钮可达。

证据目录 `artifacts/release-1.1.0/`：

- [新首关与5候选](../artifacts/release-1.1.0/level-001.jpg)
- [交叉收回非原槽](../artifacts/release-1.1.0/cross-slot-return.jpg)
- [胜利卡](../artifacts/release-1.1.0/win-panel.jpg)
- [短屏胜利卡](../artifacts/release-1.1.0/win-panel-short.jpg)
- [胜利只读状态](../artifacts/release-1.1.0/win-state.json)
- [自动回归摘要](../artifacts/release-1.1.0/core-test-summary.json)

状态记录明确版本1.1.0、L001、Won、余额268、剩余24,958毫秒，文字包括164分、+164、0:20和7次。验证使用页面公开只读状态与当前交互控件，没有直接修改积分、时间或调用隐藏答案来冒充用户操作。

## 自动回归与构建

核心48、应用20、平台32，共100项通过；百关1,795次逐秒放置与恢复；严格TypeScript通过；42组布局最小色块44.33。百关数据/颜色/seed检查0错误，31项损坏探针拒绝，图鉴18项模拟DOM检查通过，重复生成字节一致。

真实Cocos Web与抖音构建均退出36成功且输入稳定。抖音47文件、9,468,532字节，约9.03MiB；包内0.6题库与源精确一致，已逐文件核验并更新唯一 `releases/douyin`。详细摘要和构建证据见[BUILD_REPORT.md](BUILD_REPORT.md)。

## 1.1.0 抖音工具首页与官方预览

通过官方CLI启动工具，窗口列表按项目 `/Users/limingrui/IdeaProjects/shisezhijian/releases/douyin` 确认类型microgame、真实窗口ID2；随后同窗口 `simulator-compile` 返回成功，再获取截图和控制台。

编译后实际截图路径 `/var/folders/r1/pyhg16p91k3bzgr3kpjw9y3h0000gn/T/1793151071434.png`，图像786×1704、CSS视口393×852、缩放2×；首页正常，无文字重叠。返回控制台无error级记录，只有helium/场景加载信息和触摸监听verbose警告。[原生启动取证链](../artifacts/release-1.1.0/douyin-startup-visual.json)记录了固定路径、窗口、编译及截图基线。

官方已返回[1.1.0预览链接](https://t.zijieimg.com/iXW53KtN/)，`ok:true`，[预览回执](../artifacts/release-1.1.0/official-preview.json)已保存。预览按固定磁盘路径读取当前包，协议没有绑定窗口内存中的编译revision；不能据此声称两者具有协议级相同运行状态。未提审、未上线。

## 真实能力边界

原生证据确认启动、首页显示和当前控制台基线，没有断言小游戏Canvas完整交互。真实触屏、声音、辨色、前后台与Android/iOS设备行为仍须专门验收。

真实广告位未开通；本轮验证了业务入口与缺失广告不发假奖励，SDK模拟覆盖不等于真实投放。8+按用户已与平台确认的信息显示，平台实名/防沉迷能力另行核验。

## 历史：1.0.0 / 题库0.5.0

旧版曾实际验证首页分区、编号关卡、三页循环教程、自然超时失败、广告不可用、免费重开、首关184分到账、80分购买窥色后余额104/库存1及刷新保留；85项自动回归和Cocos双目标通过。当时抖音窗口ID2首页截图正常，未把无法读取的诊断探针当作Canvas交互通过。

旧截图及状态在 `artifacts/release-1.0.0/`，包括[首页](../artifacts/release-1.0.0/home.jpg)、[超时失败](../artifacts/release-1.0.0/time-expired.jpg)、[购买保存](../artifacts/release-1.0.0/restored-purchase.json)。当时经授权生成[1.0.0预览](https://t.zijieimg.com/iXW5DBaP/)，[回执](../artifacts/release-1.0.0/official-preview.json)保留；该链接与旧首关、旧通关面板都不是当前版本验收证据。未执行提审或上线。
