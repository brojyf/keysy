# Keysy · Secrets 管理系统

[总预览](../../review.html#logos) · [Figma 可编辑画板](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=19-2)

本轮删除 26、29，保留 27、28 为往期候选。新增三款使用同一 Manrope Medium 字标，便于比较符号本身。

| 编号 | 功能含义 | 优点 | 代价 |
| --- | --- | --- | --- |
| 30 密值边界 / Scope | 方括号围住星号：被限定范围的隐藏值 | 开发者容易理解，几何简洁 | 括号是常见的代码图形 |
| 31 授权入口 / Gate | 私密值在边界内，入口由一道闸控制 | 独立轮廓清楚、小尺寸细节少 | 功能含义更抽象，也可能看成字母 C |
| 32 密仓 / Store | 星号镂空在一个有层次的存储单元中 | 密值与集中保管的关联直接 | 16px 下细节更密集 |

优先推荐 **14 雾蓝 × 30 密值边界**：产品含义清楚、界面安静。若更重视独立图标，比较 **13 梅墨 × 32 密仓**。更简单的方案是最终只选一个符号、一套颜色。

## 功能与设计依据

- [OpenBao 官方说明](https://openbao.org/docs/what-is-openbao/)：集中保存 secrets，访问前认证和授权。用它校准产品类别，不把 OpenBao 的全部能力当成 Keysy 已实现的功能。
- [PORTO ROCHA / Hiro](https://www.portorocha.com/hiro)：从开发者已有的字符语言建立符号。30 将遮蔽字符与边界结合；没有复用 Hiro 的图形。
- [Order / Crux](https://order.design/project/crux)：一个轮廓承载一个清楚的概念。31、32 分别只强调受控访问与集中保管。

三款为 agent 在 Figma 中绘制的原创提案，不声称上述设计师参与 Keysy。星号是隐藏值的视觉符号，不等于加密算法。

## 文件与验收

- `30.svg`—`32.svg` 为组合字标；对应 `*-symbol.svg` 为独立图形。
- Figma 保留可编辑文字；SVG 为轮廓，使用 `currentColor`，不依赖外部字体或位图。
- 已查看 Figma 正反色画板、28px 字标、16/24/32px 图形。
- `node --test web/mockups/brand-review.test.mjs web/mockups/dashboard.test.mjs` 验证颜色切换、稳定编号、排除项、文字和按钮对比度。
- 配色与小尺寸检查不替代用户识别测试。
