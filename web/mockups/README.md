# Keysy 设计预览

打开 [review.html](review.html)：十套深浅配色、Logo 30—36（新增 33—36）、二十款保留的往期 Logo，以及设计师参考。单文件可离线使用，顶部切换颜色会同步更新 Logo。

- 颜色保留原编号：02、04、06、08、10、13、14、15、16、19；其余色值不变。
- 已删除 07 橄榄、09 赭黄、17 松墨与白垩、18 茄紫与浅青。
- 本轮增加 33 契合、34 托管、35 轮换、36 分域，原有 23 款 Logo 及全部 SVG 保留。
- 上轮已排除 01 翠绿、03 暖砂、05 砖红、11 朱橙、12 硫黄。
- 新 Logo 表达 Secrets 管理的隐藏值、受控访问、集中保管。26、29 已删除；27、28 保留在往期候选中。
- 本轮推荐 16 可可与冰蓝 × 33 契合。
- 上轮推荐 14 雾蓝 × 30 密值边界；独立图标可比较 13 梅墨 × 32 密仓。

[配色来源与取舍](palette-research.md) · [新 Logo 设计说明](logos/round-9/README.md) · [上轮说明](logos/round-8/README.md) · [可编辑 Figma](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=24-2)

统一分支：`design/ui-studies`。Dashboard / 文档配色应用见 [color-applications](../../design/color-applications/index.html)；原始三种交互布局完整保留在 [dashboard-layouts](../../design/dashboard-layouts/dashboard.html)。

`dashboard.html` 只比较颜色；`palettes.js` 和 `palettes-extra.js` 为色值源。`icons/preview.html` 与 `logos/preview.html` 使用相同的可选颜色。`logo-studies/` 是分支已有的独立历史研究，保持原有文件。

从仓库根目录运行：

```sh
node --test web/mockups/brand-review.test.mjs web/mockups/dashboard.test.mjs
```

检查覆盖稳定编号、排除项、文字和按钮对比度、颜色切换及 SVG 自包含。Figma 已检查正反色和 16/24/32px 图形。均为设计提案，没有更改正式产品界面或架构。
