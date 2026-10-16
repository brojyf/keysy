# Keysy · 配色应用对照

直接打开 [index.html](index.html)。在顶部切换 **Supabase Dashboard / Mintlify 文档**、10 套颜色及深浅模式；下方始终并排列出当前布局的全部配色，点击「放大」返回完整预览。

- 两种布局 × 10 套配色 × 深浅模式，共 **40 个组合**。已删除 07、09、17、18，其他配色保留原编号。
- 使用现有 `web/mockups/palettes*.js` 色值与 Logo 33；布局、文字和图形固定，只改变颜色。
- 1200 × 800 的桌面 mock 按容器等比缩放，小屏把深浅对照改为上下排列。
- 支持 URL 参数，例如 `?layout=mintlify&palette=slate&mode=dark`。切换按钮可操作，产品内部控件仅为静态外观。
- 无构建或网络依赖，不安装 SDK，不连接真实项目。

## Supabase 参考

[Supabase 官方 Studio 更新](https://supabase.com/blog/tabs-dashboard-updates)及其[表格编辑器截图](https://supabase.com/images/blog/lw14-tabs-dashboard-updates/table-editor-tabs.jpg)：组织/项目导航、窄图标栏、资源列表、标签页、工具栏与紧凑表格。Keysy mock 增加密值详情侧栏，使用虚构 API key / `.p8` 记录。不是 Supabase 原界面的逐像素复制，也不代表 Keysy 已实现这些功能。

## Mintlify 副本

`mintlify-copy/` 是开始本次工作时 `docs/` 的 20 个文件的原样副本。正式 `docs/` 没有改动。

参照 [Mintlify 主题文档](https://www.mintlify.com/docs/customize/themes)及副本中的 `theme: mint`：顶部搜索、模块标签、左侧导航、正文与右侧目录。mock 的标题、描述、目录表和顶部模块来自副本；没有虚构产品接口文档。预览是本地 HTML 对外观的模拟，不是 Mintlify 引擎渲染；没有修改副本的主题配置，也没有启动或部署文档站。

## 配色观察

- **14 雾蓝**：表格和文档都比较安静；正文、选中态与背景容易区分，品牌个性较弱。
- **16 可可与冰蓝**：深色 Dashboard 的冷暖关系更明显；文档长表格中也有温度，但深浅主色交换需要保持品牌一致性。
- **04 黑白**：最接近中性的工具界面；彩色反馈的辨识优势较少。
- **10 钴蓝、19 墨黑与鸢紫**：按钮和导航强调更醒目；在文档密集的行内代码中彩色面积会增加。

这是配色取舍，不是最终主题选择。更简单的最终方案是统一选一套深浅体系，同时用于 Dashboard 和文档。

## 验证

```sh
node --test design/color-applications/preview.test.mjs web/mockups/brand-review.test.mjs
```

检查 40 种布局/配色/模式组合、换色与布局切换、URL 恢复、放大操作、文档副本内容一致性、无网络依赖，以及既有文字/按钮对比度。
