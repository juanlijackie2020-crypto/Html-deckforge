/**
 * Render sample DeckForge decks to standalone HTML so the new slide-type
 * (horizontal / vertical / newsletter) × theme (dark / light) renderings
 * can be viewed directly in a browser.
 *
 * Run:  npx vite-node scripts/render-samples.ts
 * Out:  rendered/*.html  +  rendered/index.html (gallery)
 *
 * This script imports the REAL exporter (`exportDeckToHtml`) so the output
 * matches exactly what DeckForge produces in Presentation/Export mode. The
 * pure markdown→deck generators are verbatim copies of the ones in
 * LandingPage.tsx (they have no React/store deps, so they run in Node).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { v4 as uuid } from 'uuid'
import { exportDeckToHtml } from '@/lib/html-exporter'
import type { Deck, Slide, SlideComponent, SlideTheme } from '@/types/deck'

// ---------------------------------------------------------------------------
// Verbatim copies of the pure generators from LandingPage.tsx
// (escHtml / parseMarkdownDoc / vertical* / newsletter* / splitIntoSections /
//  sectionToSlide). Kept in sync with src/components/LandingPage.tsx.
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface ParsedDoc {
  title: string
  subtitle: string
  sections: { heading: string; items: string[] }[]
}

function parseMarkdownDoc(text: string): ParsedDoc {
  const lines = text.split('\n')
  let title = ''
  let subtitle = ''
  const sections: { heading: string; items: string[] }[] = []
  let current: { heading: string; items: string[] } | null = null

  const pushCurrent = () => {
    if (current && (current.heading || current.items.length)) sections.push(current)
    current = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line === '---') continue
    const h1 = line.match(/^#\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    if (h1) {
      title = title || h1[1].trim()
      continue
    }
    if (h2) {
      if (!subtitle) {
        subtitle = h2[1].trim()
        continue
      }
      pushCurrent()
      current = { heading: h2[1].trim(), items: [] }
      continue
    }
    if (h3) {
      pushCurrent()
      current = { heading: h3[1].trim(), items: [] }
      continue
    }
    const bullet = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '')
    if (bullet) {
      if (!current) current = { heading: '', items: [] }
      current.items.push(bullet)
    }
  }
  pushCurrent()

  if (!title) title = sections[0]?.heading || 'Untitled'
  return { title, subtitle, sections }
}

function verticalCss(theme: SlideTheme): string {
  const dark = theme === 'dark'
  const fg = dark ? '#ffffff' : '#262626'
  const muted = dark ? 'rgba(255,255,255,0.62)' : 'rgba(38,38,38,0.6)'
  const bg = dark ? '#0a0a0a' : '#ffffff'
  const rule = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  return `.vp{width:960px;margin:0 auto;padding:72px 56px 96px;box-sizing:border-box;font-family:'Inter','MB Corpo S Text',sans-serif;color:${fg};background:${bg};}
.vp-head{text-align:center;margin-bottom:56px;}
.vp-kicker{font-size:13px;letter-spacing:0.24em;color:#FF9102;font-weight:700;text-transform:uppercase;}
.vp-head h1{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:54px;line-height:1.08;margin:16px 0 12px;font-weight:normal;}
.vp-sub{font-size:20px;color:${muted};font-weight:300;margin:0;}
.vp-rule{width:80px;height:3px;margin:28px auto 0;background:linear-gradient(90deg,#FF7500,#FF9102,#FFC767);}
.vp-body{max-width:760px;margin:0 auto;}
.vp-body h2{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:30px;margin:44px 0 16px;font-weight:normal;color:${fg};border-left:4px solid #FF9102;padding-left:16px;}
.vp-body section:first-child h2{margin-top:0;}
.vp-body ul{list-style:none;padding:0;margin:0;}
.vp-body li{font-size:18px;line-height:1.7;padding:7px 0 7px 28px;position:relative;color:${muted};}
.vp-body li::before{content:'';position:absolute;left:0;top:17px;width:12px;height:2px;background:#FF9102;}
.vp-foot{text-align:center;margin-top:80px;padding-top:24px;border-top:1px solid ${rule};font-size:12px;letter-spacing:0.18em;color:${muted};text-transform:uppercase;}`
}

function verticalHtml(doc: ParsedDoc): string {
  const sections = doc.sections
    .map((s) => {
      const head = s.heading ? `<h2>${escHtml(s.heading)}</h2>` : ''
      const items = s.items.length
        ? `<ul>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`
        : ''
      return `<section>${head}${items}</section>`
    })
    .join('')
  return `<div class="vp">
  <header class="vp-head">
    <div class="vp-kicker">People &amp; Enterprise Tech</div>
    <h1>${escHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="vp-sub">${escHtml(doc.subtitle)}</p>` : ''}
    <div class="vp-rule"></div>
  </header>
  <div class="vp-body">${sections}</div>
  <footer class="vp-foot">Mercedes-Benz &middot; DeckForge</footer>
</div>`
}

function generateVerticalDeck(text: string, theme: SlideTheme): Deck {
  const doc = parseMarkdownDoc(text)
  const html = verticalHtml(doc)
  const css = verticalCss(theme)
  const slide: Slide = {
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme, fit: 'scroll' } }],
  }
  return {
    id: uuid(),
    meta: { title: doc.title, brand: 'mercedes', tags: ['vertical'] },
    slides: [slide],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function newsletterCss(theme: SlideTheme): string {
  const dark = theme === 'dark'
  const fg = dark ? '#ffffff' : '#262626'
  const muted = dark ? 'rgba(255,255,255,0.6)' : 'rgba(38,38,38,0.62)'
  const bg = dark ? '#0a0a0a' : '#ffffff'
  const divider = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  return `.nl{width:960px;min-height:540px;padding:40px 48px 32px;box-sizing:border-box;font-family:'Inter','MB Corpo S Text',sans-serif;color:${fg};background:${bg};display:flex;flex-direction:column;}
.nl-mast{border-bottom:3px solid #FF9102;padding-bottom:16px;margin-bottom:20px;}
.nl-brand{font-size:12px;letter-spacing:0.26em;color:#FF9102;font-weight:700;text-transform:uppercase;}
.nl-mast h1{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:42px;line-height:1.04;margin:8px 0 4px;font-weight:normal;}
.nl-strap{font-size:15px;color:${muted};font-weight:300;margin:0;}
.nl-cols{column-count:2;column-gap:36px;flex:1;}
.nl-cols section{break-inside:avoid;margin-bottom:16px;}
.nl-cols h2{font-family:'MB Corpo A Title Cond',Georgia,serif;font-size:19px;margin:0 0 6px;font-weight:normal;color:#FF9102;break-after:avoid;}
.nl-cols ul{list-style:none;padding:0;margin:0;}
.nl-cols li{font-size:12.5px;line-height:1.5;padding:3px 0 3px 14px;position:relative;color:${muted};}
.nl-cols li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:2px;background:#FF9102;}
.nl-foot{margin-top:16px;padding-top:12px;border-top:1px solid ${divider};font-size:10px;letter-spacing:0.18em;color:${muted};text-transform:uppercase;text-align:center;}`
}

function newsletterHtml(doc: ParsedDoc): string {
  const sections = doc.sections
    .map((s) => {
      const head = s.heading ? `<h2>${escHtml(s.heading)}</h2>` : ''
      const items = s.items.length
        ? `<ul>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`
        : ''
      return `<section>${head}${items}</section>`
    })
    .join('')
  return `<div class="nl">
  <header class="nl-mast">
    <div class="nl-brand">PET Brief</div>
    <h1>${escHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="nl-strap">${escHtml(doc.subtitle)}</p>` : ''}
  </header>
  <div class="nl-cols">${sections}</div>
  <footer class="nl-foot">People &amp; Enterprise Tech &middot; DeckForge</footer>
</div>`
}

function generateNewsletterDeck(text: string, theme: SlideTheme): Deck {
  const doc = parseMarkdownDoc(text)
  const html = newsletterHtml(doc)
  const css = newsletterCss(theme)
  const slide: Slide = {
    id: uuid(),
    theme,
    layout: 'raw-html',
    components: [{ id: uuid(), type: 'raw', props: { html, css, theme } }],
  }
  return {
    id: uuid(),
    meta: { title: doc.title, brand: 'mercedes', tags: ['newsletter'] },
    slides: [slide],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// --- horizontal (slide-deck) path, mirrored from generateDeckFromContent ---

interface Section {
  heading: string
  items: string[]
}

function splitIntoSections(lines: string[]): Section[] {
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('---')) continue

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/) || trimmed.match(/^[A-Z][^.!?]{3,60}$/)
    if (headingMatch) {
      if (current && (current.heading || current.items.length)) {
        sections.push(current)
      }
      current = { heading: headingMatch[1] || trimmed, items: [] }
    } else {
      if (!current) current = { heading: '', items: [] }
      const bullet = trimmed.replace(/^[\-*•]\s*/, '').replace(/^\d+[.)]\s*/, '')
      if (bullet) current.items.push(bullet)
    }
  }
  if (current && (current.heading || current.items.length)) {
    sections.push(current)
  }

  // Batch small sections (max ~5 bullets per slide)
  const batched: Section[] = []
  let acc: Section | null = null
  for (const s of sections) {
    if (s.heading) {
      if (acc && acc.items.length) batched.push(acc)
      acc = null
      batched.push(s)
    } else {
      if (!acc) acc = { heading: '', items: [] }
      acc.items.push(...s.items)
      if (acc.items.length >= 5) {
        batched.push(acc)
        acc = null
      }
    }
  }
  if (acc && acc.items.length) batched.push(acc)

  return batched.length ? batched : [{ heading: 'Content', items: lines.map((l) => l.trim()).filter(Boolean) }]
}

function sectionToSlide(section: Section, theme: SlideTheme): Slide {
  const components: SlideComponent[] = []
  if (section.heading) {
    components.push({ id: uuid(), type: 'heading', props: { level: 2, text: section.heading, html: '' } })
  }
  if (section.items.length > 0) {
    components.push({ id: uuid(), type: 'list', props: { items: section.items.slice(0, 8), className: '' } })
  }
  const layout = section.items.length > 0 ? 'content' : 'chapter'
  return { id: uuid(), theme, layout, components }
}

function buildHorizontalDeck(text: string, theme: SlideTheme): Deck {
  const lines = text.split('\n').filter((l) => l.trim())
  const title = lines[0]?.replace(/^[#\-*]+\s*/, '').slice(0, 80) || 'Untitled Presentation'
  const slides: Slide[] = []

  slides.push({
    id: uuid(),
    theme,
    layout: 'title',
    components: [
      { id: uuid(), type: 'heading', props: { level: 1, text: title, html: '' } },
      { id: uuid(), type: 'text', props: { text: 'Generated by DeckForge', html: '', className: 'subtitle' } },
    ],
  })

  for (const section of splitIntoSections(lines.slice(1))) {
    slides.push(sectionToSlide(section, theme))
  }

  slides.push({
    id: uuid(),
    theme,
    layout: 'statement',
    components: [{ id: uuid(), type: 'heading', props: { level: 1, text: 'Driving today, shaping tomorrow', html: '' } }],
  })

  return {
    id: uuid(),
    meta: { title, brand: 'mercedes', tags: ['horizontal'] },
    slides,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Sample content + render
// ---------------------------------------------------------------------------

const SAMPLE = `# AI HR Transformation
## Q3 2026 Status Update

### Progress Highlights
- ServiceNow GenAI module pilot live in 2 regions
- HR self-service adoption up 35% QoQ
- DeckForge deck automation shipped to exec team
- AI use-case backlog grown to 24 validated cases

### Blockers & Risks
- Data residency review still pending for HK
- Vendor SLA renegotiation delayed to October
- Change-management capacity constrained

### Next Steps
- Finalize data residency decision by Sep 30
- Roll GenAI module to 3 additional regions
- Executive steering review in October
- Publish AI governance playbook v1
`

const outDir = join(process.cwd(), 'rendered')
mkdirSync(outDir, { recursive: true })

const variants: { name: string; deck: Deck }[] = [
  { name: 'horizontal-dark', deck: buildHorizontalDeck(SAMPLE, 'dark') },
  { name: 'horizontal-light', deck: buildHorizontalDeck(SAMPLE, 'light') },
  { name: 'vertical-dark', deck: generateVerticalDeck(SAMPLE, 'dark') },
  { name: 'vertical-light', deck: generateVerticalDeck(SAMPLE, 'light') },
  { name: 'newsletter-dark', deck: generateNewsletterDeck(SAMPLE, 'dark') },
  { name: 'newsletter-light', deck: generateNewsletterDeck(SAMPLE, 'light') },
]

for (const v of variants) {
  const html = exportDeckToHtml(v.deck)
  writeFileSync(join(outDir, `${v.name}.html`), html)
  console.log(`  ✓ ${v.name}.html`)
}

// Gallery index
const cards = variants
  .map(
    (v) => `    <a class="card" href="${v.name}.html" target="_blank">
      <div class="card-head"><span class="tag">${v.deck.meta.tags[0]}</span><span class="theme">${v.deck.slides[0].theme}</span></div>
      <iframe src="${v.name}.html" loading="lazy" scrolling="no"></iframe>
      <span class="open">Open ↗</span>
    </a>`
  )
  .join('\n')

const gallery = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DeckForge · Rendered Samples</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#0a0a0a; color:#fff; min-height:100vh; padding:48px 32px 64px; }
  h1 { font-size:2rem; font-weight:600; }
  .sub { color:rgba(255,255,255,0.5); margin-top:6px; font-size:0.9rem; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:24px; max-width:1280px; margin:32px auto 0; }
  .card { position:relative; display:block; border:1px solid rgba(255,145,2,0.25); border-radius:14px; overflow:hidden; background:#111; text-decoration:none; transition:transform .25s, border-color .25s; }
  .card:hover { transform:translateY(-4px); border-color:#FF9102; }
  .card-head { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(255,145,2,0.08); border-bottom:1px solid rgba(255,145,2,0.18); }
  .tag, .theme { font-size:0.7rem; letter-spacing:0.08em; text-transform:uppercase; }
  .tag { color:#FF9102; font-weight:700; }
  .theme { color:rgba(255,255,255,0.55); }
  iframe { width:100%; height:300px; border:0; display:block; background:#0a0a0a; }
  .open { position:absolute; bottom:12px; right:14px; font-size:0.75rem; color:#FF9102; font-weight:600; }
</style>
</head>
<body>
  <h1>DeckForge · Rendered Samples</h1>
  <p class="sub">Slide type × theme matrix — vertical scrolls, newsletter fits one page, horizontal is a navigable deck.</p>
  <div class="grid">
${cards}
  </div>
</body>
</html>`

writeFileSync(join(outDir, 'index.html'), gallery)
console.log('  ✓ index.html (gallery)')
console.log(`\nDone → ${outDir}`)
