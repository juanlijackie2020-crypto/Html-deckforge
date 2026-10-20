# 落地页直达生成 实施计划

- 日期：2026-10-20
- 设计依据：[2026-10-20-landing-direct-generation-design.md](../specs/2026-10-20-landing-direct-generation-design.md)
- 原则：每个 Phase 结束时应用可运行、`npx tsc --noEmit` 通过；每 Phase 一个 git 提交

## 已核实的代码事实（写计划时确认，实现时直接依赖）

- `callLLM(messages, system, opts)`（src/lib/llm.ts:34）—— 无超时时由代理 120s 兜底；空文本响应返回 `''`
- `showToast(type, text)`（src/components/Toast.tsx:15）是模块级函数，Toast.tsx 只依赖 react/lucide —— deck-store 引入它**无循环依赖**
- store 用 `persist` 中间件，`partialize` 只持久化 `decks/activeDeckId/activeSlideIndex`
- **`removeDeck` 存在**（deck-store.ts:114）—— spec §6 "无删除分支"有误，回填/重试需防御占位 deck 被删（本计划 Task 3.3 处理，spec 已同步修正）
- **刷新会杀死后台生成任务** —— 持久化 `generation` 并在 rehydrate 时把 `'generating'` 转为可重试的 `'error'`（Task 3.5，spec 已同步修正）
- LandingPage 的 `AUDIENCE_LABELS`/`LANGUAGE_LABELS` 只被 `CLARIFICATION_SYSTEM` 和对话式 user message 使用 —— 两者都删除，**标签表不迁移**
- `generateDeckFromContent` 对空文本会产生"标题 + Thank You"的空壳 deck —— `runDeckGeneration` 需对空 LLM 响应抛错而非静默产出
- SlideEditor 横幅插入点：Toolbar（:96-173）之后、Slide sorter / Main editor 之前 —— 两种视图下都可见
- 测试环境：vitest 3.2.7；store 测试需 `// @vitest-environment jsdom`（persist 要 localStorage）

## Phase 0 — 挂起改动入库（两个独立提交）

**Task 0.1 全树验证** — `npx tsc --noEmit` + `npx vitest run`（现有 12 测试）确认绿。

**Task 0.2 提交落地页配置项功能** — 仅 `src/components/LandingPage.tsx`：Slides 页数/受众/语言/演讲者备注 + prompt 集成。

**Task 0.3 提交 marketplace 轮播修复** — `MarketplacePage.tsx` + `src/lib/templates/__tests__/builtin-preview.test.ts` + `package.json`/`package-lock.json`（@types/jsdom）。

## Phase 1 — deck-generator 库（搬家 + 新函数）

**Task 1.1** 新建 `src/lib/deck-generator.ts`（~430 行）：
- 迁移（逻辑零改动，改 export）：`SlideType`/`Audience`/`OutputLanguage` 类型、`AUDIENCE_PROMPTS`/`LANGUAGE_PROMPTS`、`generateDeckFromContent`、`splitIntoSections`/`sectionToSlide`/`Section`、`buildGenerationSystem`、`ParsedDoc`/`escHtml`/`parseMarkdownDoc`、vertical/newsletter 全套
- 新增 `GenerationOptions` 接口（prompt/theme/slideType/slideCount/audience/language/includeNotes）
- 新增 `createPlaceholderDeck(opts)`：单页 title 布局、theme 跟随 opts、tags `['ai-generated']`、meta.title = 提示词压成单行截 60 字、副标题 "DeckForge AI 正在生成…"（签名比 spec §4.1 少一个参数——prompt 已在 opts 内，避免重复）
- 新增 `runDeckGeneration(opts)`：`callLLM` 单条 user message → 空响应抛错 → `generateDeckFromContent`

验证：`npx tsc --noEmit`（LandingPage 尚有自己的一份副本，重复但不冲突）。

## Phase 2 — deck-store 生成状态

**Task 2.1** `src/store/deck-store.ts`：
- `GenerationState`（deckId/status/message/opts）+ `generation: GenerationState | null`
- `startGeneration(opts): boolean` —— 已在 generating → false；否则占位 deck → addDeck → setActiveDeck → 置状态 → 触发模块级 `runGeneration(deckId, opts)`（async，成功回填+toast「生成完成：N 页」，失败置 error+toast「生成失败」；回填前检查占位 deck 仍存在）
- `retryGeneration()` / `dismissGeneration()`（副标题改"生成已跳过 — 可直接编辑此页"）/ `replaceDeckSlides(deckId, slides, metaPatch?)`（pushHistory + activeSlideIndex 归 0）
- persist：`partialize` 加 `generation`；`onRehydrateStorage` 把 `'generating'` 僵尸转为 `error`（"页面刷新导致生成中断"）

验证：`npx tsc --noEmit`。

## Phase 3 — LandingPage 瘦身 + SlideEditor 横幅

**Task 3.1** 重写 `src/components/LandingPage.tsx`（905 → ~330 行）：删对话流全部（AiPhase/ChatMessage/聊天 UI/CLARIFICATION_SYSTEM/4 个 handler/Send+ArrowLeft 图标/旧静默降级）；`handleGenerate` = `startGeneration(...)` → true 则 `onGenerated()`，false 则 toast「已有生成任务进行中」；按钮 "Next" → "生成并进入编辑器"。

**Task 3.2** `src/components/SlideEditor.tsx` 顶部横幅（`generation.deckId === activeDeckId` 时）：generating = 琥珀条 + Loader2；error = 红条 + message + [重试]（ghost）+ [跳过，直接编辑]（实心琥珀，主操作）。

验证：`npx tsc --noEmit` + 手动 smoke（`npm run dev`）。

## Phase 4 — 测试

**Task 4.1** `src/lib/__tests__/deck-generator.test.ts`：createPlaceholderDeck 形状/截断；generateDeckFromContent 页数（5/2/1）+ notes 解析 + vertical 单页；buildGenerationSystem 指令断言（页数/受众/语言/notes）。

**Task 4.2** `src/store/__tests__/generation-flow.test.ts`（jsdom，mock `@/lib/llm`）：replaceDeckSlides（替换/索引归 0/可 undo）；startGeneration 成功回填 / 失败置 error；并发拒绝（pending 期间二次调用返回 false）；retry；dismiss 副标题改写。

验证：`npx vitest run` 全绿（12 旧 + 新增）。

## Phase 5 — 收尾

**Task 5.1** spec §6 修正（removeDeck 分支 + 刷新中断行为，与本计划"已核实事实"一致）。
**Task 5.2** `npx tsc --noEmit` + `npx vitest run` + `npx vite build` 三绿。
**Task 5.3** 提交：Phase 1+2+4 一个提交（生成基础设施），Phase 3 一个提交（落地页直达 + 编辑器横幅）。
**Task 5.4** 更新记忆文件（marketplace 修复已提交、本功能状态）。
