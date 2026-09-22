# Template Marketplace 设计文档

- 日期：2026-09-21
- 状态：已确认（设计对话定稿）
- 范围：DeckForge 落地页新增 HTML 模板市场——浏览内置/团队文件夹/用户上传三类 HTML 模板，选中即导入编辑器

## 1. 背景与目标

DeckForge 落地页目前有 "Start from a Template" 入口，但模板选择是硬编码在 LandingPage 里的 5 个生成函数列表，没有浏览体验，也不支持用户自带模板。

本设计引入独立的 **Marketplace 页面**：

- 浏览多种版式/配色的 HTML 模板，卡片为实时 iframe 渲染（非截图）
- 支持三类模板来源：内置、团队共享文件夹（dev-server 扫描）、用户上传（IndexedDB）
- 选中模板 → 按模板声明的模式导入 → 直接进编辑器
- 手工精修的富设计模板以 raw 模式导入（设计 100% 保留），并新增 raw 源码编辑面板保证文字可改

### 非目标

- 不做评分/下载量/评论等市场运营功能
- 不做上传后的模板元数据编辑（改名、改标签）
- 不做云端/远程模板库（纯本地三源）
- 不做 Electron 打包下的文件夹选择对话框（浏览器模式优先；Electron 迁移见 §10）
- Newsletter/竖版生成器暂不上架（registry 可扩展，后续增量加）

## 2. 信息架构与入口

### 视图状态

`src/App.tsx` 的 view state 从 `'landing' | 'editor'` 扩为 `'landing' | 'marketplace' | 'editor'`。

```
落地页 "Start from a Template" 卡片
   └→ view = 'marketplace'（全屏页面）
        ├─ 顶栏 "← 返回"      → view = 'landing'
        └─ 选中模板（预览内或卡片直达）
             → useTemplate(id) → addDeck + setActiveDeck
             → view = 'editor'
```

### 旧模板分流

| 现有入口 | 去向 |
|---|---|
| LandingPage `template` 模式内部模板列表（~300 行） | 整体移除；"Start from a Template" 卡片变为纯导航入口 |
| MB Presentation Master（src/templates/template-presentation.html） | 与 PET Master Deck 实为同一生成器，合并为一条内置模板（见 §4.1 实现说明） |
| AI Use Case Timeline（src/templates/ai-usecase-timeline.html） | marketplace 内置模板（generator 类型，见 §4.1 实现说明） |
| PET Master Deck（src/templates/template-pet.ts 生成器） | marketplace 内置模板（generator 类型） |
| People Mgmt Meeting / Workshop / Decision Analysis 三个生成式模板 | AiPanel 快捷预设（复用现有 `quickTemplates` 模式：点击填充结构化提示词到 AI 输入区） |

## 3. 数据模型

新文件 `src/types/template.ts`：

```ts
export type TemplateSource = 'builtin' | 'folder' | 'upload';
export type TemplateKind = 'html' | 'generator';
export type ImportMode = 'structured' | 'raw';

export interface TemplateManifest {
  id: string;            // 'builtin-mb-master' / 'folder-<文件名>' / 'upload-<uuid>'
  name: string;          // 显示名
  description: string;   // 一句话描述 + 页数等摘要
  source: TemplateSource;
  kind: TemplateKind;    // generator = PET 这类直接产 Deck 的 TS 函数
  importMode: ImportMode;  // kind='generator' 时恒为 'raw'（产物即 raw-html slides）
  tags: string[];        // 版式筛选标签：'横版' | '竖版' | 'Newsletter' 等
  slideCount: number;
  fileName?: string;     // 仅 folder 源：marketplace-templates/ 下的文件名
}
```

## 4. 三源注册表

`src/lib/templates/registry.ts` 是唯一对外接口，MarketplacePage 不感知来源细节：

```ts
listTemplates(): Promise<TemplateManifest[]>      // builtin → folder → upload 顺序合并
getTemplateHtml(id: string): Promise<string>      // 仅 kind='html'
addUploads(files: File[]): Promise<TemplateManifest[]>  // 解析 + 校验 + 入库，返回新增
removeUpload(id: string): Promise<void>           // 仅 upload 源
useTemplate(id: string): Promise<Deck>            // 分发导入（§6）
```

三个源各自独立成文件，可单独替换：

### 4.1 builtin 源（src/lib/templates/builtin.ts）

> **实现偏差说明（2026-09-22）**：设计原定前两条内置模板为 `kind: html` 直接 raw 导入。实现时发现两个 HTML 源都需要模板特定的拆分/包装逻辑——`template-presentation.html` 的绝对定位 `.slide` 必须包进 PET 生成器的 960×540 缩放容器才能正确渲染；`ai-usecase-timeline.html` 用的是 `.section` 区块且需两两重组为一张幻灯片；且 "MB Presentation Master" 与 "PET Master Deck" 实为同一生成器（template-pet.ts 包装 template-presentation.html）。因此内置源统一走 `kind: 'generator'`（保留 `template-pet.ts` 与 `usecase-timeline.ts`），`htmlToRawDeck` 只服务于上传与文件夹源。

- 两个生成器函数直接产出 Deck；预览使用模块加载时惰性生成并缓存的只读 deck，`useTemplate` 每次重新执行生成器（保证新 id）
- `slideCount` 由生成产物的 `deck.slides.length` 得出，不硬编码
- manifest 手工声明（含 importMode，generator 恒为 raw）

| id | name | kind | importMode | tags |
|---|---|---|---|---|
| builtin-pet-master | PET Master Deck（即 MB Presentation Master） | generator | raw | 横版, 深色, 母版 |
| builtin-usecase-timeline | AI Use Case Timeline | generator | raw | 横版, 深色, 时间线 |

### 4.2 folder 源（src/lib/templates/folder-source.ts）

- `fetch('/api/templates')` 列目录，`fetch('/api/templates/<file>')` 取内容（§8.1 的 vite 插件提供）
- 解析每个文件：name 取 `<title>`（无则用文件名），slideCount 数 `.slide`，importMode 自动检测（§6.3），tags 至少含版式标签（按页面纵横比判定横版/竖版/Newsletter）
- manifest 每次进 marketplace 页时重新拉取（不缓存——同事随时会往文件夹放新文件）

### 4.3 upload 源（src/lib/templates/upload-store.ts）

- IndexedDB 持久化（§8.2），记录 = manifest 字段 + `html` 全文 + `uploadedAt`
- `addUploads` 做校验与解析（§8.2 流程）

## 5. Marketplace 页面 UI

新文件 `src/components/MarketplacePage.tsx`（~350 行）。视觉遵循现有深色 MB 主题（#0a0a0a 底、#FF9102 主色、#141414 卡片）。

### 布局（自上而下）

1. **顶栏**：`← 返回` | 标题 "Template Marketplace" | 搜索框（按 name/tags 实时过滤）| 橙色按钮「⬆ 上传 HTML 模板」（同上传卡片行为，支持多选）
2. **筛选行**：左组版式 chips（全部 (N) / 横版 / 竖版 / Newsletter），右组来源 chips（内置 / 📁 团队文件夹 / 我的上传）。两组 AND 组合，与搜索词也 AND
3. **模板网格**：响应式（宽屏 4 列，中屏 3 列，窄屏 2 列）

### 模板卡片

- **缩略图区**（16:10 比例）：实时 iframe 渲染模板首页，srcdoc 方式注入，自动缩放（复用导出器 `fitRawIframe` 的 transform: scale 模式，按卡片宽度计算缩放比）
- **信息区**：名称、来源徽标（内置=橙 / 团队文件夹=蓝 / 我的上传=灰，我的上传卡片额外有删除按钮）、description
- **hover**：缩略图上浮现「👁 预览」和「使用模板」两个按钮

### 大图预览（src/components/TemplatePreview.tsx，~120 行）

- 全屏覆盖层（z-index 最高、点击遮罩或 Esc 关闭）
- iframe 渲染整套模板 HTML，注入一段 CSS：默认隐藏所有 `.slide`，只显示当前 index 的那个（与导出演示模式同一实现思路）
- 底部：`← →` 翻页 + 页码指示 + 主按钮「使用此模板」
- 翻页只改注入 CSS 的序号，iframe 不重载

### 特殊卡片

- **上传卡**（网格第一位）：虚线边框、橙色 ⬆ 图标；点击触发隐藏 `<input type="file" multiple accept=".html">`（与 DeckManager 同模式）
- **文件夹空占位卡**：folder 源为空时显示，提示「往 marketplace-templates/ 放 HTML 即自动出现在这里」

## 6. 导入管线

`useTemplate(id)` 按 manifest 分发三条路径：

| kind + importMode | 管线 | 产物 |
|---|---|---|
| generator | 直接执行生成函数 | raw-html slides 的 Deck（现状不变） |
| html + structured | 现有 `importHtmlDeck(html)`（src/lib/html-importer.ts） | 组件化 Deck，完全可编辑 |
| html + raw | 新 util `htmlToRawDeck(html, name)` | raw-html slides 的 Deck，设计保留 |

### 6.1 htmlToRawDeck（src/lib/templates/html-to-raw-deck.ts，~90 行）

1. DOMParser 解析
2. 取 `.slide` 节点列表；为 0 时将 `<body>` 整体视为单页
3. 抽取文档级样式：所有 `<style>` 与 `<link rel="stylesheet">` 的 outerHTML 按原顺序拼接为公共 css
4. 每个 slide 节点 → 一张 `{ layout: 'raw-html', components: [{ type: 'raw', props: { html: 节点 outerHTML, css: 公共 css, theme, fit } }] }` 的幻灯片
5. `fit` 判定：从公共 css 中正则取 `.slide` 的 width/height，高宽比 > 1（竖向）→ `'scroll'`，否则 `'fit'`；取不到默认 `'fit'`
6. 生成 Deck 返回（name 取 manifest.name，frame/theme 用默认值）；入库（addDeck/setActiveDeck）由调用方 App 层完成，util 保持纯函数

### 6.2 structured 模式的适用对象

DeckForge 导出的 HTML（结构可预期：`.slide` div + 语义化组件标记）。上传与文件夹源的自动检测负责识别这类文件。

### 6.3 导入模式自动检测

- `src/lib/html-exporter.ts` 的 `exportDeckToHtml` 增加一行导出标记：`<meta name="generator" content="DeckForge">`
- 检测函数 `detectImportMode(html)`：标记存在 → `'structured'`；否则 → `'raw'`（安全默认：宁可保设计，不强行结构化）
- builtin 模板不走检测，manifest 手工声明

## 7. Raw 源码编辑器

`src/components/ComponentEditor.tsx` 目前没有 `raw` 组件的编辑面板。新增（~50 行）：

- 选中 `type === 'raw'` 的组件时显示可折叠面板
- monospace `<textarea>`（min-height 300px，可拉伸）双向绑定 `props.html`，onChange 走现有 `updateComponentProps`
- 折叠的次要区：`props.css` textarea、`theme`（light/dark）与 `fit`（fit/scroll）下拉
- 编辑即时反映在 SlidePreview 的 RawHtmlLayout（现有渲染，无需改动）

定位：直接改源码，不做富文本或可视化编辑。这是 raw 模板"文字可改"的保底手段。

## 8. 存储层

### 8.1 文件夹源 — vite 插件（写进 vite.config.ts，~50 行）

照 `llmProxyPlugin` 的写法新增 `templatesPlugin`：

- 目录：项目根 `marketplace-templates/`（env `MARKETPLACE_DIR` 可覆盖）
- dev server 中间件：
  - `GET /api/templates` → 实时扫目录，返回 `[{ file, mtime }]`（仅 .html）
  - `GET /api/templates/<file>` → 文件内容（Content-Type: text/html）
- 每次请求实时读磁盘（dev 常开，不做缓存）；目录不存在返回空列表
- 路径安全：resolve 后必须仍位于模板目录内，防目录穿越
- 附 `marketplace-templates/README.md`：说明放文件规则（.html、含 `.slide` 或整页、命名即展示名）

### 8.2 上传源 — IndexedDB（upload-store.ts，~120 行）

- DB `deckforge-templates`（version 1），object store `templates`（keyPath `id`）
- 原生 API 手写 wrapper（openDB/getAll/put/delete），不引入新依赖
- `addUploads(files: File[])` 逐文件处理：
  1. 校验：扩展名 .html；大小 ≤ 5MB
  2. DOMParser 解析，数 `.slide`（0 个则视为 1 页整页模板；连 body 都解析不出 → 抛错该文件，其余继续）
  3. name = `<title>` 文本 || 文件名去扩展
  4. `detectImportMode` 定 importMode；纵横比定版式 tag
  5. 写入 IndexedDB
- 返回成功入库的 manifest 列表；失败文件聚合成一条 toast 报错

## 9. 错误处理

| 场景 | 行为 |
|---|---|
| 上传文件解析不出任何页 | 该文件跳过，toast「<文件名>：未识别出幻灯片」 |
| 上传 >5MB 或非 .html | 拒绝，toast 提示 |
| `/api/templates` 请求失败 | 页面顶部黄条横幅「团队文件夹不可用」，内置+上传源照常 |
| 单个模板 iframe 渲染异常 | 只影响该卡片，卡片显示错误占位（iframe 沙箱隔离） |
| `useTemplate` 导入结果 0 页 / generator 抛错 | toast 报错，停留在 marketplace |
| IndexedDB 打不开（隐私模式等） | 禁用上传按钮 + tooltip 说明；浏览不受影响 |
| 预览翻页越界 | 禁用对应方向按钮 |

## 10. Electron 迁移路径（本次不实现）

folder 源目前依赖 vite dev server。Electron 打包后无 dev server，届时只需重写 `folder-source.ts` 内部：用现有 IPC（`electron.d.ts` 已有 `readFile`，需补 `listDir`）读同一目录。registry 接口与其余两源不动。

## 11. 测试策略

项目当前无测试框架。本次引入最小单测层：

- **vitest**（dev 依赖；vite 项目零配置接入），`npm test` 脚本
- 单测对象为纯函数，约 8 用例：
  - `htmlToRawDeck`：多 slide 拆分 / 无 `.slide` 整页单页 / 公共 css 抽取 / 竖版判定 scroll
  - `detectImportMode`：有/无 DeckForge 标记
  - 上传解析：title 提取（有/无）、slide 计数
- UI 与交互走手动 QA 清单（下方），不引入组件测试框架

### 手动 QA 清单

1. 落地页 "Start from a Template" → marketplace 打开；返回回落地页
2. 3 张内置卡显示实时 iframe 缩略图
3. 大图预览：翻页、页码、Esc 关闭、使用此模板
4. structured 链路：用 DeckForge 导出一个 deck 到 `marketplace-templates/` → marketplace 出现 → 导入 → 组件可编辑
5. raw 链路：内置两张 raw 模板导入 → 渲染与源文件一致 → ComponentEditor 改文字 → 预览即时变化
6. generator 链路：PET 卡导入 → raw deck 生成
7. 筛选 chips（版式×来源组合）与搜索过滤
8. 上传：多选、出现在"我的上传"、删除；5MB 超限与坏 HTML 被拒
9. folder 不可用（临时改名目录）→ 横幅提示，其余源正常

## 12. 文件清单

**新增（11）**

| 文件 | 规模 | 职责 |
|---|---|---|
| src/types/template.ts | ~40 行 | TemplateManifest 及类型 |
| src/lib/templates/registry.ts | ~100 行 | 三源合并 + useTemplate 分发 |
| src/lib/templates/builtin.ts | ~60 行 | 内置 manifest + 生成器注册 |
| src/lib/templates/folder-source.ts | ~60 行 | fetch 文件夹源 |
| src/lib/templates/upload-store.ts | ~120 行 | IndexedDB wrapper + addUploads |
| src/lib/templates/html-to-raw-deck.ts | ~90 行 | raw 导入 util（仅上传/文件夹源） |
| src/lib/templates/import-mode.ts | ~20 行 | detectImportMode（DeckForge 标记检测） |
| src/components/MarketplacePage.tsx | ~350 行 | 市场页 |
| src/components/TemplatePreview.tsx | ~120 行 | 大图预览覆盖层 |
| src/lib/templates/\_\_tests\_\_/templates.test.ts | ~90 行 | vitest 单测（§11） |
| marketplace-templates/README.md | — | 团队放模板的说明 |

**改动（6）**

| 文件 | 变更 |
|---|---|
| src/App.tsx | +`'marketplace'` 视图与路由（~10 行） |
| src/components/LandingPage.tsx | 移除 template 模式列表（−~300 行），"Start from a Template" 卡片改纯入口 |
| src/components/AiPanel.tsx | +3 个快捷预设（~20 行，quickTemplates 模式） |
| src/components/ComponentEditor.tsx | +raw 编辑面板（~50 行） |
| src/lib/html-exporter.ts | +导出标记 meta（~3 行） |
| package.json | +vitest dev 依赖与 `npm test` 脚本 |

净变化约 +700 行（新增 ~1000，移除 ~300）。
