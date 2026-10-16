# Keysy · 当前配色候选

更新：2026-10-16。[打开总预览](review.html#colors) · [Figma 配色画板](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=21-2)。编号固定，删除后不重新编号。

排除：01 翠绿、03 暖砂、05 砖红、07 橄榄、09 赭黄、11 朱橙、12 硫黄、17 松墨与白垩、18 茄紫与浅青。
保留：02 墨蓝、04 黑白、06 酒红、08 石油青、10 钴蓝、13 梅墨、14 雾蓝、15 藏蓝与蔷薇、16 可可与冰蓝、19 墨黑与鸢紫。

## 上轮配色 13—15

| 编号 | 颜色关系 | 来源与提炼 | 取舍 |
| --- | --- | --- | --- |
| 13 梅墨 / Plum | 深梅紫、粉灰白、浅灰紫 | [Liberty / Harry Pearce, Pentagram](https://www.pentagram.com/work/liberty)：紫色与黑白的关系。Keysy 将紫色压灰，另配深浅 UI 色值。 | 识别度较强；比蓝灰更有品牌情绪。 |
| 14 雾蓝 / Slate | 蓝灰、冷白、浅钢蓝 | [Plenaire / Jody Hudson-Powell 与 Luke Powell, Pentagram](https://www.pentagram.com/work/plenaire)：留白与轻量的强调色。蓝灰是 Keysy 自选色，不声称来自其原配色。 | 适合长时间使用；品牌冲击力较弱。 |
| 15 藏蓝与蔷薇 / Navy–Rose | 藏蓝结构、灰粉选中底色、浅蔷薇深色按钮 | [The Wing / Emily Oberman, Pentagram](https://www.pentagram.com/work/the-wing)：文具感的淡色与深海军蓝关系。 | 层次更丰富；两色关系需保持一致。 |

这些是署名工作室的真实案例。借鉴色彩关系和用色方法，所有 HEX 都为 Keysy 另行配制。官方原作链接可查看完整视觉；本轮工具无法直接下载部分官网图片，因此没有把图片取色当作色值依据。

推荐先看 14 雾蓝，其次 13 梅墨。所有方案都是比较候选，不代表产品需要提供全部主题。

## 本轮新增 16—19

[直接看新增配色](review.html#palette-16) · [Figma 深浅配色](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=25-2)。以下保留本轮研究记录；17、18 已从预览中删除。

| 编号 | 色彩关系 | 人类设计来源与 Keysy 的延伸 | 优点 / 代价 |
| --- | --- | --- | --- |
| 16 可可与冰蓝 | 深可可结构、冰蓝选中底与深色强调 | [deZaan / Angus Hyland 团队，Pentagram](https://www.pentagram.com/work/dezaan) 官方介绍蓝、黑白与铜色。本方案借鉴冷暖配对，棕色与冰蓝为 Keysy 另选。 | 温润、有记忆点；深浅模式的主色发生交换。 |
| 17 松墨与白垩 | 近黑松绿、低彩度灰绿、冷白 | [ERM / Marina Willer 团队，Pentagram](https://www.pentagram.com/work/erm) 的绿色与中性色层次。Keysy 收敛为深绿结构与白垩色强调。 | 阅读稳定；可能联想到自然或环保品牌。 |
| 18 茄紫与浅青 | 深茄紫、浅青选中底与深色强调 | [Cohere / Jody Hudson-Powell 与 Luke Powell 团队，Pentagram](https://www.pentagram.com/work/cohere) 的自然色与人工色并置。茄紫、浅青是 Keysy 的解释，不是其品牌标准色。 | 冷暖张力鲜明；要统一两种模式的用色分工。 |
| 19 墨黑与鸢紫 | 墨黑基础、饱和鸢紫、淡紫反色 | [Shop / PORTO ROCHA](https://www.portorocha.com/shop)，创意总监 Felipe Rocha、Leo Porto，设计 Nathan Fyock、Rachel Quan、Luis Alejandro。借鉴紫色由暖黑、灰白承托的关系。 | 强调色更有力量；紫色在软件品牌中较常见。 |

优先看 16 × Logo 33；19 提供更醒目的实色强调。以上是设计判断，不代表用户已经选定。

全部来源为工作室公开署名案例；没有将生成图当作参考。HEX 经过界面对比度调整，不宣称从原作图片取色。

## 色值和检查

`palettes.js` 与 `palettes-extra.js` 包含十套完整深浅模式。每套有稳定编号和九个角色：背景、卡片、正文、次要文字、强调色、按钮、按钮文字、选中背景、装饰边线。总预览嵌入同样的数据，可以离线打开。

`node --test web/mockups/brand-review.test.mjs`：每个模式验证正文、次级文字、强调文字在背景/卡片/选中底色上 ≥ 4.5:1，按钮文字 ≥ 4.5:1，按钮与相邻底色 ≥ 3:1；十套共 240 个组合。边线只作装饰，不等同于焦点环或交互边框。
