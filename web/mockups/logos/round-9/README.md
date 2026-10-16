# Keysy · 授权与凭据生命周期

[交互总预览](../../review.html#logo-33) · [Figma 可编辑画板](https://www.figma.com/design/3QD7tbVmZnKZoLEUOD0yRl?node-id=24-2)

新增 33—36，保留此前全部 23 款 Logo 和原 SVG。四款继续使用 Manrope Medium 字标，以便比较符号本身。

| 编号 | 功能含义 | 优点 | 代价 |
| --- | --- | --- | --- |
| 33 契合 / Fit | 互补齿形隔着一道留白相对，表示身份与权限匹配 | 外轮廓完整，负形醒目，16px 仍可辨 | 容易联想到工业连接件 |
| 34 托管 / Custody | 两侧托臂包住一个方形密值 | 几何关系简单，适合集中保管的产品定位 | 没有文字语境时含义较抽象 |
| 35 轮换 / Rotate | 两段弧围绕核心，开口表示替换和更新 | 有方向感，也适合生命周期概念 | 可能被误读为同步或刷新 |
| 36 分域 / Namespace | 外部范围、内部路径与密值形成分层 | 表达按范围组织和隔离 | 16px 比其他方向密集 |

优先比较 **16 可可与冰蓝 × 33 契合** 和 **18 茄紫与浅青 × 34 托管**。前者轮廓有力，后者强调托管语义。更简单的最终方案仍是选一款符号、一个深浅色体系。

## 参考与边界

- [OpenBao 官方介绍](https://openbao.org/docs/what-is-openbao/)用于校准 secrets manager 类别。轮换、分域是功能概念方向，不声称 Keysy 已实现相应能力。
- [Hiro / PORTO ROCHA](https://www.portorocha.com/hiro)启发使用开发者可理解的视觉语言。
- [Crux / Order](https://order.design/project/crux)启发一个符号只承担一个主要概念。
- 配色对应的人类设计署名、原作和取舍见[配色研究](../../palette-research.md)。本轮图形由 agent 在 Figma 绘制，不声称由参考设计师创作；没有复制参考品牌 Logo。

## 文件与验证

- `33.svg`—`36.svg` 为组合字标；`*-symbol.svg` 为独立图形。
- SVG 为轮廓路径，使用 `currentColor`，不依赖外部字体和图片；Figma 字标保留可编辑文字。
- Figma 检查黑白、反白、28px 字标以及 16/24/32px 独立图形。
- 自动检查：14 套配色切换、编号保留、文字与按钮对比度、嵌入 SVG 与导出文件一致。
- 识别度判断来自视觉检查，未做用户辨识实验。
