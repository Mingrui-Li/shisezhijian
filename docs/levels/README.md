# 点击补色百关题库 v0.4

唯一运行题库为 `data/levels/levels.v0.4.json`，schemaVersion 为 `3.0.0`，玩法 `click-fill`，输入 `tap`。旧题库、旧解法和旧导出档已删除。

每关上方是只有固定提示色块的空缺渐变轨道；下方是全部非锚点颜色。先点选颜色，再点空槽完成放置。取走的候选色保留空位；每块的候选区归位索引固定，跨页不重排。候选区点击翻页，标准每页18格，小屏可适配12格或6格。

候选区到空槽、盘面色块到另一空槽，成功各扣1步。点选后点自己的候选空位可免费取回。取消、同源、无效点击不扣步；占用目标不覆盖。撤销不返还步数或库存。先判断通关，再判断步数耗尽失败。

前四关不限步。第五关起初始预算为 `B=N+max(2,ceil(N×r))+rhythmExtra`；N是初始空槽/候选色数量，章节r依次为0.70、0.50、0.35、0.25、0.18。每章第8、12、16关保留轨道并额外加2步。完成自愿激励视频每次复活补 `max(5,ceil(N×0.2))` 步，每局最多两次；免费重开保留。预算与失败率仍待真人试玩调整。

| 文件 | 用途 |
| --- | --- |
| `atlas.html` | 作者图鉴，默认初始空槽与下方候选区；切换答案仅供作者审阅，不是游戏功能 |
| `catalogue.md` / `catalogue.csv` | 100关的轨道、候选数、最低放置数N、预算B和宽容 |
| `palette-overview.html` | 已认可自然色场的作者答案总览，非游戏开局 |
| `palette-report.json` / `.md` | 逐关与全库的实际HEX色度、亮度、家族与邻关距离 |
| `validation-report.json` | 100关证解重放、结构、颜色、版本契约、损坏数据探针 |
| `atlas-static-check.json` | 内嵌JavaScript语法与模拟DOM检查；没有浏览器视觉验收 |
| `data/levels/levels.v0.4.json` | 唯一运行包，包含空缺盘面、固定槽候选色、合法点击放置证解 |
| `data/levels/source/target-fields.v1.json` | 仅作者生成源：已认可目标HEX、tile身份、轨道、原锚点和自然主题；不能作为运行包 |
| `data/palettes/nature-palettes.v1.json` | 自然主题种子记录；本轮没有重新采色 |

运行：

```sh
python3 -B tools/levels/generate_levels.py
python3 -B tools/levels/validate_levels.py
node tools/levels/check_atlas.mjs
python3 -B tools/color_review.py
```

100关所有目标HEX、tile身份、轨道、坐标、paths、原anchors和自然主题均从已认可色场精确保留。不可变目标源摘要为 `04037c28c139fee60bbea95b43735ba324e596dd8e9bd5785b2ae2ac933a3be3`。生成只重建点击补色的开局、候选顺序、预算和证解，不重新生成颜色。全部颜色唯一，每关N步证解不消耗道具或广告；这不代表人类失败率、感知唯一解或商业效果已经验证。

数值颜色筛查仍包含每格实际HEX的sRGB范围、记录色场重建、全局/相邻Oklab色差、邻关家族/气质/色盘差异，以及第3–5章对8种明度直排完全命中的排除。这只排除特定启发式。人工配色、真实手机显示、点击目标尺寸、候选分页、实际时长、道具消耗、广告转化和无广告人类通关都仍待验收。
