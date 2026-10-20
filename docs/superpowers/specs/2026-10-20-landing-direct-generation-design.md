# 落地页直达生成 设计文档

- 日期：2026-10-20
- 状态：已确认（设计对话定稿）
- 范围：落地页去掉 AI 多轮对话——一句话提示 + 配置项选好后，点击生成按钮**立即进入编辑器**，LLM 生成在后台完成并自动回填

## 1. 背景与目标

落地页当前是三阶段流程：`input → conversation → generating`。用户输入提示后，澄清 LLM 先问 2–3 个问题，答满两轮（或点 Skip）才开始生成，全程停留在落地页，生成完才进编辑器。

本设计把入口压缩为单阶段：

- **输入即出发**：一句话提示（可附文件）+ 6 组配置 → 点"生成并进入编辑器" → 立刻跳转编辑器
- **后台生成**：跳转瞬间创建占位 deck；LLM 生成（约 30–90 秒）在后台继续，完成后幻灯片整体回填
- **状态全局可见**：编辑器顶部横幅显示生成进度；失败时主操作是"跳过，直接编辑"，占位 deck 留作手动编辑起点
- **配置全保留**：横版/竖版/Newsletter、深/浅主题、页数 1–30、受众、语言、演讲者备注、附件按钮——全部不动

### 非目标

- 不做流式/逐页渐进填充——v1 生成完成后一次性整体回填
- 不做多 deck 并发生成（单任务，见 §6）
- 不做生成中取消/暂停
- AiPanel（编辑器侧边 AI 润色/追加）保持现状，不与本次的生成状态打通
- html-exporter 的 `arguments.callee` 隐患不修（与本次无关）

## 2. 用户流程（新）

```
落地页：输入提示（+可选附件）→ 选 6 组配置 → [生成并进入编辑器]
   ↓ 点击瞬间（同步，不发任何网络请求）
创建占位 deck → addDeck + setActiveDeck → view='editor'
   ↓ 后台（30–90s）
runDeckGeneration：callLLM 一次性生成 → generateDeckFromContent 解析
   ├─ 成功 → replaceDeckSlides 整体回填 + activeSlideIndex 归 0 + toast「生成完成：N 页」
   └─ 失败 → generation.status='error' + 全局 toast「生成失败」
              编辑器红横幅：错误信息 + [跳过，直接编辑]（主）+ [重试]（次）
```

按钮的 disabled 逻辑沿用现状（无内容不可点）。附件行为不变：解析后的文本追加进提示词一起发给 LLM。

## 3. 架构：生成状态归属

**结论：deck-store 持有生成状态，LLM 编排逻辑放独立 lib。**

备选是让 LandingPage 自己发起 async promise、回调里写 store——但点击后组件立即卸载（view 切走），由已卸载组件驱动 store 更新很脆弱，失败/重试状态也没有明确归属。store 是应用里唯一在视图切换中存活的响应式状态层；编辑器按 `generation.deckId === activeDeckId` 订阅，切走再切回状态不丢。

## 4. 模块边界

### 4.1 新文件 `src/lib/deck-generator.ts`

从 LandingPage **原样移出**（逻辑零改动，纯搬家，顺带给 900 行的 LandingPage 减重）：

| 移出内容 | 说明 |
|---|---|
| `SlideType` / `Audience` / `OutputLanguage` | 联合类型，LandingPage 改为从这里 import |
| `buildGenerationSystem(slideType, opts)` | 生成 system prompt（页数精确约束、audience/language/notes 指令） |
| `generateDeckFromContent(text, opts)` | markdown → Deck（横版多页 / 竖版 / newsletter 单页 raw-html） |
| `splitIntoSections` / `sectionToSlide` | 内部辅助，随迁 |
| `AUDIENCE_PROMPTS` / `LANGUAGE_PROMPTS` 等 | buildGenerationSystem 的数据表 |

**新增**：

```ts
export interface GenerationOptions {
  prompt: string        // 含附件解析出的文本
  theme: SlideTheme
  slideType: SlideType
  slideCount: number
  audience: Audience
  language: OutputLanguage
  includeNotes: boolean
}

/** 占位 deck：单张标题页，跳转瞬间创建，回填前用户看到的即此页。 */
export function createPlaceholderDeck(opts: GenerationOptions): Deck
// 形状：meta.title = opts.prompt 压成单行并截断 60 字；meta.brand='mercedes'；meta.tags=['ai-generated']
//       slides = [ { layout:'title', theme: opts.theme,
//                    components: [ heading(提示词摘要), text('DeckForge AI 正在生成…') ] } ]
//       id=uuid、createdAt/updatedAt=now（字段以 src/types/deck.ts 为准）

/** 一次性生成：单条 user message + system prompt，失败直接抛错（无静默降级）。 */
export async function runDeckGeneration(opts: GenerationOptions): Promise<Deck>
// = callLLM([{role:'user', content: opts.prompt}], buildGenerationSystem(...))
//   → generateDeckFromContent(markdown, opts)
```

### 4.2 deck-store 扩展

```ts
interface GenerationState {
  deckId: string
  status: 'generating' | 'error'
  message?: string        // status='error' 时的错误摘要（网络/超时/解析）
  opts: GenerationOptions // 重试所需的完整输入
}
generation: GenerationState | null   // 初始 null
```

新增 action（历史快照语义与现有 action 一致，变更后 `pushHistory()`）：

| action | 行为 |
|---|---|
| `startGeneration(opts): boolean` | 已有 generating 任务 → 返回 `false`（调用方 toast）；否则 createPlaceholderDeck → addDeck → setActiveDeck → 置 `generation` → 异步跑 runDeckGeneration；成功 → replaceDeckSlides + 清 generation + toast「生成完成：N 页」；失败 → `status='error'` + toast「生成失败」 |
| `retryGeneration()` | 用 `generation.opts` 重跑，目标 deckId 不变；重跑前置回 `status='generating'` |
| `dismissGeneration()` | 清 generation；同时把占位页副标题从"正在生成…"改为"生成已跳过 — 可直接编辑此页"（走 updateSlide），占位 deck 保留为普通 deck |
| `replaceDeckSlides(deckId, slides, metaPatch?)` | 整体替换 slides、合并 meta（标题取生成结果的 H1）、`updatedAt` 刷新、`activeSlideIndex=0`、pushHistory |

时序说明：addDeck(占位) 与 replaceDeckSlides(回填) 各推一条历史快照，生成结果天然可 undo 回占位态。

### 4.3 LandingPage 瘦身

**保留**：入口卡片（Generate with AI / Start from a Template）、textarea、6 组配置、附件按钮 + 文件名列表、Recent Decks。

**删除**：

| 类别 | 内容 |
|---|---|
| 状态 | `AiPhase`、`chatMessages`、`chatInput`、`isThinking`、`chatEndRef` |
| 函数 | `handleStartConversation`、`handleChatSend`、`handleGenerateFromConversation`、`handleSkipToGenerate`、`handleBackToInput` |
| 提示词 | `CLARIFICATION_SYSTEM`（澄清问答 prompt 整体废弃） |
| UI | 对话气泡、聊天输入框、thinking spinner、对话头部（返回/Skip 按钮）及相关图标 |
| 降级 | 旧的"LLM 失败就用原文硬拆成幻灯片"fallback（被显式错误 + 跳过/重试取代） |

新 `handleGenerate`：内容校验 → `startGeneration({prompt: content, ...options})` → 返回 true 则 `onGenerated()`。

按钮文案 "Next" → **"生成并进入编辑器"**（Sparkles 图标）。

### 4.4 SlideEditor 顶部横幅

渲染条件：`generation && generation.deckId === activeDeckId`，挂在画布区顶部（工具栏下方）：

- **generating**：琥珀色细条——`Loader2` 旋转 + "正在生成幻灯片…（约 30–90 秒）"
- **error**：红色条——错误信息 + **[跳过，直接编辑]**（主按钮）+ **[重试]**（次级文字按钮）

样式对齐现有设计语言（黑底、`border-white/10`、`#FF9102` 强调、圆角小条），不遮画布、不抢焦点。

## 5. 错误处理（定稿）

1. `runDeckGeneration` 抛错 → store 捕获 → `status='error'`，`message` 取错误摘要
2. 全局 toast「生成失败」——即使用户已切回落地页/模板市场也能感知
3. **[跳过，直接编辑]**：`dismissGeneration()`；占位 deck 保留，用户从提示词标题页开始手动编辑
4. **[重试]**：`retryGeneration()`——LLM 故障多为瞬时，重试一次成本低；不要可在评审砍掉
5. 不再有任何静默降级路径

## 6. 边界行为

| 场景 | 行为 |
|---|---|
| 正在生成时再点生成按钮 | `startGeneration` 返回 false，落地页 toast「已有生成任务进行中」 |
| 生成期间手动编辑占位页 | 允许；回填时整体替换，此期间编辑丢失（v1 接受——横幅在场时页面本就是占位性质） |
| 生成期间切走（回落地页/市场/看别的 deck） | generation 按 deckId 匹配；回到该 deck 横幅仍在；失败 toast 全局可见 |
| 竖版 / Newsletter | 占位同样单页；回填为现有 raw-html 单页结果，逻辑不变 |
| 占位 deck 被删除（`removeDeck` 存在，deck-store） | 回填/失败处理前检查 deck 是否仍在；不在则静默清空 generation（重试入口同理，deck 已删时清除状态） |
| 生成中刷新页面 | 异步任务被杀死——`generation` 随 persist 持久化，rehydrate 时把 `'generating'` 僵尸状态转为可重试的 `'error'`（message「页面刷新导致生成中断」） |
| 生成完成后 undo | 历史快照支持回退到占位态 |

## 7. 测试计划

**新增 `src/lib/__tests__/deck-generator.test.ts`**：

- `createPlaceholderDeck`：单页、layout 'title'、theme 跟随 opts、tags 含 'ai-generated'、meta.title 截断
- `generateDeckFromContent`：迁移后尊重 slideCount 的回归（N 页 = 标题 + N-2 内容 + 结尾）
- `buildGenerationSystem`：断言包含页数约束、audience/language/notes 指令

**新增 `src/store/__tests__/generation-flow.test.ts`**（mock `callLLM`）：

- `replaceDeckSlides`：替换 + activeSlideIndex 归 0 + 可 undo
- `startGeneration` 成功路径：占位创建 → generating → 回填 → generation 清空
- `startGeneration` 失败路径：status='error' + message
- `retryGeneration`：错误后重试成功回填

**回归**：现有 12 个测试保持绿。

**手动 QA**：点击即跳转、横幅出现/消失、失败 → 跳过后占位页副标题更新、重试、Recent Decks 与入口卡片不回归。

## 8. 实施前置

工作树里挂着两个未提交改动，动手前各自单独提交，避免与本功能混进同一个 diff：

1. **落地页生成配置项**（LandingPage.tsx，+168/−32）：Slides 页数 / 受众 / 语言 / 演讲者备注四组配置及 prompt 集成——正是 §4.1 要迁移的逻辑的当前载体。先提交它，本功能的 diff 才能呈现为清晰的"搬家 + 重构"
2. **marketplace 预览轮播修复**（MarketplacePage.tsx + builtin-preview.test.ts + `@types/jsdom`，2026-09-25 已验证 12/12 绿、tsc 干净）

提交前统一跑一次 `npx tsc --noEmit` + `npx vitest run` 确认全绿。

## 9. 文件清单汇总

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/lib/deck-generator.ts` | 新增 | 生成编排 + 占位构建 + 移出的类型/解析器（~450 行，其中 ~350 行自 LandingPage 迁移） |
| `src/store/deck-store.ts` | 修改 | generation state + 4 个新 action |
| `src/components/LandingPage.tsx` | 大改 | 905 行 → ~350 行：删对话流，接 startGeneration |
| `src/components/SlideEditor.tsx` | 修改 | 顶部生成横幅（generating / error 两态） |
| `src/lib/__tests__/deck-generator.test.ts` | 新增 | §7 |
| `src/store/__tests__/generation-flow.test.ts` | 新增 | §7 |
