import type { Deck, Slide, ThemeConfig } from '@/types/deck'
import { MB_THEME, DELOITTE_THEME, DEFAULT_BRAND_KIT } from '@/types/deck'

export function exportDeckToHtml(deck: Deck): string {
  const baseTheme = deck.meta.brand === 'deloitte' ? DELOITTE_THEME : MB_THEME
  const kit = deck.brandKit || DEFAULT_BRAND_KIT
  const theme: ThemeConfig = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: kit.primaryColor,
      secondary: kit.secondaryColor,
      accent: kit.accentColor,
      background: kit.darkBg,
    },
    fonts: { title: kit.titleFont, body: kit.bodyFont },
  }
  const slidesHtml = deck.slides.map((slide, i) => renderSlide(slide, i, theme)).join('\n\n')

  const hasChapterNav = deck.frame?.type === 'chapter-nav'
  const chapterNavHtml = hasChapterNav ? generateChapterNavHtml(deck) : ''
  const chapterNavStyles = hasChapterNav ? generateChapterNavStyles() : ''
  const chapterNavScript = hasChapterNav ? generateChapterNavScript() : ''
  const bodyClass = hasChapterNav ? ' class="has-chapternav"' : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="DeckForge">
    <title>${escapeHtml(deck.meta.title)}</title>
    <style>
${generateStyles(theme)}
${generateEditStyles()}
${chapterNavStyles}
    </style>
</head>
<body${bodyClass}>
    ${chapterNavHtml}
    <div class="progress-bar" id="progressBar"></div>
    <div class="presentation" id="presentation">
${slidesHtml}
    </div>
    ${generateNavigation(deck.slides.length)}
    ${generateEditControls()}
    <script>
${generateScript()}
${generateEditScript(deck.meta.title)}
${chapterNavScript}
    </script>
</body>
</html>`
}

function renderSlide(slide: Slide, index: number, _theme: ThemeConfig): string {
  const activeClass = index === 0 ? ' active' : ''
  const themeClass = slide.theme === 'light' ? 'slide-light' : 'slide-dark'

  // Raw-HTML slides render verbatim markup in an isolated, auto-scaled iframe.
  if (slide.layout === 'raw-html') {
    const raw = slide.components.find((c) => c.type === 'raw')
    if (raw) {
      const html = (raw.props.html as string) || ''
      const css = (raw.props.css as string) || ''
      const fitMode = (raw.props.fit as 'fit' | 'scroll' | undefined) || 'fit'
      const bodyClass = slide.theme === 'light' ? 'light-theme' : ''
      const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}\nhtml,body{overflow:hidden;margin:0;}\n.page{min-height:auto;width:960px;}\n</style></head><body class="${bodyClass}"><div class="page">${html}</div></body></html>`
      const notesHtml = slide.notes ? `<div class="slide-notes" data-notes="${escapeHtml(slide.notes)}">${escapeHtml(slide.notes)}</div>` : ''
      if (fitMode === 'scroll') {
        return `        <div class="slide slide-raw slide-raw-scroll ${themeClass}${activeClass}">
            <div class="raw-scroll-spacer">
                <iframe class="raw-iframe raw-iframe-scroll" srcdoc="${escapeSrcDoc(doc)}" onload="fitRawIframe(this)"></iframe>
            </div>
            ${notesHtml}
        </div>`
      }
      return `        <div class="slide slide-raw ${themeClass}${activeClass}">
            <iframe class="raw-iframe" srcdoc="${escapeSrcDoc(doc)}" onload="fitRawIframe(this)"></iframe>
            ${notesHtml}
        </div>`
    }
  }

  const logoSvg = `<div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div>`

  const content = slide.components
    .map((comp) => {
      const anim = comp.props.animation as string | undefined
      const delay = (comp.props.animationDelay as number) || 0
      const animClass = anim ? ` anim-${anim}` : ' animate-in'
      const delayStyle = delay ? `animation-delay:${delay}ms;` : ''

      switch (comp.type) {
        case 'heading': {
          const tag = comp.props.level === 1 ? 'h1' : 'h2'
          return `            <${tag} class="${animClass.trim()}" style="text-align:center;${delayStyle}">${comp.props.html || escapeHtml(comp.props.text as string)}</${tag}>`
        }
        case 'text':
          return `            <p class="subtitle${animClass}" style="${delayStyle}">${comp.props.html || escapeHtml(comp.props.text as string)}</p>`
        case 'list': {
          const items = (comp.props.items as string[]).map((item) => `                <li>${escapeHtml(item)}</li>`).join('\n')
          return `            <ul class="animate-in" style="list-style:none; padding:0; max-width:900px; width:100%; position:relative; z-index:1;">\n${items}\n            </ul>`
        }
        case 'table': {
          const headers = (comp.props.headers as string[]).map(h => `<th contenteditable="true">${escapeHtml(h)}</th>`).join('')
          const rows = (comp.props.rows as string[][]).map(r => `<tr>${r.map(c => `<td contenteditable="true">${escapeHtml(c)}</td>`).join('')}</tr>`).join('\n')
          return `            <div class="interactive-table-wrap animate-in"><div class="table-controls"><button onclick="tableAddCol(this)">+ Col</button><button onclick="tableRemoveCol(this)">- Col</button><button onclick="tableAddRow(this)">+ Row</button><button onclick="tableRemoveRow(this)">- Row</button></div><table class="interactive-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`
        }
        case 'chart': {
          const chartType = comp.props.chartType as string
          const chartTitle = comp.props.title as string
          const labels = comp.props.labels as string[]
          const values = comp.props.values as number[]
          const colors = ['#FF9102', '#FFC767', '#00B0F0', '#FF7500', '#0078D6', '#FFA101']
          if (chartType === 'bar') {
            const max = Math.max(...values, 1)
            const bars = labels.map((l, i) => `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><span style="font-size:0.8rem;width:60px;flex-shrink:0;opacity:0.8;">${escapeHtml(l)}</span><div style="flex:1;height:28px;background:rgba(255,255,255,0.05);border-radius:4px;"><div style="height:100%;width:${(values[i]/max)*100}%;background:${colors[i % colors.length]};border-radius:4px;"></div></div><span style="font-size:0.8rem;width:36px;text-align:right;opacity:0.8;">${values[i]}</span></div>`).join('')
            return `            <div class="animate-in" style="width:100%;max-width:800px;position:relative;z-index:1;">${chartTitle ? `<p style="font-size:0.9rem;font-weight:600;margin-bottom:12px;">${escapeHtml(chartTitle)}</p>` : ''}${bars}</div>`
          }
          // Pie chart SVG
          const total = values.reduce((a, b) => a + b, 0) || 1
          let cum = 0
          const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)
          const slices = values.map((v, i) => {
            const start = cum; cum += (v / total) * 360
            const r = 45
            const sx = 50 + r * Math.cos(toRad(start)), sy = 50 + r * Math.sin(toRad(start))
            const ex = 50 + r * Math.cos(toRad(cum)), ey = 50 + r * Math.sin(toRad(cum))
            const large = cum - start > 180 ? 1 : 0
            return `<path d="M 50 50 L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z" fill="${colors[i % colors.length]}" stroke="${slide.theme === 'dark' ? '#0d0d0d' : '#ffffff'}" stroke-width="0.5"/>`
          }).join('')
          const legend = labels.map((l, i) => `<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;"><span style="width:10px;height:10px;border-radius:2px;background:${colors[i % colors.length]};flex-shrink:0;"></span><span style="opacity:0.8;">${escapeHtml(l)}: ${values[i]}</span></div>`).join('')
          return `            <div class="animate-in" style="display:flex;align-items:center;gap:40px;position:relative;z-index:1;"><svg viewBox="0 0 100 100" style="width:160px;height:160px;flex-shrink:0;">${slices}</svg><div style="display:flex;flex-direction:column;gap:6px;">${chartTitle ? `<p style="font-size:0.9rem;font-weight:600;margin-bottom:8px;">${escapeHtml(chartTitle)}</p>` : ''}${legend}</div></div>`
        }
        case 'image': {
          const src = comp.props.src as string
          const caption = comp.props.caption as string | undefined
          if (src) {
            return `            <div class="image-placeholder animate-in"><img src="${escapeHtml(src)}" alt="${escapeHtml(comp.props.alt as string)}"></div>${caption ? `\n            <p class="animate-in" style="font-size:0.8rem;opacity:0.6;margin-top:8px;">${escapeHtml(caption)}</p>` : ''}`
          }
          return `            <div class="image-placeholder animate-in" onclick="handleImageClick(this)"><div class="upload-hint"><span class="hint-icon">&#128247;</span><span>Click to upload image</span></div></div>`
        }
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')

  const notesHtml = slide.notes ? `<div class="slide-notes" data-notes="${escapeHtml(slide.notes)}">${escapeHtml(slide.notes)}</div>` : ''

  return `        <div class="slide ${themeClass}${activeClass}">
            <div class="star-bg"></div>
            ${logoSvg}
            <div style="text-align:center; position:relative; z-index:1; width:100%; max-width:1100px;">
${content}
            </div>
            <div class="slide-footer"><span>CHAPTER</span><span>TITLE / 2026</span></div>
            ${notesHtml}
        </div>`
}

function generateNavigation(totalSlides: number): string {
  return `
    <div class="nav-controls">
        <button class="nav-btn" onclick="prevSlide()">&#8592;</button>
        <span class="slide-counter" id="slideCounter">1 / ${totalSlides}</span>
        <button class="nav-btn" onclick="nextSlide()">&#8594;</button>
    </div>`
}

function generateScript(): string {
  return `let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;
const progressBar = document.getElementById('progressBar');
const slideCounter = document.getElementById('slideCounter');

function updateSlide() {
    slides.forEach((slide, index) => {
        slide.classList.remove('active', 'prev');
        if (index === currentSlide) slide.classList.add('active');
        else if (index < currentSlide) slide.classList.add('prev');
    });
    progressBar.style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
    slideCounter.textContent = (currentSlide + 1) + ' / ' + totalSlides;
}

function nextSlide() { if (currentSlide < totalSlides - 1) { currentSlide++; updateSlide(); } }
function prevSlide() { if (currentSlide > 0) { currentSlide--; updateSlide(); } }

document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
    else if (e.key === 'n' || e.key === 'N') { document.querySelector('.presentation').classList.toggle('show-notes'); }
});

let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextSlide() : prevSlide(); }
});

updateSlide();

// Listen for postMessage from parent (DeckForge editor presentation mode)
window.addEventListener('message', function(e) {
    if (e.data && typeof e.data.goToSlide === 'number') {
        currentSlide = Math.max(0, Math.min(e.data.goToSlide, totalSlides - 1));
        updateSlide();
    }
});

// === Raw-HTML slide autoscaling ===
// Raw slides render verbatim markup inside an iframe at a 960px design width;
// fitRawIframe measures the content and uniformly scales it to fill the slide.
function fitRawIframe(iframe) {
    try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc || !doc.body) return;
        var h = doc.body.scrollHeight;
        if (!h) return;
        var slide = iframe.closest('.slide') || iframe.parentElement;
        if (iframe.classList.contains('raw-iframe-scroll')) {
            // Vertical one-pager: scale by width only, anchor top-left, and let
            // the slide scroll to reveal tall content. A spacer carries the
            // scaled height so the scrollbar matches the visible content.
            var sw = slide.clientWidth;
            var s = sw / 960;
            iframe.style.height = h + 'px';
            iframe.style.width = '960px';
            iframe.style.left = '0px';
            iframe.style.top = '0px';
            iframe.style.transform = 'scale(' + s + ')';
            var spacer = iframe.parentElement;
            if (spacer && spacer.classList.contains('raw-scroll-spacer')) {
                spacer.style.height = (h * s) + 'px';
                spacer.style.width = '100%';
            }
        } else {
            iframe.style.height = h + 'px';
            var s2 = Math.min(slide.clientWidth / 960, slide.clientHeight / h);
            iframe.style.transform = 'translate(-50%, -50%) scale(' + s2 + ')';
        }
    } catch (e) { /* same-origin srcdoc; ignore */ }
}
window.addEventListener('resize', function() {
    document.querySelectorAll('.raw-iframe').forEach(fitRawIframe);
});`
}

function generateStyles(theme: ThemeConfig): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@font-face { font-family: 'MB Corpo A Title Cond'; src: local('MB Corpo A Title Cond Office'), local('MBCorpoATitleCondOffice-Regular'); font-weight: normal; }
@font-face { font-family: 'MB Corpo S Text'; src: local('MB Corpo S Text Office'), local('MBCorpoSTextOffice-Regular'); font-weight: normal; }

:root {
    --red: #FF0000; --orange-dark: #FF7500; --orange: ${theme.colors.primary}; --amber: #FFA101;
    --gold: ${theme.colors.secondary}; --black: #0a0a0a; --charcoal: #262626;
    --gray: #7D7D7D; --light-gray: #D9D9D9; --blue: #0078D6; --cyan: ${theme.colors.accent}; --white: #ffffff;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: var(--black); color: var(--white); }
.presentation { width: 100%; height: 100vh; position: relative; overflow: hidden; }
.slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; opacity: 0; transform: translateX(100%); transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); padding: 60px 80px; }
.slide.active { opacity: 1; transform: translateX(0); }
.slide.prev { opacity: 0; transform: translateX(-100%); }
.slide-dark { background: #0a0a0a; }
.slide-dark::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top right, rgba(255, 140, 0, 0.25) 0%, transparent 45%), radial-gradient(ellipse at bottom left, rgba(255, 117, 0, 0.2) 0%, transparent 45%); pointer-events: none; }
.slide-light { background: #ffffff; color: var(--charcoal); }
.slide-raw { padding: 0 !important; display: block !important; overflow: hidden; }
.slide-raw .raw-iframe { position: absolute; top: 50%; left: 50%; width: 960px; border: 0; transform-origin: center center; background: #0a0a0a; }
.slide-raw.slide-light .raw-iframe { background: #f5f5f5; }
.slide-raw-scroll { overflow-y: auto !important; overflow-x: hidden !important; }
.slide-raw-scroll::before { display: none !important; }
.slide-raw .raw-scroll-spacer { position: relative; width: 100%; }
.slide-raw .raw-iframe-scroll { top: 0 !important; left: 0 !important; transform-origin: top left !important; pointer-events: none; }
.slide-light::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top left, rgba(255, 199, 103, 0.35) 0%, transparent 40%), radial-gradient(ellipse at bottom right, rgba(255, 199, 103, 0.3) 0%, transparent 40%); pointer-events: none; }
.star-bg { position: absolute; inset: 0; opacity: 0.12; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 70 70'%3E%3Cpath d='M35 20 L36.3 33.2 L46.5 40.5 L35 36.5 L23.5 40.5 L33.7 33.2 Z' fill='%23ffffff'/%3E%3C/svg%3E"); background-repeat: repeat; pointer-events: none; }
.slide-light .star-bg { opacity: 0.06; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 70 70'%3E%3Cpath d='M35 20 L36.3 33.2 L46.5 40.5 L35 36.5 L23.5 40.5 L33.7 33.2 Z' fill='%23c8a050'/%3E%3C/svg%3E"); }
.mb-logo { width: 48px; height: 48px; position: absolute; top: 30px; left: 50%; transform: translateX(-50%); color: var(--white); }
.slide-light .mb-logo { color: var(--charcoal); }
.mb-logo svg { width: 100%; height: 100%; }
h1, h2 { font-family: 'MB Corpo A Title Cond', Georgia, serif; font-weight: normal; letter-spacing: 0.01em; line-height: 1.15; }
h1 { font-size: 3.2rem; margin-bottom: 0.5em; }
h2 { font-size: 2.6rem; margin-bottom: 0.6em; }
.subtitle { font-size: 1.2rem; font-weight: 300; opacity: 0.8; letter-spacing: 0.05em; }
ul li { padding: 8px 0; font-size: 0.95rem; line-height: 1.5; padding-left: 20px; position: relative; }
ul li::before { content: '\\2022'; position: absolute; left: 0; color: var(--orange); font-weight: bold; }
.data-table { width: 100%; max-width: 1200px; border-collapse: collapse; position: relative; z-index: 1; font-size: 0.9rem; }
.data-table thead th { background: linear-gradient(90deg, var(--orange-dark), var(--amber)); color: var(--white); padding: 14px 16px; text-align: left; font-weight: 600; }
.data-table tbody td { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.data-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.02); }
.image-placeholder { width: 100%; max-width: 600px; aspect-ratio: 16/9; background: var(--charcoal); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; border: 1px solid rgba(255,145,2,0.2); }
.image-placeholder img { width: 100%; height: 100%; object-fit: cover; }
.slide-footer { position: absolute; bottom: 20px; left: 80px; right: 80px; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--gray); text-transform: uppercase; letter-spacing: 0.1em; }
.nav-controls { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; z-index: 1000; background: rgba(26, 26, 26, 0.9); backdrop-filter: blur(10px); padding: 12px 24px; border-radius: 50px; border: 1px solid rgba(255, 145, 2, 0.2); }
.nav-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; font-size: 1.2rem; }
.nav-btn:hover { border-color: var(--orange); background: rgba(255, 145, 2, 0.1); color: var(--orange); }
.slide-counter { font-size: 0.85rem; font-weight: 500; color: var(--gray); min-width: 60px; text-align: center; }
.progress-bar { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg, var(--red), var(--orange), var(--gold)); transition: width 0.4s ease; z-index: 1001; }
.animate-in { opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease, transform 0.5s ease; }
.slide.active .animate-in { opacity: 1; transform: translateY(0); }
.slide.active .animate-in:nth-child(2) { transition-delay: 0.1s; }
.slide.active .animate-in:nth-child(3) { transition-delay: 0.2s; }

/* Per-element entrance animations */
[class*="anim-"] { opacity: 0; animation-duration: 0.6s; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
.slide.active [class*="anim-"] { animation-play-state: running; }
.slide:not(.active) [class*="anim-"] { animation-play-state: paused; opacity: 0; }
.slide.active .anim-fade-up { animation-name: fadeUp; }
.slide.active .anim-fade-in { animation-name: fadeIn; }
.slide.active .anim-slide-left { animation-name: slideLeft; }
.slide.active .anim-slide-right { animation-name: slideRight; }
.slide.active .anim-scale-up { animation-name: scaleUp; }
.slide.active .anim-blur-in { animation-name: blurIn; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@keyframes blurIn { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: blur(0); } }

/* Speaker notes */
.slide-notes { display: none; position: absolute; bottom: 50px; left: 80px; right: 80px; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); border: 1px solid rgba(255,145,2,0.3); border-radius: 8px; padding: 16px 20px; font-size: 0.85rem; line-height: 1.6; color: rgba(255,255,255,0.9); z-index: 100; max-height: 150px; overflow-y: auto; }
.show-notes .slide.active .slide-notes { display: block; }`
}

function generateEditStyles(): string {
  return `/* ===== Edit Mode Styles ===== */
.edit-toggle-btn, .save-btn, .cancel-btn, .theme-toggle-btn {
    position: fixed; z-index: 1500; width: 44px; height: 44px; border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 1.2rem;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.3s; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.edit-toggle-btn { bottom: 30px; right: 30px; background: rgba(60,60,60,0.9); }
.edit-toggle-btn:hover { background: rgba(80,80,80,0.9); transform: scale(1.1); }
.theme-toggle-btn { bottom: 30px; right: 86px; background: rgba(60,60,60,0.9); }
.theme-toggle-btn:hover { background: rgba(80,80,80,0.9); transform: scale(1.1); }
.save-btn { bottom: 30px; right: 142px; background: rgba(0,120,80,0.9); display: none; }
.save-btn:hover { background: #00a060; transform: scale(1.1); }
.cancel-btn { bottom: 30px; right: 198px; background: rgba(180,40,40,0.9); display: none; }
.cancel-btn:hover { background: #c0302f; transform: scale(1.1); }
body.edit-mode .save-btn, body.edit-mode .cancel-btn { display: flex; }
.edit-mode-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 36px;
    background: rgba(0,120,214,0.95); color: #fff; display: flex;
    align-items: center; justify-content: center; font-size: 0.78rem;
    font-family: 'Inter', sans-serif; z-index: 2000;
    transform: translateY(-100%); transition: transform 0.3s ease; letter-spacing: 0.02em;
}
body.edit-mode .edit-mode-bar { transform: translateY(0); }
body.edit-mode .edit-toggle-btn { background: rgba(0,120,214,0.9); box-shadow: 0 2px 10px rgba(0,120,214,0.4); }
body.edit-mode [contenteditable="true"] {
    outline: 1px dashed rgba(0,176,240,0.4); outline-offset: 2px;
    border-radius: 3px; transition: outline-color 0.2s; cursor: text;
}
body.edit-mode [contenteditable="true"]:hover { outline-color: rgba(0,176,240,0.7); }
body.edit-mode [contenteditable="true"]:focus {
    outline: 2px solid rgba(0,176,240,0.9); outline-offset: 3px;
    background: rgba(0,176,240,0.03);
}
.save-toast {
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: rgba(0,160,80,0.95); color: #fff; padding: 10px 24px;
    border-radius: 8px; font-size: 0.82rem; font-family: 'Inter', sans-serif;
    opacity: 0; transition: all 0.3s ease; z-index: 3000; pointer-events: none;
}
.save-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.slide-mgmt-bar {
    position: fixed; top: 36px; left: 0; right: 0; height: 40px;
    background: rgba(30,30,30,0.95); border-bottom: 1px solid #333;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    z-index: 1999; transform: translateY(-76px); transition: transform 0.3s ease;
}
body.edit-mode .slide-mgmt-bar { transform: translateY(0); }
.slide-mgmt-bar button {
    padding: 5px 14px; background: #3a3a3a; color: #ccc;
    border: 1px solid #4a4a4a; border-radius: 4px; font-size: 0.72rem;
    font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif;
}
.slide-mgmt-bar button:hover { background: #4a4a4a; color: #fff; }
.slide-mgmt-bar button.danger { background: #5a2020; border-color: #7a3030; }
.slide-mgmt-bar button.danger:hover { background: #7a3030; }
.slide-mgmt-bar .mgmt-label { font-size: 0.7rem; color: #888; margin-right: 4px; }
.slide-mgmt-bar select {
    padding: 4px 8px; background: #2a2a2a; color: #eee;
    border: 1px solid #4a4a4a; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;
}
.font-size-display { font-size: 0.72rem; color: #aaa; min-width: 36px; text-align: center; font-weight: 600; }
.icon-lib-toggle {
    position: fixed; top: 14px; right: 158px; z-index: 1500;
    width: 40px; height: 40px; border-radius: 50%;
    background: rgba(125,125,125,0.3); border: 1px solid rgba(255,255,255,0.2);
    color: white; font-size: 1.1rem; cursor: pointer; display: none;
    align-items: center; justify-content: center; transition: all 0.2s;
}
body.edit-mode .icon-lib-toggle { display: flex; }
.icon-lib-toggle:hover { background: rgba(255,145,2,0.4); border-color: var(--orange); transform: scale(1.1); }
.icon-library {
    position: fixed; bottom: 80px; right: 20px; width: 340px; max-height: 440px;
    background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 12px;
    display: none; flex-direction: column; z-index: 2000; overflow: hidden;
}
.icon-library.open { display: flex; }
.icon-lib-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid #333; font-size: 0.85rem; font-weight: 600;
}
.icon-lib-close { background: none; border: none; color: #aaa; font-size: 1.3rem; cursor: pointer; }
.icon-lib-search { padding: 8px 12px; }
.icon-lib-search input {
    width: 100%; padding: 6px 10px; background: #2a2a2a; border: 1px solid #444;
    border-radius: 6px; color: #eee; font-size: 0.8rem; outline: none;
}
.icon-lib-categories { display: flex; gap: 4px; padding: 4px 12px 8px; flex-wrap: wrap; }
.icon-cat-btn {
    padding: 3px 10px; border-radius: 12px; border: 1px solid #444;
    background: none; color: #bbb; font-size: 0.7rem; cursor: pointer;
}
.icon-cat-btn.active { background: var(--orange); color: #fff; border-color: var(--orange); }
.icon-lib-grid {
    display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px;
    padding: 8px 12px; overflow-y: auto; max-height: 260px;
}
.icon-lib-item {
    width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
    font-size: 1.3rem; cursor: pointer; border-radius: 6px; transition: background 0.15s;
}
.icon-lib-item:hover { background: rgba(255,145,2,0.2); }
.icon-lib-item.hidden { display: none; }
.icon-lib-hint { padding: 8px 12px; font-size: 0.7rem; color: #666; text-align: center; border-top: 1px solid #333; }
.interactive-table-wrap { width: 100%; max-width: 1000px; position: relative; z-index: 1; }
.table-controls { display: flex; gap: 6px; margin-bottom: 8px; justify-content: flex-end; }
.table-controls button {
    padding: 3px 10px; background: rgba(255,145,2,0.15); border: 1px solid rgba(255,145,2,0.3);
    border-radius: 4px; color: var(--orange); font-size: 0.7rem; cursor: pointer; transition: all 0.2s;
}
.table-controls button:hover { background: rgba(255,145,2,0.3); }
.interactive-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.interactive-table th {
    background: var(--orange); color: #fff; padding: 10px 14px;
    text-align: left; font-weight: 600; border: 1px solid rgba(255,145,2,0.3);
}
.interactive-table td {
    padding: 10px 14px; border: 1px solid rgba(0,0,0,0.08);
    background: rgba(255,255,255,0.6); min-height: 36px;
}
.interactive-table th[contenteditable="true"],
.interactive-table td[contenteditable="true"] { cursor: text; }
.interactive-table th[contenteditable="true"]:focus,
.interactive-table td[contenteditable="true"]:focus { outline: 2px solid var(--cyan); outline-offset: -2px; }
.upload-hint { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--gray); font-size: 0.85rem; }
.hint-icon { font-size: 2rem; }
.img-overlay, .avatar-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.5);
    display: none; align-items: center; justify-content: center;
    color: #fff; font-size: 0.8rem; border-radius: inherit;
}
.image-placeholder:hover .img-overlay, [onclick*="handleAvatarClick"]:hover .avatar-overlay { display: flex; }
@media print {
    .nav-controls, .edit-toggle-btn, .save-btn, .cancel-btn, .theme-toggle-btn,
    .edit-mode-bar, .slide-mgmt-bar, .icon-library, .icon-lib-toggle,
    .save-toast, .progress-bar { display: none !important; }
}`
}

function generateEditControls(): string {
  return `
    <!-- Theme Toggle -->
    <button class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()" title="Switch Theme: Mixed / All Dark / All Light (T)">&#9681;</button>

    <!-- Edit Toggle + Save + Cancel -->
    <button class="edit-toggle-btn" id="editToggleBtn" onclick="toggleEditor()" title="Toggle Edit Mode (E)">&#9998;</button>
    <button class="save-btn" id="saveBtn" onclick="saveNow()" title="Save (Ctrl+S)">&#128190;</button>
    <button class="cancel-btn" id="cancelBtn" onclick="cancelEdit()" title="Cancel edits on this slide">&#10006;</button>

    <!-- Edit Mode Bar -->
    <div class="edit-mode-bar">EDIT MODE &mdash; Click text to edit | S = Save | C = Cancel | I = Icons | Arrow keys = Nudge | E = Exit</div>

    <!-- Slide Management Toolbar -->
    <div class="slide-mgmt-bar">
        <span class="mgmt-label">Add:</span>
        <select id="slideTypeSelect">
            <option value="dark-title">Dark Title</option>
            <option value="light-chapter">Light Chapter</option>
            <option value="dark-content">Dark Content</option>
            <option value="light-content">Light Content</option>
            <option value="dark-table">Dark Table</option>
            <option value="light-table">Light Table</option>
            <option value="light-statement">Statement</option>
            <option value="light-blank">Blank</option>
        </select>
        <button onclick="addSlide()">+ Add</button>
        <button onclick="duplicateSlide()">Duplicate</button>
        <button class="danger" onclick="deleteSlide()">Delete</button>
        <button onclick="moveSlide(-1)">&#8592;</button>
        <button onclick="moveSlide(1)">&#8594;</button>
        <span class="mgmt-label" style="margin-left:8px;">|</span>
        <span class="mgmt-label">Font:</span>
        <button onclick="changeFontSize(-2)">A-</button>
        <span class="font-size-display" id="fontSizeDisplay">--</span>
        <button onclick="changeFontSize(2)">A+</button>
    </div>

    <!-- Icon Library -->
    <button class="icon-lib-toggle" id="iconLibToggle" onclick="toggleIconLibrary()" title="Icon Library (I)">&#127912;</button>
    <div class="icon-library" id="iconLibrary">
        <div class="icon-lib-header"><span>Icon Library</span><button class="icon-lib-close" onclick="toggleIconLibrary()">&times;</button></div>
        <div class="icon-lib-search"><input type="text" id="iconSearchInput" placeholder="Search icons..." oninput="filterIcons(this.value)"></div>
        <div class="icon-lib-categories" id="iconCategories">
            <button class="icon-cat-btn active" onclick="filterCategory('all',this)">All</button>
            <button class="icon-cat-btn" onclick="filterCategory('business',this)">Business</button>
            <button class="icon-cat-btn" onclick="filterCategory('tech',this)">Tech</button>
            <button class="icon-cat-btn" onclick="filterCategory('people',this)">People</button>
            <button class="icon-cat-btn" onclick="filterCategory('arrows',this)">Arrows</button>
            <button class="icon-cat-btn" onclick="filterCategory('symbols',this)">Symbols</button>
        </div>
        <div class="icon-lib-grid" id="iconGrid"></div>
        <div class="icon-lib-hint">Click text first, then click an icon to insert</div>
    </div>

    <!-- Save Toast -->
    <div class="save-toast" id="saveToast">Saved &#10004;</div>`
}

function generateEditScript(title: string): string {
  return `
// ===== EDIT MODE =====
let editMode = false;
let fileHandle = null;
let lastFocusedEditable = null;
let slideSnapshotHTML = '';
const presentation = document.getElementById('presentation');

function getSlides() {
    return presentation.querySelectorAll(':scope > .slide');
}

function toggleEditor() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    const btn = document.getElementById('editToggleBtn');
    if (editMode) {
        btn.innerHTML = '\\u2714';
        btn.title = 'Save & Exit Edit Mode';
        snapshotCurrentSlide();
        enableInlineEdit();
    } else {
        saveAndExit();
    }
}

function enableInlineEdit() {
    disableInlineEdit();
    const activeSlide = getSlides()[currentSlide];
    const editables = activeSlide.querySelectorAll('h1, h2, h3, h4, p, li, td, th, .subtitle');
    editables.forEach(el => {
        if (el.closest('.mb-logo') || el.closest('.slide-footer') || el.closest('.nav-controls') || el.closest('.star-bg')) return;
        if (!el.textContent.trim()) return;
        el.setAttribute('contenteditable', 'true');
    });
}

function disableInlineEdit() {
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.removeAttribute('contenteditable');
    });
}

async function saveAndExit() {
    disableInlineEdit();
    const btn = document.getElementById('editToggleBtn');
    btn.innerHTML = '\\u270E';
    btn.title = 'Toggle Edit Mode (E)';
    try { await saveFile(); showSaveToast(); } catch(err) { if (err.name !== 'AbortError') console.error('Save failed:', err); }
}

async function saveFile() {
    const html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
    if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
            suggestedName: '${escapeHtml(title).replace(/'/g, "\\'")}.html',
            types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }]
        });
    }
    const writable = await fileHandle.createWritable();
    await writable.write(html);
    await writable.close();
}

function showSaveToast() {
    const toast = document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function snapshotCurrentSlide() {
    const s = getSlides()[currentSlide];
    slideSnapshotHTML = s ? s.innerHTML : '';
}

async function saveNow() {
    disableInlineEdit();
    try { await saveFile(); showSaveToast(); } catch(err) { if (err.name !== 'AbortError') console.error('Save failed:', err); }
    if (editMode) enableInlineEdit();
}

function cancelEdit() {
    if (!slideSnapshotHTML) return;
    getSlides()[currentSlide].innerHTML = slideSnapshotHTML;
    slideSnapshotHTML = '';
    if (editMode) enableInlineEdit();
    const toast = document.getElementById('saveToast');
    toast.textContent = 'Edits cancelled \\u21A9';
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); toast.textContent = 'Saved \\u2714'; }, 2000);
}

// ===== THEME TOGGLE =====
let themeState = 'mixed';
function toggleTheme() {
    const btn = document.getElementById('themeToggleBtn');
    const allSlides = getSlides();
    if (themeState === 'mixed') {
        themeState = 'all-dark';
        allSlides.forEach(s => { s.classList.remove('slide-light'); s.classList.add('slide-dark'); });
        btn.innerHTML = '\\u263E'; btn.title = 'Current: All Dark (T)';
    } else if (themeState === 'all-dark') {
        themeState = 'all-light';
        allSlides.forEach(s => { s.classList.remove('slide-dark'); s.classList.add('slide-light'); });
        btn.innerHTML = '\\u2600'; btn.title = 'Current: All Light (T)';
    } else {
        themeState = 'mixed';
        btn.innerHTML = '\\u25D1'; btn.title = 'Current: Mixed (T)';
        location.reload();
    }
}

// ===== NUDGE =====
function nudgeElement(dx, dy) {
    const el = lastFocusedEditable;
    if (!el) return;
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.left = (parseFloat(el.style.left) || 0) + dx + 'px';
    el.style.top = (parseFloat(el.style.top) || 0) + dy + 'px';
}

// ===== FONT SIZE =====
document.addEventListener('focusin', function(e) {
    if (e.target.isContentEditable) { lastFocusedEditable = e.target; updateFontSizeDisplay(e.target); }
});
document.addEventListener('click', function(e) {
    if (e.target.isContentEditable) { lastFocusedEditable = e.target; updateFontSizeDisplay(e.target); }
});

function updateFontSizeDisplay(el) {
    if (!el) return;
    const size = Math.round(parseFloat(window.getComputedStyle(el).fontSize));
    document.getElementById('fontSizeDisplay').textContent = size + 'px';
}

function changeFontSize(delta) {
    const el = lastFocusedEditable;
    if (!el) return;
    const cur = parseFloat(window.getComputedStyle(el).fontSize);
    el.style.fontSize = Math.max(8, Math.min(120, cur + delta)) + 'px';
    updateFontSizeDisplay(el);
}

// ===== KEYBOARD =====
document.removeEventListener('keydown', arguments.callee);
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.target.isContentEditable) { if (e.key === 'Escape') { e.target.blur(); e.preventDefault(); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (editMode) saveNow(); return; }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleEditor(); }
    else if (editMode && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); }
    else if (editMode && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); cancelEdit(); }
    else if (editMode && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); toggleIconLibrary(); }
    else if (editMode && e.key === 'ArrowLeft') { e.preventDefault(); nudgeElement(-2, 0); }
    else if (editMode && e.key === 'ArrowRight') { e.preventDefault(); nudgeElement(2, 0); }
    else if (editMode && e.key === 'ArrowUp') { e.preventDefault(); nudgeElement(0, -2); }
    else if (editMode && e.key === 'ArrowDown') { e.preventDefault(); nudgeElement(0, 2); }
    else if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTheme(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
});

// ===== SLIDE MANAGEMENT =====
const SLIDE_TEMPLATES = {
    'dark-title': '<div class="slide slide-dark"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><div style="text-align:center;position:relative;z-index:1;"><h1>New Slide Title</h1><p class="subtitle">Subtitle</p></div><div class="slide-footer"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'light-chapter': '<div class="slide slide-light"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><div style="text-align:center;position:relative;z-index:1;"><h1 style="font-size:3rem;text-transform:uppercase;letter-spacing:0.15em;">CHAPTER HEADING</h1></div><div class="slide-footer" style="color:var(--gray);"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'dark-content': '<div class="slide slide-dark"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><h2 class="animate-in" style="text-align:center;">Slide Title</h2><ul class="animate-in" style="list-style:none;padding:0;max-width:900px;width:100%;position:relative;z-index:1;"><li>Point one</li><li>Point two</li><li>Point three</li></ul><div class="slide-footer"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'light-content': '<div class="slide slide-light"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><h2 class="animate-in" style="text-align:center;">Slide Title</h2><ul class="animate-in" style="list-style:none;padding:0;max-width:900px;width:100%;position:relative;z-index:1;"><li>Point one</li><li>Point two</li><li>Point three</li></ul><div class="slide-footer" style="color:var(--gray);"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'dark-table': '<div class="slide slide-dark"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><h2 class="animate-in" style="text-align:center;">Table Title</h2><div class="interactive-table-wrap animate-in"><div class="table-controls"><button onclick="tableAddCol(this)">+ Col</button><button onclick="tableRemoveCol(this)">- Col</button><button onclick="tableAddRow(this)">+ Row</button><button onclick="tableRemoveRow(this)">- Row</button></div><table class="interactive-table"><thead><tr><th contenteditable="true">Column 1</th><th contenteditable="true">Column 2</th><th contenteditable="true">Column 3</th></tr></thead><tbody><tr><td contenteditable="true">Data</td><td contenteditable="true">Data</td><td contenteditable="true">Data</td></tr><tr><td contenteditable="true">Data</td><td contenteditable="true">Data</td><td contenteditable="true">Data</td></tr></tbody></table></div><div class="slide-footer"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'light-table': '<div class="slide slide-light"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><h2 class="animate-in" style="text-align:center;">Table Title</h2><div class="interactive-table-wrap animate-in"><div class="table-controls"><button onclick="tableAddCol(this)">+ Col</button><button onclick="tableRemoveCol(this)">- Col</button><button onclick="tableAddRow(this)">+ Row</button><button onclick="tableRemoveRow(this)">- Row</button></div><table class="interactive-table"><thead><tr><th contenteditable="true">Column 1</th><th contenteditable="true">Column 2</th><th contenteditable="true">Column 3</th></tr></thead><tbody><tr><td contenteditable="true">Data</td><td contenteditable="true">Data</td><td contenteditable="true">Data</td></tr><tr><td contenteditable="true">Data</td><td contenteditable="true">Data</td><td contenteditable="true">Data</td></tr></tbody></table></div><div class="slide-footer" style="color:var(--gray);"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'light-statement': '<div class="slide slide-light"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><div style="text-align:center;position:relative;z-index:1;"><h1 style="font-size:2.6rem;">Bold statement goes here.</h1></div><div class="slide-footer" style="color:var(--gray);"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
    'light-blank': '<div class="slide slide-light"><div class="star-bg"></div><div class="mb-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div><div style="text-align:center;position:relative;z-index:1;"><h2>Blank Slide</h2></div><div class="slide-footer" style="color:var(--gray);"><span>CHAPTER</span><span>TITLE / 2026</span></div></div>',
};

function addSlide() {
    const type = document.getElementById('slideTypeSelect').value;
    const template = SLIDE_TEMPLATES[type];
    if (!template) return;
    const temp = document.createElement('div');
    temp.innerHTML = template.trim();
    const newSlide = temp.firstElementChild;
    const allSlides = getSlides();
    const refSlide = allSlides[currentSlide];
    if (refSlide && refSlide.nextSibling) {
        presentation.insertBefore(newSlide, refSlide.nextSibling);
    } else {
        presentation.appendChild(newSlide);
    }
    currentSlide++;
    updateSlide();
    if (editMode) { snapshotCurrentSlide(); enableInlineEdit(); }
}

function duplicateSlide() {
    const allSlides = getSlides();
    const clone = allSlides[currentSlide].cloneNode(true);
    clone.classList.remove('active', 'prev');
    const ref = allSlides[currentSlide];
    if (ref.nextSibling) presentation.insertBefore(clone, ref.nextSibling);
    else presentation.appendChild(clone);
    currentSlide++;
    updateSlide();
    if (editMode) { snapshotCurrentSlide(); enableInlineEdit(); }
}

function deleteSlide() {
    const allSlides = getSlides();
    if (allSlides.length <= 1) return;
    allSlides[currentSlide].remove();
    if (currentSlide >= getSlides().length) currentSlide = getSlides().length - 1;
    updateSlide();
    if (editMode) { snapshotCurrentSlide(); enableInlineEdit(); }
}

function moveSlide(dir) {
    const allSlides = getSlides();
    const target = currentSlide + dir;
    if (target < 0 || target >= allSlides.length) return;
    const slidesArr = Array.from(allSlides);
    const moving = slidesArr[currentSlide];
    const ref = slidesArr[target];
    if (dir === 1) presentation.insertBefore(moving, ref.nextSibling);
    else presentation.insertBefore(moving, ref);
    currentSlide = target;
    updateSlide();
}

// ===== INTERACTIVE TABLE =====
function getTableFromBtn(btn) { return btn.closest('.interactive-table-wrap').querySelector('.interactive-table'); }
function tableAddCol(btn) {
    const table = getTableFromBtn(btn);
    table.querySelector('thead tr').appendChild(Object.assign(document.createElement('th'), {textContent:'New', contentEditable:'true'}));
    table.querySelectorAll('tbody tr').forEach(row => { const td = document.createElement('td'); td.contentEditable = 'true'; row.appendChild(td); });
}
function tableRemoveCol(btn) {
    const table = getTableFromBtn(btn);
    const hr = table.querySelector('thead tr');
    if (hr.children.length <= 1) return;
    hr.removeChild(hr.lastElementChild);
    table.querySelectorAll('tbody tr').forEach(row => { if (row.lastElementChild) row.removeChild(row.lastElementChild); });
}
function tableAddRow(btn) {
    const table = getTableFromBtn(btn);
    const cols = table.querySelector('thead tr').children.length;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) { const td = document.createElement('td'); td.contentEditable = 'true'; tr.appendChild(td); }
    table.querySelector('tbody').appendChild(tr);
}
function tableRemoveRow(btn) {
    const tbody = getTableFromBtn(btn).querySelector('tbody');
    if (tbody.children.length <= 1) return;
    tbody.removeChild(tbody.lastElementChild);
}

// ===== IMAGE UPLOAD =====
function handleImageClick(placeholder) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            placeholder.innerHTML = '';
            const img = document.createElement('img');
            img.src = ev.target.result; img.alt = 'Uploaded image';
            placeholder.appendChild(img);
            const overlay = document.createElement('div');
            overlay.className = 'img-overlay'; overlay.textContent = 'Click to replace';
            placeholder.appendChild(overlay);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ===== ICON LIBRARY =====
const ICON_DATA = [
    {icon:'\\uD83D\\uDCBC',name:'briefcase',cat:'business'},{icon:'\\uD83D\\uDCB0',name:'money bag',cat:'business'},
    {icon:'\\uD83D\\uDCC8',name:'chart up',cat:'business'},{icon:'\\uD83D\\uDCC9',name:'chart down',cat:'business'},
    {icon:'\\uD83D\\uDCCA',name:'bar chart',cat:'business'},{icon:'\\uD83C\\uDFAF',name:'target',cat:'business'},
    {icon:'\\uD83D\\uDCA1',name:'lightbulb',cat:'business'},{icon:'\\u2699',name:'gear',cat:'business'},
    {icon:'\\uD83D\\uDCDD',name:'memo',cat:'business'},{icon:'\\uD83D\\uDCC5',name:'calendar',cat:'business'},
    {icon:'\\uD83D\\uDCBB',name:'laptop',cat:'tech'},{icon:'\\uD83D\\uDCF1',name:'mobile',cat:'tech'},
    {icon:'\\u2601',name:'cloud',cat:'tech'},{icon:'\\uD83D\\uDD12',name:'lock',cat:'tech'},
    {icon:'\\uD83E\\uDD16',name:'robot AI',cat:'tech'},{icon:'\\uD83D\\uDD0D',name:'search',cat:'tech'},
    {icon:'\\uD83C\\uDF10',name:'globe',cat:'tech'},{icon:'\\uD83D\\uDE80',name:'rocket',cat:'tech'},
    {icon:'\\u26A1',name:'lightning',cat:'tech'},{icon:'\\uD83D\\uDD04',name:'refresh',cat:'tech'},
    {icon:'\\uD83D\\uDC64',name:'person',cat:'people'},{icon:'\\uD83D\\uDC65',name:'group',cat:'people'},
    {icon:'\\uD83D\\uDCAC',name:'speech',cat:'people'},{icon:'\\uD83E\\uDD1D',name:'handshake',cat:'people'},
    {icon:'\\uD83E\\uDDE0',name:'brain',cat:'people'},{icon:'\\uD83C\\uDF93',name:'graduation',cat:'people'},
    {icon:'\\u27A1',name:'right',cat:'arrows'},{icon:'\\u2B05',name:'left',cat:'arrows'},
    {icon:'\\u2B06',name:'up',cat:'arrows'},{icon:'\\u2B07',name:'down',cat:'arrows'},
    {icon:'\\u21BB',name:'cycle',cat:'arrows'},{icon:'\\u25B6',name:'play',cat:'arrows'},
    {icon:'\\u2714',name:'check',cat:'symbols'},{icon:'\\u2716',name:'cross',cat:'symbols'},
    {icon:'\\u2795',name:'plus',cat:'symbols'},{icon:'\\u2796',name:'minus',cat:'symbols'},
    {icon:'\\u2757',name:'alert',cat:'symbols'},{icon:'\\u2B55',name:'circle',cat:'symbols'},
    {icon:'\\uD83D\\uDD34',name:'red circle',cat:'symbols'},{icon:'\\uD83D\\uDFE2',name:'green circle',cat:'symbols'},
    {icon:'\\u26A0',name:'warning',cat:'symbols'},{icon:'\\u2764',name:'heart',cat:'symbols'},
];

function buildIconGrid() {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = '';
    ICON_DATA.forEach(item => {
        const el = document.createElement('div');
        el.className = 'icon-lib-item'; el.textContent = item.icon;
        el.title = item.name; el.dataset.cat = item.cat; el.dataset.name = item.name;
        el.onclick = function() { insertIcon(item.icon); };
        grid.appendChild(el);
    });
}

function toggleIconLibrary() { document.getElementById('iconLibrary').classList.toggle('open'); }

function filterCategory(cat, btn) {
    document.querySelectorAll('.icon-cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.icon-lib-item').forEach(el => {
        el.classList.toggle('hidden', cat !== 'all' && el.dataset.cat !== cat);
    });
    document.getElementById('iconSearchInput').value = '';
}

function filterIcons(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.icon-cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.icon-lib-item').forEach(el => {
        el.classList.toggle('hidden', q && !el.dataset.name.includes(q));
    });
}

function insertIcon(icon) {
    const el = lastFocusedEditable;
    if (!el || !el.isContentEditable) {
        const activeSlide = getSlides()[currentSlide];
        const first = activeSlide.querySelector('[contenteditable="true"]');
        if (first) { first.focus(); document.execCommand('insertText', false, icon); }
        return;
    }
    el.focus();
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        document.execCommand('insertText', false, icon);
    } else {
        const range = document.createRange();
        range.selectNodeContents(el); range.collapse(false);
        sel.removeAllRanges(); sel.addRange(range);
        document.execCommand('insertText', false, icon);
    }
}

buildIconGrid();

// Override updateSlide to handle edit mode
const _origUpdateSlide = updateSlide;
updateSlide = function() {
    const slides = getSlides();
    const totalSlides = slides.length;
    slides.forEach((slide, index) => {
        slide.classList.remove('active', 'prev');
        if (index === currentSlide) slide.classList.add('active');
        else if (index < currentSlide) slide.classList.add('prev');
    });
    progressBar.style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
    slideCounter.textContent = (currentSlide + 1) + ' / ' + totalSlides;
    if (editMode) { snapshotCurrentSlide(); enableInlineEdit(); }
};`
}

// ===== CHAPTER NAV (team-workshop frame) =====
// The persistent left navigator from team-workshop.html, injected as deck-level chrome
// when deck.frame.type === 'chapter-nav'. Covers both exported files and the in-app
// PresentationMode iframe (both render the output of exportDeckToHtml).

function slideTitle(slide: Slide): string {
  const h = slide.components.find((c) => c.type === 'heading')?.props.text as string | undefined
  return h || ''
}

function buildNavGroups(deck: Deck): { label: string; items: { i: number; t: string }[] }[] {
  const groups: { label: string; items: { i: number; t: string }[] }[] = []
  let current: { label: string; items: { i: number; t: string }[] } | null = null
  deck.slides.forEach((s, i) => {
    const ch = s.chapter
    if (ch && (!current || current.label !== ch)) {
      current = { label: ch, items: [] }
      groups.push(current)
    }
    if (!current) { current = { label: 'Slides', items: [] }; groups.push(current) }
    current.items.push({ i, t: slideTitle(s) || `Slide ${i + 1}` })
  })
  return groups
}

function generateChapterNavHtml(deck: Deck): string {
  const groups = buildNavGroups(deck)
  const footText = deck.frame?.footText || 'Workshop'
  const miniLogo = `<div class="mb-mini-logo"><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="37" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="40" r="32" stroke="currentColor" stroke-width="1"/><path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill="currentColor"/></svg></div>`
  const groupsHtml = groups.map((g) => {
    const items = g.items.map((it) =>
      `<button class="nav-item" data-idx="${it.i}" onclick="navGoTo(${it.i})"><span class="nav-num">${it.i + 1}</span><span class="nav-text">${escapeHtml(it.t)}</span></button>`
    ).join('')
    return `<div class="nav-group"><div class="nav-group-label">${escapeHtml(g.label)}</div>${items}</div>`
  }).join('')
  return `<aside class="chapter-nav" id="chapterNav">
        <div class="nav-head">
            ${miniLogo}
            <span class="nav-title">Workshop</span>
            <button class="nav-collapse-btn" onclick="toggleSidebar()" title="Collapse nav (])">&#8592;</button>
        </div>
        <nav class="nav-groups">${groupsHtml}</nav>
        <div class="nav-foot">${escapeHtml(footText)}</div>
    </aside>
    <button class="nav-open-btn" id="navOpenBtn" onclick="toggleSidebar()" title="Show chapter nav (])">&#9776;</button>`
}

function generateChapterNavStyles(): string {
  return `/* ===== Chapter Nav (team-workshop frame) ===== */
.has-chapternav { --sidebar-w: 240px; }
.has-chapternav.nav-collapsed { --sidebar-w: 0px; }
.has-chapternav .presentation { width: calc(100% - var(--sidebar-w)); margin-left: var(--sidebar-w); transition: margin-left .3s ease, width .3s ease; }
.has-chapternav .nav-controls { left: calc(50% + var(--sidebar-w) / 2); }
.chapter-nav { position: fixed; top: 0; left: 0; width: var(--sidebar-w); height: 100vh; background: linear-gradient(180deg, #0d0d0d, #111); border-right: 1px solid rgba(255,145,2,0.18); z-index: 1002; display: flex; flex-direction: column; transition: width .3s ease; overflow: hidden; }
.nav-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
.mb-mini-logo { width: 20px; height: 20px; color: rgba(255,255,255,0.8); flex-shrink: 0; }
.mb-mini-logo svg { width: 100%; height: 100%; }
.nav-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.6); }
.nav-collapse-btn { margin-left: auto; background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 14px; padding: 2px; }
.nav-collapse-btn:hover { color: var(--orange); }
.nav-groups { flex: 1; overflow-y: auto; padding: 8px; }
.nav-group-label { padding: 10px 8px 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--orange); opacity: 0.8; }
.nav-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px; border: none; background: none; color: rgba(255,255,255,0.55); font-size: 11px; cursor: pointer; border-radius: 4px; transition: background .15s, color .15s; font-family: 'Inter', sans-serif; }
.nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
.nav-item.active { background: rgba(255,145,2,0.15); color: #fff; }
.nav-num { font-size: 9px; opacity: 0.6; min-width: 16px; }
.nav-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-foot { padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 9px; color: rgba(255,255,255,0.4); flex-shrink: 0; }
.nav-open-btn { position: fixed; top: 14px; left: 14px; z-index: 1003; width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(26,26,26,0.9); color: #fff; cursor: pointer; display: none; align-items: center; justify-content: center; font-size: 14px; }
.has-chapternav.nav-collapsed .nav-open-btn { display: flex; }
@media print { .chapter-nav, .nav-open-btn { display: none !important; } .has-chapternav .presentation { width: 100%; margin-left: 0; } }`
}

function generateChapterNavScript(): string {
  return `
// ===== CHAPTER NAV (team-workshop frame) =====
function navGoTo(i) {
    currentSlide = Math.max(0, Math.min(i, totalSlides - 1));
    updateSlide();
}
function renderNavActive() {
    document.querySelectorAll('.nav-item').forEach(function(el) {
        el.classList.toggle('active', Number(el.dataset.idx) === currentSlide);
    });
}
function toggleSidebar() {
    document.body.classList.toggle('nav-collapsed');
}
document.addEventListener('keydown', function(e) {
    if (e.target && (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (e.key === ']') { e.preventDefault(); toggleSidebar(); }
});
// Keep the chapter-nav highlight in sync with every slide change (incl. postMessage nav).
(function() {
    var _prevUpdate = updateSlide;
    updateSlide = function() { _prevUpdate.apply(this, arguments); renderNavActive(); };
})();
renderNavActive();`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape markup for embedding inside an iframe `srcdoc` attribute (preserve tags, escape & and "). */
function escapeSrcDoc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}
