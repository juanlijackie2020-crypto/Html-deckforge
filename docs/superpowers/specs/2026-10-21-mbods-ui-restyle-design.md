# DeckForge × MBODS UI 重构 设计文档

## 1. 背景与目标

用户要求参照 MBODS 视觉系统重构 DeckForge 全模块 UI（含落地页）。参考资料：

- `C:\Users\JUANLI\presentation\MBODS.html`（7 MB 成品 deck）
- `C:\Users\JUANLI\presentation\mbods-deck\reference\design-system.md`（token 表 + 组件目录 + 动效契约——本 spec 的直接依据）
- `C:\Users\JUANLI\presentation\mbods-deck\template.html`（830 KB 骨架，CSS 可直接比对）

用户提到的"attached video"未随消息到达（本机各目录均无视频文件）；设计完全基于上述 HTML 与文档。视频若后续提供，只可能影响动效细节微调，不影响本 spec 结构。

**已定稿决策**：双主题（浅色为主、跟随系统偏好 + 手动切换顶栏按钮），完整复刻 MBODS 主题模型。

**目标**：

1. App chrome 全模块（landing、marketplace、编辑器外壳、全部浮动层）切换到 MBODS 设计语言：单色 ink 底、MB 橙 `--brand` 主强调 + AI 蓝 `--ai` 次强调、发丝线卡片、kicker 标签、MB Corpo 字体、`var(--ease)` 统一缓动的克制动效。
2. 浅色 / 深色双主题，颜色只经 CSS 变量流转（MBODS 铁律：token 之外无 hex）。

### 非目标

- 不动画布内容：SlidePreview 的幻灯片渲染、deck 主题定义（SlideTheme）、导出 HTML/PPTX/PDF 输出一律不动。
- 不动 PresentationMode（黑底 iframe 全屏演示）。
- 不动任何业务逻辑 / store / 生成流程；测试断言（按文本查询）不受影响。
- 不做 count-up 数字动画（app 内无数字展示场景，YAGNI）。
- 不做 app 内 EN/中文语言切换（MBODS 的双语契约是 deck 层的，与 app 无关）。

## 2. 主题模型（新）

与 MBODS template 同构：

```
初始主题 = localStorage['deckforge-theme'] ('light'|'dark')
         → matchMedia('(prefers-color-scheme: dark)')
         → 'light'
```

- 应用方式：`document.documentElement.classList.toggle('dark', theme === 'dark')`。
- 手动切换（顶栏 ☀/🌙 按钮）写入 localStorage，下次启动生效。
- `index.html` 加内联脚本在 CSS 加载前设好 `dark` class，防止深色用户白闪（FOUC）。
- localStorage 只新增 `deckforge-theme` 一个键；deck-store 既有持久化键不碰。
- 切换瞬间给 `<html>` 加 `theme-anim` class 300ms，让背景/边框/文字色平滑过渡后移除。

## 3. 设计 Token（定稿）

### 3.1 颜色变量（globals.css）

| 变量 | `:root`（浅） | `html.dark` | 用途 |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#000000` | 页面底 |
| `--surface` | `#F4F4F4` | `#121212` | 侧栏 / 面板底 |
| `--surface-elevated` | `#FFFFFF` | `#1A1A1A` | 卡片 / 弹层 |
| `--on-surface` | `#262626` | `#FFFFFF` | 主文字 |
| `--on-surface-2` | `#7D7D7D` | `#A8A8A8` | 次文字 |
| `--on-surface-3` | `#A0A0A0` | `#6E6E6E` | 弱文字 / placeholder |
| `--brand-strong` / `--brand` / `--brand-amber` / `--brand-soft` / `--brand-subtle` | `#FF5402` / `#FF7500` / `#FFA101` / `#FFC767` / `#FFF3E6` | 同浅色（橙色梯度黑白通用） | MB 橙——主强调 |
| `--ai` / `--ai-soft` | `#0078D6` / `#E6F2FB` | `#00B0F0` / `rgba(0,176,240,.15)` | AI 蓝——次强调 |
| `--success` / `--warning` / `--destructive` | `#1E8E3E` / `#B26A00` / `#C8102E` | `#4ADE80` / `#FBBF24` / `#FF5C5C` | 语义色 |
| `--border` / `--border-hover` | `#D9D9D9` / `#BFBFBF` | `rgba(255,255,255,.12)` / `rgba(255,255,255,.24)` | 发丝线 |
| `--contrast-on-brand` | `#FFFFFF` | `#FFFFFF` | 品牌色按钮上的文字 |
| `--grid` | `rgba(0,0,0,.035)` | `rgba(255,255,255,.045)` | grid-lines |

双色规则（沿用 MBODS Part 1 / Part 2 逻辑）：**AI/生成类 = 橙**（`--brand` 系），**模板/导入类 = 蓝**（`--ai` 系）。每个逻辑区块只用一侧，保持一致。

### 3.2 形状 / 阴影 / 缓动

- `--radius: 8px`、`--radius-lg: 12px`、`--radius-xl: 16px`
- `--shadow-sm: 0 1px 2px rgba(0,0,0,.06)`、`--shadow-md: 0 4px 12px rgba(0,0,0,.08)`、`--shadow-lg: 0 12px 32px rgba(0,0,0,.14)`
- `--ease: cubic-bezier(0.32,0.72,0,1)`——唯一缓动；时长：hover .3s、卡片 .5s、reveal .9s

### 3.3 字体

- 标题 / 数字 / logo：`MB Corpo A Title Cond`（本地已装，weight 400）。
- 正文：`MB Corpo S Text`（新增注册 Light 300；Regular 400 / Bold 700 已有）。
- 字体栈：`'MB Corpo S Text', 'PingFang SC', 'Microsoft YaHei', sans-serif`（现状 Inter 排第一但从未加载，删除）。

### 3.4 Tailwind 映射（tailwind.config.js）

```js
darkMode: 'class',
colors: {
  canvas: 'var(--background)',
  surface: 'var(--surface)',
  'surface-elev': 'var(--surface-elevated)',
  ink: 'var(--on-surface)', 'ink-2': 'var(--on-surface-2)', 'ink-3': 'var(--on-surface-3)',
  hairline: 'var(--border)', 'hairline-hover': 'var(--border-hover)',
  brand: 'var(--brand)', 'brand-strong': 'var(--brand-strong)',
  'brand-amber': 'var(--brand-amber)', 'brand-soft': 'var(--brand-soft)',
  'brand-subtle': 'var(--brand-subtle)',
  ai: 'var(--ai)', 'ai-soft': 'var(--ai-soft)',
  success: 'var(--success)', warning: 'var(--warning)', destructive: 'var(--destructive)',
},
fontFamily: { title: [...现状], body: ['MB Corpo S Text', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'] },
```

- 旧 `mb.*` 色板**整体删除**（已验证：SlidePreview / themes / renderer 及所有非重构文件零引用）。
- 约束：`var()` 色不支持 Tailwind 透明度修饰符（`bg-brand/10` 之类）——半透明需求一律用既有 token（`--brand-subtle`、`--ai-soft`、`--border`），不新增颜色。

## 4. 模块边界

### 4.1 主题基建

**新文件 `src/lib/theme.ts`**：

```ts
export type Theme = 'light' | 'dark'
export function getInitialTheme(): Theme   // 优先级见 §2；matchMedia 异常时回退 'light'
export function applyTheme(t: Theme): void // 切 html.dark class + 300ms theme-anim
export function toggleTheme(): Theme       // 翻转 + localStorage('deckforge-theme') + applyTheme
```

**`index.html`**：`<head>` 首段内联脚本（try/catch 包裹）按 §2 逻辑设 `dark` class；`<body>` 背景由 CSS 接管。

**`src/main.tsx`**：启动时 `applyTheme(getInitialTheme())`（与内联脚本互为保险）。

**globals.css `@layer components` 原语**（组件用原语 + Tailwind 布局类组合，避免每个组件重复手写）：

- `.kicker`——flex、`::before` 3×14px 橙色竖条、10px 大写字距标签、`ink-2`；`.kicker.cool` 竖条与文字转 `--ai`。
- `.card`——`bg-surface-elev` + 1px hairline + `--radius-lg` + `--shadow-sm`；hover 由组件加 `hover:border-hairline-hover` + 阴影升至 `--shadow-md`（.5s `var(--ease)`）。
- `.pill` / `.pill.on` / `.pill.on.cool`——选项胶囊：默认 hairline + ink-2，hover border-hover；选中 = `--brand` 边 + `--brand-subtle` 底 + ink 文字（cool 变体用 ai / ai-soft）。
- `.btn-primary`——平面 `--brand` 底 + `--contrast-on-brand` 文字 + 胶囊圆角，hover `--brand-strong`；disabled = surface 底 + ink-3。**取代现有橙色渐变按钮**。
- `.btn-ghost`——透明底 + hairline + ink-2，hover surface-elev + border-hover。
- `.og` / `.bl`——标题内渐变强调 span（橙 `--brand-strong→--brand-amber` / 纯 `--ai`）。

**环境层**：`.orb.o1/o2/o3`（绝对定位、blur 100px、28–34s 漂移 keyframes；o1 橙右上、o2 蓝左下、o3 琥珀中部；浅色主题降低不透明度）；`.grid-lines`（72px 网格 hairline + 径向 mask 渐隐）；`.rv` / `.rv-d1…d6`（见 §5）。

**主题相关全局修正**：滚动条 thumb 按主题（浅 `rgba(0,0,0,.15)`）；`select option` 深色底仅在 `html.dark` 下设；focus ring 改 `--brand` 50%。

### 4.2 LandingPage（cover 化）

- 底：`bg-canvas`；环境层 = `.orb.o1/o2/o3` + `.grid-lines`（**替换**现有三芒星 SVG 平铺 + 双橙色光晕 + vignette）。
- 右上角：主题切换按钮（lucide `Sun`/`Moon`，`.btn-ghost` 圆形）。
- 中轴内容：
  - `.kicker`：`DECKFORGE ｜ AI PRESENTATION STUDIO`
  - H1（A Title Cond，~4xl）：`Create stunning <span class="og">presentations</span> in seconds`
  - 副行 `ink-2`
- 入口 duo（替换现有两张卡片）：
  - `Generate with AI`——橙色顶线（`.card` + 3px `--brand` 上边框 + brand-subtle 微底），Featured 态
  - `Start from a Template`——蓝色顶线（3px `--ai`），hairline 常态，hover border-hover
- 生成器卡片：`.card` + `--radius-xl` + `--shadow-md`；textarea 透明底 ink 文字 ink-3 placeholder；六组配置全部换 `.pill` / `.pill.on`（注意：Theme 组选的是 **deck** 主题、与 app 主题无关，仅视觉同样用 `.pill`）；`生成并进入编辑器` = `.btn-primary`；Attach = `.btn-ghost`。
- Recent Decks：`.kicker` + 横排 `.card`（hover `border-brand-soft`）。
- 入场动效：kicker/H1 `.rv`、入口 duo `.rv-d1`、生成器 `.rv-d2`、Recent `.rv-d3`。
- 逻辑（handleGenerate / handleFiles / 选项 state）零改动。

### 4.3 MarketplacePage

- 头部：返回按钮（`.btn-ghost` + `← Back`）、`.kicker` `TEMPLATE MARKETPLACE ｜ N TEMPLATES`、搜索框（surface 底 hairline 边，focus ring brand）、筛选 chips 换 `.pill`、主题切换按钮。
- 模板卡片 = MBODS gallery-card 同构：`.card` + 顶部 3px 状态条（结构化模板 = `--brand`，raw 导入 = `--ai`）+ hover 边框/阴影升级（.5s `var(--ease)`）+ 页码 chip。
- 全屏 TemplatePreview：头部条 surface-elev + 底 hairline，控制按钮 `.btn-ghost`，其余不动。

### 4.4 编辑器外壳

- **Sidebar rail**：`bg-surface` + 右 hairline；激活 tab = 左缘 3px `--brand` 竖条（与 kicker 同构）+ brand 图标 + brand-subtle 底；非激活 ink-2 → hover ink；badge = brand 胶囊。
- **左侧面板**（SlidePanel / AiPanel / ExportPanel / BrandKitPanel / ThemePanel / DeckManager）：`bg-surface` + 右 hairline；区块标题 `.kicker`；内部输入/按钮/列表项全部 token 化（`bg-white/5` → `bg-canvas` 或 surface-elev、`text-white/xx` → ink 系、橙色元素 → brand 系、模板/导入类元素 → ai 系）。
- **SlideEditor chrome**：顶栏 surface-elev + 底 hairline（标题、deck 名、动作按钮 token 化）；生成横幅——进行中 = `--warning` 竖条 + surface-elev 底，失败 = `--destructive` 竖条 + 动作按钮（跳过 = `.btn-primary`，重试 = `.btn-ghost`）；画布区 `bg-surface`。
- **ComponentEditor 浮动面板**：surface-elev + hairline + `--radius-lg` + `--shadow-lg`；AI rewrite 四按钮换 `.pill`（loading 态 brand 边）；工具栏图标 ink-2 → hover brand。
- **ShortcutsOverlay**：surface-elev + hairline + `--radius-xl`；kbd = surface 底 hairline 边。
- **Toast**：callout 同构——surface-elev 底 + 左缘 3px 语义色条（success/warning/destructive/info=ai）+ `--shadow-lg`。

### 4.5 App.tsx / PresentationMode

App 外层容器 `bg-mb-black text-white` → `bg-canvas text-ink`；ShortcutsOverlay 随 §4.4 重构；PresentationMode 黑底 iframe 不动。

## 5. 动效规范

- `.rv`：`opacity:0; transform:translateY(14px)` → `.9s var(--ease)` forwards；`.rv-d1…d6` 延迟 90ms 步进（90/180/270/360/450/540ms）。
- 现有 `animate-slide-up/fade-in/scale-in` 保留但缓动统一改 `var(--ease)`，时长对齐（hover .3s / 卡片 .5s / 弹层 .2s）。
- 主题切换过渡：`html.theme-anim *` 300ms background/border/color 过渡，超时移除 class。
- **`@media (prefers-reduced-motion: reduce)` 清零一切动画**（含 `.rv` 直接置终态、orbs 停止）——MBODS 铁律。

## 6. 边界行为

1. **FOUC**：深色用户首次加载由 index.html 内联脚本在 CSS 前设 class 兜底；脚本异常（localStorage 禁用）→ 浅色，无崩溃。
2. **脏 localStorage 值**：`deckforge-theme` 非 `'light'|'dark'` → 视为未设置，走系统偏好。
3. **jsdom 测试环境**：`matchMedia` 未实现 → try/catch 回退 `'light'`；theme 测试自行 stub。
4. **持久化兼容**：deck-store 的 persist 键、生成状态、历史栈与本次改动零交集（纯视觉层）。
5. **旧类清理**：`mb-*` 色板删除后，`grep -r 'bg-mb-\|text-mb-\|border-mb-'` 在 src 内必须零命中（SlidePreview 已验证无引用）。
6. **深色 select option**：option 背景不能吃 CSS 变量（浏览器限制），仅在 `html.dark` 下写死 `#1A1A1A`——这是唯一允许的 token 外色值，加注释说明。

## 7. 测试计划

- **新增 `src/lib/__tests__/theme.test.ts`**（jsdom）：getInitialTheme 三级优先级（stored > system > light）、脏值回退、toggleTheme 翻转 + 持久化 + html.dark class 同步、applyTheme 幂等。约 5 个用例。
- **回归**：`npx tsc --noEmit` 零错误；`npx vitest run` 既有 30 用例全绿（按文本断言，不受类名影响）；`npx vite build` 通过。
- **手工 QA（双主题各过一遍）**：landing 入场动效与 orbs、生成跳转与横幅、marketplace 卡片 hover 与全屏预览、编辑器三面板 + ComponentEditor + Toast、主题切换即时生效 + 刷新持久 + 系统偏好跟随、reduced-motion 模拟。

## 8. 实施前置

- 参考文件：`mbods-deck/reference/design-system.md`（token 权威）、`template.html`（细节比对）。
- 字体已确认本机安装：MBCorpoATitleCondOffice-Regular、MBCorpoSTextOffice-{Light,Regular,Bold}。
- dev server（后台任务 boazbib7n，端口 5174）热更新可直接目检；实施期间保持运行。

## 9. 文件清单汇总

| 操作 | 文件 | 内容 |
|---|---|---|
| A | `src/lib/theme.ts` | 主题读写与应用（§4.1） |
| A | `src/lib/__tests__/theme.test.ts` | 主题单测（§7） |
| M | `src/styles/globals.css` | token 层 + @layer components 原语 + 环境层 + 动效（§3–§5） |
| M | `tailwind.config.js` | 语义色映射 + darkMode + 字体栈 + 删旧色板（§3.4） |
| M | `index.html` | 内联防白闪脚本 |
| M | `src/main.tsx` | 启动 applyTheme |
| M | `src/App.tsx` | 容器 token 化 + ShortcutsOverlay 重构 |
| M | `src/components/LandingPage.tsx` | cover 化（§4.2） |
| M | `src/components/MarketplacePage.tsx` | gallery-card 化（§4.3） |
| M | `src/components/TemplatePreview.tsx` | 头部 token 化 |
| M | `src/components/Sidebar.tsx` | rail 指示条（§4.4） |
| M | `src/components/SlidePanel.tsx` | token 化 + kicker |
| M | `src/components/AiPanel.tsx` | token 化 + kicker |
| M | `src/components/ExportPanel.tsx` | token 化 + kicker |
| M | `src/components/BrandKitPanel.tsx` | token 化 + kicker |
| M | `src/components/ThemePanel.tsx` | token 化 + kicker |
| M | `src/components/DeckManager.tsx` | token 化 + kicker |
| M | `src/components/SlideEditor.tsx` | 顶栏 + 横幅 + 画布底（§4.4） |
| M | `src/components/ComponentEditor.tsx` | 浮动面板 token 化 |
| M | `src/components/Toast.tsx` | callout 化 |

共 20 个文件（2 新增 + 18 修改）。
