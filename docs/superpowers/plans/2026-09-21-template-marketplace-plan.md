# Template Marketplace 实施计划

- 日期：2026-09-21
- 设计依据：[2026-09-21-template-marketplace-design.md](../specs/2026-09-21-template-marketplace-design.md)
- 原则：每个 Phase 结束时应用可运行、`npx tsc --noEmit` 通过；每 Phase 一个 git 提交

## 已核实的代码事实（写计划时确认，实现时直接依赖）

- `generateDeckFromContent`（LandingPage.tsx:658）被 AI 会话流程复用（:318、:323）——**保留**
- `generateMeetingDeck`（:791）、`generateWorkshopDeck`（:885）只被 `handleTemplateSelect`（:340）调用——模板模式移除后成死代码，**删除**
- `generateUseCaseTimelineDeck`（src/templates/usecase-timeline.ts:55）——**实现更新：保留**（builtin 源以 generator 形式上架，见下方偏差记录）
- `generatePetTemplateDeck`（src/templates/template-pet.ts:65）——**保留**，builtin 源引用
- AiPanel `quickTemplates`（AiPanel.tsx:115-119）是 `{label, text}` 数组，点击填充输入区——三个预设照此迁移
- LandingPage 模式切换在 :392-429，template 模式渲染块从 :576 起
- 与 spec 清单的偏差：新增小文件 `src/lib/templates/import-mode.ts`（~15 行，`detectImportMode`），避免 upload-store ↔ registry 循环依赖

## 实现偏差记录（2026-09-22，Phase 2 实现时确认）

原计划 builtin 源含两个 `kind: html` 的 `?raw` 直接导入（template-presentation.html / ai-usecase-timeline.html）。实现时核实：两个 HTML 源都需要模板特定的拆分/包装逻辑（template-presentation.html 的绝对定位 `.slide` 必须包进 960×540 缩放容器；ai-usecase-timeline.html 用 `.section` 区块需两两重组），且 "MB Presentation Master" 与 "PET Master Deck" 实为同一生成器。因此：

- builtin 源统一为 **2 条 `kind: 'generator'`**（`builtin-pet-master`、`builtin-usecase-timeline`），spec §4.1 已同步更新
- `src/templates/usecase-timeline.ts` 与 `template-pet.ts` **均保留**，builtin.ts 直接引用两个生成函数；`?raw` 内联经这两个生成器文件发生（bundle 体积影响不变）
- `htmlToRawDeck` 只服务上传/文件夹源（原实现不变，适用范围缩小）
- 受影响任务：Task 2.1（改为 generator 注册）、Task 2.2 验证（2 条）、Task 5.4（不删 usecase-timeline.ts）

---

## Phase 0 — 仓库基线（当前被工具故障阻塞，恢复后第一时间执行）

**Task 0.1 git init + 基线提交**
- `.gitignore` 追加 `.superpowers/`、`rendered/`（现有内容已含 `node_modules/`、`dist/`、`*.local`）
- `git init` → `git add .` → 提交全部现有代码（基线，不含新功能）
- 验证：`git log` 有基线提交；`git status` 干净；暂存列表中无 `.env.local`、`node_modules/`、`.superpowers/`

## Phase 1 — 类型与纯逻辑（含第一批单测）

**Task 1.1 类型定义** — 新建 `src/types/template.ts`（~40 行）：`TemplateSource`、`TemplateKind`、`ImportMode`、`TemplateManifest`，字段按 spec §3。

**Task 1.2 导入模式检测** — 新建 `src/lib/templates/import-mode.ts`（~15 行）：`detectImportMode(html): ImportMode`——含 `<meta name="generator" content="DeckForge">` → `'structured'`，否则 `'raw'`。

**Task 1.3 raw 导入 util** — 新建 `src/lib/templates/html-to-raw-deck.ts`（~90 行）：`htmlToRawDeck(html, name): Deck`，按 spec §6.1 六步实现（DOMParser → `.slide` 列表/整页兜底 → 抽取 `<style>`+`<link>` 公共 css → 每页 raw 组件 → fit 按 css 中 `.slide` 宽高比判定 → 返回 Deck，不碰 store）。

**Task 1.4 vitest 接入 + 单测**
- `npm i -D vitest`；package.json 加 `"test": "vitest run"`
- 新建 `src/lib/templates/__tests__/templates.test.ts`：htmlToRawDeck 4 用例（多 slide 拆分 / 无 `.slide` 单页 / 公共 css 抽取 / 竖版→scroll）、detectImportMode 2 用例（有/无标记）
- 验证：`npm test` 全绿；`npx tsc --noEmit` 无错

## Phase 2 — 内置源与注册表

**Task 2.1 builtin 源** — 新建 `src/lib/templates/builtin.ts`（~60 行）：~~`?raw` 导入两个 HTML + 三个 manifest~~ **（已按偏差记录改为 2 条 generator 注册，slideCount 由生成 deck 的 slides.length 得出）**

**Task 2.2 注册表与分发** — 新建 `src/lib/templates/registry.ts`（~100 行）：`listTemplates()`（本 Phase 返回 builtin，folder/upload 下一 Phase 接入）、`getTemplateHtml(id)`、`useTemplate(id)` 三路分发（generator → 直接执行；structured → `importHtmlDeck`；raw → `htmlToRawDeck`）。
- 验证（偏差后）：`listTemplates()` 返回 2 条；`useTemplate('builtin-pet-master')` 产 raw deck

## Phase 3 — 上传源（IndexedDB）

**Task 3.1 导出标记** — `src/lib/html-exporter.ts`：`exportDeckToHtml` 的 `<head>` 加 `<meta name="generator" content="DeckForge">`（~3 行）。

**Task 3.2 上传存储** — 新建 `src/lib/templates/upload-store.ts`（~120 行）：
- 纯函数 `parseUploadedHtml(html, fileName)`：name（`<title>` || 文件名去扩展）、slideCount（`.slide` 数，0 则 1）、`detectImportMode`、版式 tag（纵横比）——先写后入库
- IndexedDB wrapper（DB `deckforge-templates`，store `templates`，keyPath `id`）：`getAll/put/delete`
- `addUploads(files)`：校验（.html、≤5MB）→ 逐文件 parse → put；`removeUpload(id)`

**Task 3.3 registry 接入上传源** — `listTemplates` 合并 upload 记录；`getTemplateHtml` 读 IDB。
- 验证：单测加 `parseUploadedHtml` 3 用例（title 有/无、slide 计数）；`npm test` 绿

## Phase 4 — 文件夹源（vite 插件）

**Task 4.1 vite 插件** — `vite.config.ts` 加 `templatesPlugin`（~50 行，照 `llmProxyPlugin` 模式）：`GET /api/templates` 实时扫 `marketplace-templates/*.html` 返回 `[{file, mtime}]`；`GET /api/templates/<file>` 返回内容；resolve 后必须仍在模板目录内（防穿越）；目录缺失返回 `[]`。env `MARKETPLACE_DIR` 可覆盖路径。

**Task 4.2 folder 源客户端** — 新建 `src/lib/templates/folder-source.ts`（~60 行）：fetch 列表 → 逐文件 fetch 内容 → `parseUploadedHtml` 复用解析 → manifest（source: 'folder'）。fetch 失败抛错由 UI 层降级（spec §9）。

**Task 4.3 注册 + 说明文件** — registry 接 folder 源；新建 `marketplace-templates/README.md`（放文件规则：.html、含 `.slide` 或整页、`<title>` 即展示名）。
- 验证：往 `marketplace-templates/` 放一个 DeckForge 导出文件 → `fetch('/api/templates')` 出现该条；访问 `/api/templates/../.env.local` 被拒；dev server 下 listTemplates 合并三源

## Phase 5 — Marketplace UI 与旧入口拆除

**Task 5.1 大图预览** — 新建 `src/components/TemplatePreview.tsx`（~120 行）：全屏覆盖层、iframe srcdoc、注入 CSS 默认隐藏全部 `.slide` 只显示第 N 页、← → 翻页 + 页码 + 「使用此模板」、Esc/遮罩关闭。

**Task 5.2 市场页** — 新建 `src/components/MarketplacePage.tsx`（~350 行）：
- 顶栏（返回/标题/搜索/上传按钮）、筛选 chips（版式 × 来源 AND，与搜索 AND）、响应式网格（4/3/2 列）
- 卡片：实时 iframe 缩略图（srcdoc + `loading="lazy"` + transform scale，复用 `fitRawIframe` 模式）、hover 浮现「预览」「使用模板」、来源徽标、我的上传删除按钮
- 上传卡（第一位，`<input type="file" multiple accept=".html">`）+ folder 空占位卡 + folder 失败黄条横幅
- 全部数据走 registry，不感知来源

**Task 5.3 视图接线** — `src/App.tsx`：view 加 `'marketplace'`；MarketplacePage 选中 → `useTemplate(id)` → `addDeck` + `setActiveDeck` → view `'editor'`。

**Task 5.4 LandingPage 拆除**（−~300 行）：
- "Start from a Template" 卡片 onClick 改为 `onOpenMarketplace`（新 prop，不再 setMode）
- 删除：templates 数组（:49 起）、`handleTemplateSelect`（:340）、template 模式渲染块（:576 起）、`generateMeetingDeck`、`generateWorkshopDeck`、`import { generateUseCaseTimelineDeck }`、`TemplateEntry` 类型（~~删除文件 `src/templates/usecase-timeline.ts`~~ → 按偏差记录保留，builtin.ts 引用）
- **保留** `generateDeckFromContent`（AI 会话流程 :318/:323 在用）及 vertical/newsletter 相关生成逻辑
- 验证：`grep -r "generateMeetingDeck\|generateWorkshopDeck" src/` 无结果（`generateUseCaseTimelineDeck` 按偏差保留于 builtin.ts 引用链）；`npx tsc --noEmit` 通过

**Task 5.5 AiPanel 快捷预设** — `quickTemplates` 数组加 3 项：Decision Analysis / People Mgmt Meeting / Workshop，text 为 LandingPage 原 `content` 骨架迁移。
- 验证（手动）：落地页 → marketplace 打开/返回；3 内置卡实时缩略图；预览翻页；三种导入模式各走一遍；AI 面板出现 3 个新预设且点击填充

## Phase 6 — Raw 源码编辑器

**Task 6.1 raw 面板** — `src/components/ComponentEditor.tsx` 加 `type === 'raw'` 分支（~50 行）：可折叠 monospace textarea 绑 `props.html`（onChange 走现有 `updateComponentProps`）、折叠的 `props.css` textarea、theme/fit 下拉。
- 验证（手动）：导入 raw 模板 → 选中 raw 组件 → 改文字 → SlidePreview 即时更新

## Phase 7 — 收尾

**Task 7.1 全量检查**：`npm test` + `npx tsc --noEmit` + `npm run build` 三绿。

**Task 7.2 手动 QA**：spec §11 的 9 条清单逐项过（三源浏览/预览/三种导入/筛选搜索/上传增删超限/文件夹不可用降级）。

**Task 7.3 提交**：补齐各 Phase 的 git 提交（Phase 0 若此前被阻塞，此刻必须先补基线再按 Phase 顺序提交）。

---

## 风险与备注

- **bundle 体积**：两个内置 HTML 经生成器文件的 `?raw` 内联约 +180KB 源码文本（gzip 后显著缩小）；卡片 iframe 用懒加载（IntersectionObserver）控制首屏渲染量
- **srcdoc 缩略图样式隔离**：模板 HTML 自带 `<style>`，srcdoc 天然隔离，无泄漏风险；注意注入缩放脚本在 iframe onload 后执行
- **AiPanel 徽标**「DeepSeek V4」与实际模型 qwen3.7-max 不符——既有问题，不在本计划范围（可顺手单开小提交修文案）
- **Electron**：本计划全程浏览器模式验证（`npm run dev`，端口 5174）；Electron 迁移按 spec §10 只动 folder-source.ts
