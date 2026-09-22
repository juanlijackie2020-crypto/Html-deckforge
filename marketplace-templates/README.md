# Marketplace Templates（团队文件夹）

这个文件夹是 Template Marketplace 的「团队文件夹」来源：`.html` 演示模板放进这里，所有在本地 dev server 上打开 DeckForge 的人都能在 marketplace 里看到并使用。

## 规则

- 只读取本目录**顶层**的 `.html` / `.htm` 文件（不递归子目录）。
- 模板需要在 `<head>` 里内联 `<style>`（srcdoc 渲染环境下相对路径的外部 CSS 无法解析）。
- 页与页之间用 `class="slide"` 的元素分隔；没有 `.slide` 的文件会作为单页模板导入。
- 带 `<meta name="generator" content="DeckForge">` 标记的文件（即 DeckForge 导出的 deck）会走结构化导入，每个组件保持可编辑；其余文件走 raw 导入，原样保留设计。

## 换一个文件夹

默认读取本目录；设置环境变量 `MARKETPLACE_DIR`（`.env.local`）可以指向任意本地文件夹。

## 生效方式

dev server 会实时列出目录内容——放入、修改或删除文件后，刷新 marketplace 页面即可，无需重启。
