import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { Slide, SlideTheme } from '@/types/deck'

export interface SlideEditHandler {
  onEditComponent: (componentId: string, props: Record<string, unknown>) => void
}

const CHART_COLORS = ['#FF9102', '#FFC767', '#00B0F0', '#FF7500', '#0078D6', '#FFA101']

function AdaptiveScale({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return
    const overflow = el.scrollHeight > parent.clientHeight
    if (overflow && scale > 0.6) {
      setScale(s => Math.max(0.6, s - 0.05))
    } else if (!overflow && scale < 1) {
      setScale(1)
    }
  })

  return (
    <div ref={ref} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: scale < 1 ? `${100 / scale}%` : '100%' }}>
      {children}
    </div>
  )
}

const SNAP_THRESHOLD = 8

function snap(val: number, grid: number): number {
  const remainder = val % grid
  return Math.abs(remainder) < SNAP_THRESHOLD ? val - remainder : val
}

function Draggable({ id, offsetX, offsetY, editHandler, children }: { id: string; offsetX: number; offsetY: number; editHandler?: SlideEditHandler; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [showGuide, setShowGuide] = useState<'x' | 'y' | 'both' | null>(null)
  const startPos = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  if (!editHandler) {
    return <div style={{ position: 'relative', left: offsetX, top: offsetY }}>{children}</div>
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    e.preventDefault()
    setDragging(true)
    startPos.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }

    const handleMove = (ev: MouseEvent) => {
      let dx = ev.clientX - startPos.current.x
      let dy = ev.clientY - startPos.current.y
      let newX = snap(startPos.current.ox + dx, 20)
      let newY = snap(startPos.current.oy + dy, 20)
      const nearCenterX = Math.abs(newX) < SNAP_THRESHOLD
      const nearCenterY = Math.abs(newY) < SNAP_THRESHOLD
      if (nearCenterX) newX = 0
      if (nearCenterY) newY = 0
      setShowGuide(nearCenterX && nearCenterY ? 'both' : nearCenterX ? 'x' : nearCenterY ? 'y' : null)
      if (ref.current) {
        ref.current.style.left = `${newX}px`
        ref.current.style.top = `${newY}px`
      }
    }

    const handleUp = (ev: MouseEvent) => {
      let dx = ev.clientX - startPos.current.x
      let dy = ev.clientY - startPos.current.y
      let newX = snap(startPos.current.ox + dx, 20)
      let newY = snap(startPos.current.oy + dy, 20)
      if (Math.abs(newX) < SNAP_THRESHOLD) newX = 0
      if (Math.abs(newY) < SNAP_THRESHOLD) newY = 0
      editHandler.onEditComponent(id, { offsetX: newX, offsetY: newY })
      setDragging(false)
      setShowGuide(null)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      style={{ position: 'relative', left: offsetX, top: offsetY, cursor: dragging ? 'grabbing' : 'grab' }}
      className={`${dragging ? 'ring-1 ring-[#FF9102]/50 rounded' : 'hover:ring-1 hover:ring-white/20 hover:rounded'} transition-shadow`}
    >
      {children}
      {showGuide && (showGuide === 'x' || showGuide === 'both') && (
        <div className="absolute left-1/2 -top-[200px] w-px h-[400px] bg-[#FF9102]/30 pointer-events-none" />
      )}
      {showGuide && (showGuide === 'y' || showGuide === 'both') && (
        <div className="absolute top-1/2 -left-[200px] h-px w-[400px] bg-[#FF9102]/30 pointer-events-none" />
      )}
    </div>
  )
}

function getText(slide: Slide, type: string, idx = 0): string {
  const matches = slide.components.filter(c => c.type === type)
  return (matches[idx]?.props?.text as string) || ''
}

function getList(slide: Slide, idx = 0): string[] {
  const matches = slide.components.filter(c => c.type === 'list')
  return (matches[idx]?.props?.items as string[]) || []
}

function getImage(slide: Slide, idx = 0): string {
  const matches = slide.components.filter(c => c.type === 'image')
  return (matches[idx]?.props?.src as string) || ''
}

function MBLogo({ theme }: { theme: SlideTheme }) {
  const color = theme === 'dark' ? '#ffffff' : '#262626'
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-6 h-6 opacity-60">
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="37" stroke={color} strokeWidth="2"/>
        <circle cx="40" cy="40" r="32" stroke={color} strokeWidth="1.5"/>
        <path d="M40 8 L44.3 37.5 L67.7 56 L40 45 L12.3 56 L35.7 37.5 Z" fill={color}/>
      </svg>
    </div>
  )
}

function SlideFooter({ theme }: { theme: SlideTheme }) {
  return (
    <div className={`absolute bottom-2 left-6 right-6 flex justify-between text-[7px] uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-[#7D7D7D]/50'}`}>
      <span>CHAPTER</span>
      <span>TITLE / 2026</span>
    </div>
  )
}

function TableComponent({ headers, rows, theme }: { headers: string[]; rows: string[][]; theme: SlideTheme }) {
  const isDark = theme === 'dark'
  return (
    <div className="w-full overflow-hidden rounded border border-white/10">
      <table className="w-full text-[8px]">
        <thead>
          <tr className={isDark ? 'bg-white/10' : 'bg-[#FF9102]'}>
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1 text-left font-semibold ${isDark ? 'text-[#FF9102]' : 'text-white'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-t ${isDark ? 'border-white/5 even:bg-white/[0.03]' : 'border-[#D9D9D9] even:bg-[#fef9f0]'}`}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartComponent({ chartType, title, labels, values, theme }: { chartType: 'pie' | 'bar'; title: string; labels: string[]; values: number[]; theme: SlideTheme }) {
  const isDark = theme === 'dark'
  const max = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0) || 1

  if (chartType === 'bar') {
    return (
      <div className="w-full">
        {title && <p className={`text-[9px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-[#262626]'}`}>{title}</p>}
        <div className="space-y-1">
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[7px] w-10 shrink-0 truncate opacity-70">{label}</span>
              <div className={`flex-1 h-4 rounded ${isDark ? 'bg-white/5' : 'bg-[#D9D9D9]/40'}`}>
                <div className="h-full rounded" style={{ width: `${(values[i] / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              </div>
              <span className="text-[7px] w-5 text-right opacity-70">{values[i]}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  let cumulative = 0
  const slices = values.map((v, i) => {
    const start = cumulative
    cumulative += (v / total) * 360
    return { start, end: cumulative, color: CHART_COLORS[i % CHART_COLORS.length], label: labels[i], value: v }
  })
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)
  const arcPath = (startAngle: number, endAngle: number, r: number) => {
    const start = { x: 50 + r * Math.cos(toRad(startAngle)), y: 50 + r * Math.sin(toRad(startAngle)) }
    const end = { x: 50 + r * Math.cos(toRad(endAngle)), y: 50 + r * Math.sin(toRad(endAngle)) }
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M 50 50 L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div className="w-full flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-20 h-20 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={arcPath(s.start, s.end, 45)} fill={s.color} stroke={isDark ? '#0d0d0d' : '#ffffff'} strokeWidth="0.5" />
        ))}
      </svg>
      <div className="space-y-0.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-[7px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="opacity-80">{s.label}: {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImagePlaceholder({ src, theme, className = '' }: { src?: string; theme: SlideTheme; className?: string }) {
  const isDark = theme === 'dark'
  return (
    <div className={`rounded border ${isDark ? 'border-[#FF9102]/30 bg-white/5' : 'border-black/10 bg-[#D9D9D9]/30'} flex items-center justify-center overflow-hidden ${className}`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[8px] opacity-40">Image</span>
      )}
    </div>
  )
}

// Layout-specific renderers
function TitleLayout({ slide, editHandler }: { slide: Slide; editHandler?: SlideEditHandler }) {
  const heading = getText(slide, 'heading')
  const subtitle = getText(slide, 'text')
  const headingComp = slide.components.find(c => c.type === 'heading')
  const textComp = slide.components.find(c => c.type === 'text')
  return (
    <div className="text-center space-y-2">
      {editHandler && headingComp ? (
        <div className="font-title text-[14px] leading-tight">
          <InlineEdit value={heading || 'Presentation Title'} onSave={(text) => editHandler.onEditComponent(headingComp.id, { text })} />
        </div>
      ) : (
        <p className="font-title text-[14px] leading-tight">{heading || 'Presentation Title'}</p>
      )}
      <div className="w-12 h-[2px] mx-auto bg-gradient-to-r from-[#FF7500] to-[#FFC767]" />
      {subtitle && editHandler && textComp ? (
        <div className="text-[9px] opacity-70">
          <InlineEdit value={subtitle} onSave={(text) => editHandler.onEditComponent(textComp.id, { text })} />
        </div>
      ) : (
        subtitle && <p className="text-[9px] opacity-70">{subtitle}</p>
      )}
    </div>
  )
}

function TitleImageLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const subtitle = getText(slide, 'text')
  const imgSrc = getImage(slide)
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <ImagePlaceholder src={imgSrc} theme={slide.theme} className="w-full h-24" />
      <div className="text-center">
        <p className="font-title text-[12px] uppercase tracking-wider">{heading || 'TITLE'}</p>
        {subtitle && <p className="text-[8px] opacity-70">{subtitle}</p>}
      </div>
    </div>
  )
}

function ChapterLayout({ slide, editHandler }: { slide: Slide; editHandler?: SlideEditHandler }) {
  const heading = getText(slide, 'heading')
  const headingComp = slide.components.find(c => c.type === 'heading')
  return (
    <div className="text-center">
      {editHandler && headingComp ? (
        <div className="font-title text-[16px] uppercase tracking-[0.15em]">
          <InlineEdit value={heading || 'CHAPTER HEADING'} onSave={(text) => editHandler.onEditComponent(headingComp.id, { text })} />
        </div>
      ) : (
        <p className="font-title text-[16px] uppercase tracking-[0.15em]">{heading || 'CHAPTER HEADING'}</p>
      )}
    </div>
  )
}

function AgendaLayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const fallback = ['Short agenda', 'More Impact', 'Not as much Detail', 'Straight to the point', 'About five topics']
  const displayItems = items.length > 0 ? items : fallback
  return (
    <div className="w-full space-y-1">
      {displayItems.map((item, i) => (
        <div key={i} className={`flex justify-between items-baseline py-1 border-b ${slide.theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <span className="font-title text-[10px]">{item}</span>
          <span className="text-[7px] opacity-50">15 min</span>
        </div>
      ))}
    </div>
  )
}

function ChapterCardsLayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const fallback = ['Lorem ipsum dolor', 'Lorem ipsum dolor', 'Lorem ipsum dolor', 'Lorem ipsum dolor']
  const displayItems = items.length > 0 ? items : fallback
  return (
    <div className="w-full grid grid-cols-4 gap-1.5">
      {displayItems.slice(0, 4).map((item, i) => (
        <div key={i} className="bg-gradient-to-br from-[#FF7500] to-[#FFA101] rounded-md p-2 text-white">
          <div className="font-title text-[12px] mb-1">{String(i + 1).padStart(2, '0')}</div>
          <div className="text-[7px] leading-tight">{item}</div>
        </div>
      ))}
    </div>
  )
}

function TwoColumnLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const lists = slide.components.filter(c => c.type === 'list')
  const leftItems = (lists[0]?.props?.items as string[]) || ['Point one', 'Point two']
  const rightItems = (lists[1]?.props?.items as string[]) || ['Point one', 'Point two']
  const isDark = slide.theme === 'dark'
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-md p-2 border ${isDark ? 'border-[#FF9102]/25 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'}`}>
          <p className="text-[8px] font-semibold text-[#FF9102] mb-1">Left Column</p>
          {leftItems.map((item, i) => (
            <p key={i} className="text-[7px] pl-2 relative before:absolute before:left-0 before:top-[5px] before:w-1 before:h-1 before:rounded-full before:bg-[#FF9102] leading-relaxed">{item}</p>
          ))}
        </div>
        <div className={`rounded-md p-2 border ${isDark ? 'border-[#FF9102]/25 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'}`}>
          <p className="text-[8px] font-semibold text-[#FF9102] mb-1">Right Column</p>
          {rightItems.map((item, i) => (
            <p key={i} className="text-[7px] pl-2 relative before:absolute before:left-0 before:top-[5px] before:w-1 before:h-1 before:rounded-full before:bg-[#FF9102] leading-relaxed">{item}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

function GridLayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const count = items.length > 0 ? Math.min(items.length, 8) : 4
  const displayItems = items.length > 0 ? items.slice(0, 8) : Array(4).fill('Description text')
  return (
    <div className={`w-full grid ${count > 4 ? 'grid-cols-4' : 'grid-cols-' + count} gap-1`}>
      {displayItems.map((item, i) => (
        <div key={i} className={`rounded-md p-2 border text-center ${slide.theme === 'dark' ? 'border-[#FFC767]/30 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'}`}>
          <div className="font-title text-[11px] text-[#FF9102] mb-0.5">{String(i + 1).padStart(2, '0')}</div>
          <div className="text-[6px] opacity-70 leading-tight">{item}</div>
        </div>
      ))}
    </div>
  )
}

function TableLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const tableComp = slide.components.find(c => c.type === 'table')
  const headers = (tableComp?.props?.headers as string[]) || ['Column 1', 'Column 2', 'Column 3']
  const rows = (tableComp?.props?.rows as string[][]) || [['Data', 'Data', 'Data'], ['Data', 'Data', 'Data']]
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <TableComponent headers={headers} rows={rows} theme={slide.theme} />
    </div>
  )
}

function InteractiveTableLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const tableComp = slide.components.find(c => c.type === 'table')
  const headers = (tableComp?.props?.headers as string[]) || ['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5']
  const rows = (tableComp?.props?.rows as string[][]) || Array(5).fill(Array(5).fill(''))
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="border-2 border-transparent" style={{ borderImage: 'linear-gradient(135deg, #FF9102 0%, transparent 20%, transparent 80%, #FF0000) 1' }}>
        <table className="w-full text-[7px]">
          <thead>
            <tr className="bg-[#FFA500]">
              {headers.map((h, i) => (
                <th key={i} className="px-1.5 py-1 text-center text-white font-semibold border-r border-white/30 last:border-r-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-black/[0.03]'}>
                {(row.length ? row : headers.map(() => '')).slice(0, headers.length).map((cell, ci) => (
                  <td key={ci} className="px-1.5 py-1 text-center">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProcessLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const items = getList(slide)
  const steps = items.length > 0 ? items.slice(0, 4) : ['Step one', 'Step two', 'Step three', 'Step four']
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="grid grid-cols-4 gap-0">
        {steps.map((step, i) => (
          <div key={i} className="text-center px-1">
            <div className={`h-6 flex items-center justify-center font-title text-[10px] border ${i === 2 ? 'border-[#FF9102]' : slide.theme === 'dark' ? 'border-white/20' : 'border-black/15'}`}
              style={{ clipPath: i === 0 ? 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' : 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <p className="text-[6px] mt-1 leading-tight opacity-80">{step}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuoteLayout({ slide, editHandler }: { slide: Slide; editHandler?: SlideEditHandler }) {
  const text = getText(slide, 'text') || getText(slide, 'heading')
  const content = text || 'Here is some captivating text which makes a key point'
  const comp = slide.components.find(c => c.type === 'text') || slide.components.find(c => c.type === 'heading')
  return (
    <div className={`w-full rounded border p-4 text-center ${slide.theme === 'dark' ? 'border-[#FF9102] bg-white/5' : 'border-[#FF9102] bg-[#7D7D7D]/10'}`}>
      {editHandler && comp ? (
        <div className="font-title text-[11px] leading-relaxed">
          <InlineEdit value={content} onSave={(val) => editHandler.onEditComponent(comp.id, { text: val })} />
        </div>
      ) : (
        <p className="font-title text-[11px] leading-relaxed">{content}</p>
      )}
    </div>
  )
}

function StatementLayout({ slide, editHandler }: { slide: Slide; editHandler?: SlideEditHandler }) {
  const heading = getText(slide, 'heading')
  const headingComp = slide.components.find(c => c.type === 'heading')
  return (
    <div className="text-center px-4">
      {editHandler && headingComp ? (
        <div className="font-title text-[13px] leading-tight">
          <InlineEdit value={heading || 'This headline is best suited for a single, bold statement.'} onSave={(text) => editHandler.onEditComponent(headingComp.id, { text })} />
        </div>
      ) : (
        <p className="font-title text-[13px] leading-tight">{heading || 'This headline is best suited for a single, bold statement.'}</p>
      )}
    </div>
  )
}

function ImageTextLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const imgSrc = getImage(slide)
  return (
    <div className="w-full grid grid-cols-2 gap-3 items-center">
      <div>
        <p className="font-title text-[12px] leading-tight">{heading || 'Image slide headline.'}</p>
      </div>
      <ImagePlaceholder src={imgSrc} theme={slide.theme} className="w-full h-20" />
    </div>
  )
}

function TeamLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const images = slide.components.filter(c => c.type === 'image')
  const isDark = slide.theme === 'dark'
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="text-center">
            <div className={`w-10 h-10 mx-auto rounded-full border-2 border-[#FF9102] overflow-hidden ${isDark ? 'bg-white/5' : 'bg-[#D9D9D9]/40'}`}>
              {images[i]?.props?.src ? (
                <img src={images[i].props.src as string} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[8px] opacity-40">&#128247;</div>
              )}
            </div>
            <p className="text-[7px] font-title mt-1">Name</p>
            <p className="text-[6px] opacity-50">Role</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const items = getList(slide)
  const dates = items.length > 0 ? items.slice(0, 4) : ['2024', '2025', '2026', '2027']
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="relative flex">
        <div className={`absolute top-[14px] left-0 right-0 h-[1px] ${slide.theme === 'dark' ? 'bg-white/20' : 'bg-black/15'}`} />
        {dates.map((date, i) => (
          <div key={i} className="flex-1 text-center relative pt-6">
            <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF9102]" />
            <p className="text-[7px] font-bold uppercase opacity-60">{date}</p>
            <p className="text-[6px] mt-0.5 opacity-60 leading-tight">Description text.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TwoImagesTextLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const lists = slide.components.filter(c => c.type === 'list')
  const leftItems = (lists[0]?.props?.items as string[]) || ['First point', 'Second point']
  const rightItems = (lists[1]?.props?.items as string[]) || ['First point', 'Second point']
  const isDark = slide.theme === 'dark'
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[11px] text-center">{heading}</p>}
      <div className="grid grid-cols-2 gap-2">
        {[leftItems, rightItems].map((items, idx) => (
          <div key={idx} className={`rounded-md border-2 border-[#FF9102] overflow-hidden ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
            <div className="bg-gradient-to-r from-[#FF7500] to-[#FFC767] px-2 py-0.5 text-center text-[7px] font-semibold text-white">text</div>
            <div className={`h-12 mx-2 mt-1 rounded flex items-center justify-center text-[7px] opacity-40 ${isDark ? 'bg-white/5' : 'bg-[#D9D9D9]/40'}`}>Image</div>
            <div className="px-2 py-1">
              {items.map((item, i) => (
                <p key={i} className="text-[6px] leading-relaxed pl-2 relative before:absolute before:left-0 before:content-['!'] before:text-[#FF9102] before:font-bold before:text-[6px]">{item}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <span className="text-[#FF9102] text-[8px]">&#9660;</span>
        <p className="font-title text-[8px] italic text-[#FFC767]">Text in Sentence</p>
      </div>
    </div>
  )
}

function TopicOverviewLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const isDark = slide.theme === 'dark'
  const imgSrc = getImage(slide)
  return (
    <div className="w-full space-y-1">
      {heading && <p className="font-title text-[10px] text-center">{heading}</p>}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="space-y-1.5">
          {['Topic 01', 'Topic 03', 'Topic 05'].map((t, i) => (
            <div key={i}>
              <p className="text-[7px] font-semibold text-[#FF9102]">{t}</p>
              <p className="text-[5px] opacity-60 leading-tight">Lorem ipsum dolor sit amet</p>
            </div>
          ))}
        </div>
        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center overflow-hidden ${isDark ? 'border-white/30 bg-white/5' : 'border-black/20 bg-[#D9D9D9]/40'}`}>
          {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover rounded-full" /> : <span className="text-[6px] opacity-40">Image</span>}
        </div>
        <div className="space-y-1.5">
          {['Topic 02', 'Topic 04', 'Topic 06'].map((t, i) => (
            <div key={i}>
              <p className="text-[7px] font-semibold text-[#FF9102]">{t}</p>
              <p className="text-[5px] opacity-60 leading-tight">Lorem ipsum dolor sit amet</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ThreeImagesLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const images = slide.components.filter(c => c.type === 'image')
  return (
    <div className="w-full space-y-2">
      {heading && <p className="font-title text-[10px] text-center leading-tight">{heading}</p>}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i}>
            <ImagePlaceholder src={images[i]?.props?.src as string} theme={slide.theme} className="w-full h-12" />
            <p className="text-[5px] mt-1 opacity-60 leading-tight">Description text for this image.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const PREVIEW_SCALE = 0.35

function InlineEdit({ value, onSave, className, style, multiline }: {
  value: string
  onSave: (val: string) => void
  className?: string
  style?: React.CSSProperties
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [editing])

  if (!editing) {
    return (
      <span
        className={`${className || ''} cursor-text hover:outline hover:outline-1 hover:outline-[#FF9102]/50 hover:rounded-sm transition-all`}
        style={style}
        onDoubleClick={() => { setDraft(value); setEditing(true) }}
        title="Double-click to edit"
      >
        {value}
      </span>
    )
  }

  const commit = () => { if (draft !== value) onSave(draft); setEditing(false) }

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`${className || ''} bg-black/30 border border-[#FF9102]/60 rounded px-1 outline-none resize-none w-full`}
        style={{ ...style, minHeight: '2em' }}
      />
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      className={`${className || ''} bg-black/30 border border-[#FF9102]/60 rounded px-1 outline-none w-full`}
      style={style}
    />
  )
}

function InlineListEdit({ items, onSave, style }: {
  items: string[]
  onSave: (items: string[]) => void
  style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items.join('\n'))
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
    }
  }, [editing])

  if (!editing) {
    return (
      <ul
        className="space-y-0.5 cursor-text hover:outline hover:outline-1 hover:outline-[#FF9102]/50 hover:rounded-sm transition-all"
        style={style}
        onDoubleClick={() => { setDraft(items.join('\n')); setEditing(true) }}
        title="Double-click to edit"
      >
        {items.map((item, i) => (
          <li key={i} className="text-[8px] pl-3 relative before:absolute before:left-0 before:top-[5px] before:w-1.5 before:h-[1.5px] before:bg-[#FF9102]">
            {item}
          </li>
        ))}
      </ul>
    )
  }

  const commit = () => {
    const newItems = draft.split('\n').filter(l => l.trim())
    onSave(newItems)
    setEditing(false)
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(items.join('\n')); setEditing(false) } }}
      className="w-full bg-black/30 border border-[#FF9102]/60 rounded px-1 py-0.5 text-[8px] outline-none resize-none"
      style={{ ...style, minHeight: `${Math.max(items.length * 1.2, 3)}em` }}
      placeholder="One item per line"
    />
  )
}

function GenericComponentsLayout({ slide, editHandler }: { slide: Slide; editHandler?: SlideEditHandler }) {
  return (
    <div className="w-full space-y-2 max-h-full overflow-hidden">
      <AdaptiveScale>
      {slide.components.map((comp) => {
        const ox = (comp.props.offsetX as number) || 0
        const oy = (comp.props.offsetY as number) || 0
        const headingDefault = comp.props.level === 1 ? 56 : 44
        const fontSize = (comp.props.fontSize as number) || headingDefault
        const color = comp.props.color as string | undefined
        switch (comp.type) {
          case 'heading':
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                {editHandler ? (
                  <div className="font-title leading-tight" style={{ fontSize: `${fontSize * PREVIEW_SCALE}px`, color }}>
                    <InlineEdit
                      value={comp.props.text as string}
                      onSave={(text) => editHandler.onEditComponent(comp.id, { text })}
                    />
                  </div>
                ) : comp.props.level === 1 ? (
                  <h1 className="font-title leading-tight" style={{ fontSize: `${fontSize * PREVIEW_SCALE}px`, color }}>
                    {comp.props.text as string}
                  </h1>
                ) : (
                  <h2 className="font-title leading-tight" style={{ fontSize: `${fontSize * PREVIEW_SCALE}px`, color }}>
                    {comp.props.text as string}
                  </h2>
                )}
              </Draggable>
            )
          case 'text': {
            const textSize = (comp.props.fontSize as number) || 16
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                {editHandler ? (
                  <div className="opacity-80 leading-relaxed" style={{ fontSize: `${textSize * PREVIEW_SCALE}px`, color }}>
                    <InlineEdit
                      value={comp.props.text as string}
                      onSave={(text) => editHandler.onEditComponent(comp.id, { text })}
                      multiline
                    />
                  </div>
                ) : (
                  <p className="opacity-80 leading-relaxed" style={{ fontSize: `${textSize * PREVIEW_SCALE}px`, color }}>
                    {comp.props.text as string}
                  </p>
                )}
              </Draggable>
            )
          }
          case 'list':
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                {editHandler ? (
                  <InlineListEdit
                    items={comp.props.items as string[]}
                    onSave={(items) => editHandler.onEditComponent(comp.id, { items })}
                  />
                ) : (
                  <ul className="space-y-0.5">
                    {(comp.props.items as string[]).map((item, i) => (
                      <li key={i} className="text-[8px] pl-3 relative before:absolute before:left-0 before:top-[5px] before:w-1.5 before:h-[1.5px] before:bg-[#FF9102]">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </Draggable>
            )
          case 'table':
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                <TableComponent headers={comp.props.headers as string[]} rows={comp.props.rows as string[][]} theme={slide.theme} />
              </Draggable>
            )
          case 'chart':
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                <ChartComponent chartType={comp.props.chartType as 'pie' | 'bar'} title={comp.props.title as string} labels={comp.props.labels as string[]} values={comp.props.values as number[]} theme={slide.theme} />
              </Draggable>
            )
          case 'image': {
            const caption = comp.props.caption as string | undefined
            return (
              <Draggable key={comp.id} id={comp.id} offsetX={ox} offsetY={oy} editHandler={editHandler}>
                <ImagePlaceholder src={comp.props.src as string} theme={slide.theme} className="w-full h-20" />
                {caption && <p className="text-[6px] mt-0.5 opacity-50">{caption}</p>}
              </Draggable>
            )
          }
          default:
            return null
        }
      })}
      {slide.components.length === 0 && (
        <div className="text-center opacity-40 py-4">
          <p className="text-[10px]">Empty slide</p>
          <p className="text-[7px] mt-0.5">Add components from the panel</p>
        </div>
      )}
      </AdaptiveScale>
    </div>
  )
}

function MeetingLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const items = getList(slide)
  const textComp = getText(slide, 'text')
  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 pb-2">
      {/* Header bar */}
      <div className="bg-[#262626] rounded-t px-3 py-1.5 flex items-center justify-between">
        <span className="text-[8px] text-white font-semibold">{heading || 'People Management Meeting'}</span>
        <span className="text-[6px] text-white/60">Cover Page</span>
      </div>
      {/* Body */}
      <div className="flex-1 border border-[#d9d9d9] border-t-0 rounded-b p-3 bg-white">
        <div className="space-y-2">
          {/* Fields */}
          {['Committee', 'Topic', 'Responsible', 'Speaker'].map((label, i) => (
            <div key={i} className="flex items-center border-b border-[#e5e5e5] pb-1">
              <span className="text-[7px] font-semibold text-[#262626] w-16">{label}:</span>
              <span className="text-[7px] text-[#666]">{items[i] || `[${label}]`}</span>
            </div>
          ))}
          {/* AI checkboxes */}
          <div className="mt-3 pt-2 border-t border-[#e5e5e5]">
            <span className="text-[6px] font-semibold text-[#262626] uppercase tracking-wider">AI Solution Used</span>
            <div className="flex gap-3 mt-1">
              {['M365 Copilot Chat', 'M365 Copilot Agent', 'Company-provided AI', 'Other'].map((label) => (
                <div key={label} className="flex items-center gap-0.5">
                  <div className="w-2 h-2 border border-[#999] rounded-sm bg-white" />
                  <span className="text-[5.5px] text-[#666]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {textComp && <p className="text-[6px] text-[#999] mt-2 italic">{textComp}</p>}
      </div>
    </div>
  )
}

function MeetingSummaryLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  const items = getList(slide)
  const defaultItems = [
    'Which information is essential for understanding the topic?',
    'Are there any decisions to be made? What is the intended outcome?',
    'What are the key points that should be discussed?',
    'Where is guidance needed?',
  ]
  const displayItems = items.length > 0 ? items : defaultItems
  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 pb-2">
      {/* Header bar */}
      <div className="bg-[#262626] rounded-t px-3 py-1.5 flex items-center justify-between">
        <span className="text-[8px] text-white font-semibold">Summary</span>
        <span className="text-[6px] text-white/60">Page 2</span>
      </div>
      {/* Body */}
      <div className="flex-1 border border-[#d9d9d9] border-t-0 rounded-b p-3 bg-white overflow-hidden">
        {/* Section title */}
        <div className="mb-2 pb-1 border-b-2 border-[#FF9102]">
          <span className="text-[8px] font-bold text-[#262626]">{heading || 'Main Messages & Target'}</span>
        </div>
        {/* Bullet items */}
        <ul className="space-y-1.5">
          {displayItems.slice(0, 6).map((item, i) => (
            <li key={i} className="text-[7px] text-[#333] flex gap-1.5 leading-tight">
              <span className="text-[#FF9102] font-bold mt-0.5">&#9654;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MeetingDecisionsLayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const defaultItems = [
    'The People Management Team took note of ...',
    'The People Management Team acknowledged ...',
    'The People Management Team approved ...',
    'The People Management Team decided ...',
  ]
  const displayItems = items.length > 0 ? items : defaultItems
  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 pb-2">
      {/* Header bar */}
      <div className="bg-[#262626] rounded-t px-3 py-1.5 flex items-center justify-between">
        <span className="text-[8px] text-white font-semibold">Decisions / Acknowledgements</span>
        <span className="text-[6px] text-white/60">Page 3</span>
      </div>
      {/* Body */}
      <div className="flex-1 border border-[#d9d9d9] border-t-0 rounded-b p-3 bg-white overflow-hidden">
        <div className="mb-2 pb-1 border-b-2 border-[#FF9102]">
          <span className="text-[8px] font-bold text-[#262626]">Decisions & Acknowledgements</span>
        </div>
        <ul className="space-y-2">
          {displayItems.slice(0, 5).map((item, i) => (
            <li key={i} className="text-[7px] text-[#333] flex gap-1.5 leading-tight">
              <span className="text-[#FF9102] font-bold shrink-0">&#10003;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MeetingNextStepsLayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const defaultItems = [
    'Task 1: [Description] | Responsible: [Name/Unit] | Target: [Date]',
    'Task 2: [Description] | Responsible: [Name/Unit] | Target: [Date]',
    'Task 3: [Description] | Responsible: [Name/Unit] | Target: [Date]',
  ]
  const displayItems = items.length > 0 ? items : defaultItems
  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 pb-2">
      {/* Header bar */}
      <div className="bg-[#262626] rounded-t px-3 py-1.5 flex items-center justify-between">
        <span className="text-[8px] text-white font-semibold">Next Steps & Tasks</span>
        <span className="text-[6px] text-white/60">Page 3</span>
      </div>
      {/* Body */}
      <div className="flex-1 border border-[#d9d9d9] border-t-0 rounded-b p-3 bg-white overflow-hidden">
        <div className="mb-2 pb-1 border-b-2 border-[#FF9102]">
          <span className="text-[8px] font-bold text-[#262626]">Next Steps & Tasks</span>
        </div>
        {/* Task table */}
        <table className="w-full text-[6.5px] border border-[#e5e5e5]">
          <thead>
            <tr className="bg-[#FF9102]">
              <th className="text-left text-white font-semibold px-1.5 py-1 border-r border-white/30">Task</th>
              <th className="text-left text-white font-semibold px-1.5 py-1 border-r border-white/30">Responsible</th>
              <th className="text-left text-white font-semibold px-1.5 py-1">Target Date</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.slice(0, 5).map((item, i) => {
              const parts = item.split('|').map(s => s.replace(/^[^:]*:\s*/, '').trim())
              return (
                <tr key={i} className={`border-t border-[#e5e5e5] ${i % 2 === 1 ? 'bg-[#fef9f0]' : ''}`}>
                  <td className="px-1.5 py-1 text-[#333] border-r border-[#e5e5e5]">{parts[0] || item}</td>
                  <td className="px-1.5 py-1 text-[#333] border-r border-[#e5e5e5]">{parts[1] || '[Name]'}</td>
                  <td className="px-1.5 py-1 text-[#333]">{parts[2] || '[Date]'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MeetingAILayout({ slide }: { slide: Slide }) {
  const items = getList(slide)
  const defaultItems = [
    'AI Solution Used: [Specify tool/agent]',
    'Purpose: Added value of AI in preparation of this topic',
    'Key Learnings: What worked well / What did not work as expected',
  ]
  const displayItems = items.length > 0 ? items : defaultItems
  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 pb-2">
      {/* Header bar */}
      <div className="bg-[#262626] rounded-t px-3 py-1.5 flex items-center justify-between">
        <span className="text-[8px] text-white font-semibold">AI Contribution</span>
        <span className="text-[6px] text-white/60">Page 4</span>
      </div>
      {/* Body */}
      <div className="flex-1 border border-[#d9d9d9] border-t-0 rounded-b p-3 bg-white overflow-hidden">
        <div className="mb-2 pb-1 border-b-2 border-[#00B0F0]">
          <span className="text-[8px] font-bold text-[#262626]">AI Contribution</span>
        </div>
        {/* AI details */}
        <div className="space-y-2">
          {displayItems.map((item, i) => {
            const colonIdx = item.indexOf(':')
            const label = colonIdx > -1 ? item.slice(0, colonIdx) : ''
            const value = colonIdx > -1 ? item.slice(colonIdx + 1).trim() : item
            return (
              <div key={i} className="flex gap-1.5 text-[7px]">
                {label ? (
                  <>
                    <span className="font-semibold text-[#262626] shrink-0">{label}:</span>
                    <span className="text-[#555]">{value}</span>
                  </>
                ) : (
                  <span className="text-[#555]">{value}</span>
                )}
              </div>
            )
          })}
        </div>
        {/* AI checkbox reminder */}
        <div className="mt-3 pt-2 border-t border-[#e5e5e5]">
          <span className="text-[6px] font-semibold text-[#262626] uppercase tracking-wider">AI Solution Used</span>
          <div className="flex gap-3 mt-1">
            {['None', 'M365 Copilot Chat', 'M365 Copilot Agent', 'Company-provided AI', 'Other'].map((label) => (
              <div key={label} className="flex items-center gap-0.5">
                <div className="w-2 h-2 border border-[#999] rounded-sm bg-white" />
                <span className="text-[5.5px] text-[#666]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BlankLayout({ slide }: { slide: Slide }) {
  const heading = getText(slide, 'heading')
  return (
    <div className="text-center">
      <p className="font-title text-[11px]">{heading || 'This slide is intentionally left blank.'}</p>
    </div>
  )
}

/**
 * Renders a slide whose design is carried as verbatim HTML + CSS (the
 * "keep all design elements as original" path used by templates like the
 * AI Use Case Timeline). The markup runs inside an isolated iframe so the
 * original stylesheet cannot leak into the editor, and is uniformly scaled
 * to fit the slide box — measured at a fixed 960px design width.
 */
function RawHtmlLayout({ slide }: { slide: Slide }) {
  const raw = slide.components.find((c) => c.type === 'raw')
  if (!raw) return null
  const html = (raw.props.html as string) || ''
  const css = (raw.props.css as string) || ''
  const theme: SlideTheme = (raw.props.theme as SlideTheme) || slide.theme
  // 'fit' (default) scales the 960px design to fit the slide box (template
  // slides and one-page newsletters). 'scroll' scales by width only and lets
  // tall content scroll vertically (vertical one-pagers / briefs).
  const fitMode: 'fit' | 'scroll' = (raw.props.fit as 'fit' | 'scroll') || 'fit'

  const DESIGN_W = 960
  const wrapRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.1)
  const [contentH, setContentH] = useState(540)

  const bodyClass = theme === 'light' ? 'light-theme' : ''
  const srcDoc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${css}\nhtml,body{overflow:hidden;margin:0;}\n.page{min-height:auto;width:${DESIGN_W}px;}\n</style></head><body class="${bodyClass}"><div class="page">${html}</div></body></html>`

  const fit = useCallback(() => {
    const wrap = wrapRef.current
    const iframe = iframeRef.current
    if (!wrap || !iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (!doc || !doc.body) return
      const h = doc.body.scrollHeight
      if (h && h > 0) {
        setContentH(h)
        const s = fitMode === 'scroll'
          ? wrap.clientWidth / DESIGN_W
          : Math.min(wrap.clientWidth / DESIGN_W, wrap.clientHeight / h)
        setScale(s > 0 ? s : 0.1)
      }
    } catch {
      /* srcdoc is same-origin; ignore */
    }
  }, [fitMode])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => fit())
    ro.observe(wrap)
    fit()
    return () => ro.disconnect()
  }, [fit])

  const bg = theme === 'light' ? '#f5f5f5' : '#0a0a0a'

  // Scroll mode: anchor top-left, scale by width only, and let the wrapper
  // scroll vertically. A spacer carries the scaled height so the scrollbar
  // matches the visible (scaled) content rather than the unscaled 960px size.
  if (fitMode === 'scroll') {
    return (
      <div
        ref={wrapRef}
        className="w-full h-full relative"
        style={{ overflowY: 'auto', overflowX: 'hidden', background: bg }}
      >
        <div style={{ position: 'relative', width: '100%', height: contentH * scale }}>
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title="slide-content"
            onLoad={fit}
            scrolling="no"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_W,
              height: contentH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              border: '0',
              background: bg,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="w-full h-full overflow-hidden relative" style={{ background: bg }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="slide-content"
        onLoad={fit}
        scrolling="no"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: DESIGN_W,
          height: contentH,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
          border: '0',
          background: bg,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

interface Props {
  slide: Slide
  theme?: string
  editHandler?: SlideEditHandler
  brandKit?: import('@/types/deck').BrandKit
}

export function SlidePreview({ slide, editHandler, brandKit }: Props) {
  // Raw-HTML slides carry their own full design (background, logo, layout) as
  // verbatim markup — skip DeckForge's chrome and render them full-bleed.
  if (slide.layout === 'raw-html') {
    return <RawHtmlLayout slide={slide} />
  }

  const primary = brandKit?.primaryColor || '#FF9102'
  const secondary = brandKit?.secondaryColor || '#FFC767'
  const darkBg = brandKit?.darkBg || '#0d0d0d'
  const lightBg = brandKit?.lightBg || '#ffffff'

  const bgStyle = slide.theme === 'dark'
    ? { background: `linear-gradient(135deg, ${darkBg}, #1a1a1a, ${darkBg})`, color: '#ffffff' }
    : { background: `linear-gradient(180deg, ${lightBg}, #fef9f0)`, color: '#262626' }

  const renderLayout = () => {
    switch (slide.layout) {
      case 'title': return <TitleLayout slide={slide} editHandler={editHandler} />
      case 'title-image': return <TitleImageLayout slide={slide} />
      case 'chapter': return <ChapterLayout slide={slide} editHandler={editHandler} />
      case 'agenda': return <AgendaLayout slide={slide} />
      case 'chapter-cards': return <ChapterCardsLayout slide={slide} />
      case 'two-column': return <TwoColumnLayout slide={slide} />
      case 'grid': return <GridLayout slide={slide} />
      case 'table': return <TableLayout slide={slide} />
      case 'interactive-table': return <InteractiveTableLayout slide={slide} />
      case 'process': return <ProcessLayout slide={slide} />
      case 'quote': return <QuoteLayout slide={slide} editHandler={editHandler} />
      case 'statement': return <StatementLayout slide={slide} editHandler={editHandler} />
      case 'image-text': return <ImageTextLayout slide={slide} />
      case 'team': return <TeamLayout slide={slide} />
      case 'timeline': return <TimelineLayout slide={slide} />
      case 'two-images-text': return <TwoImagesTextLayout slide={slide} />
      case 'topic-overview': return <TopicOverviewLayout slide={slide} />
      case 'three-images': return <ThreeImagesLayout slide={slide} />
      case 'meeting': return <MeetingLayout slide={slide} />
      case 'meeting-summary': return <MeetingSummaryLayout slide={slide} />
      case 'meeting-decisions': return <MeetingDecisionsLayout slide={slide} />
      case 'meeting-nextsteps': return <MeetingNextStepsLayout slide={slide} />
      case 'meeting-ai': return <MeetingAILayout slide={slide} />
      case 'blank': return <BlankLayout slide={slide} />
      case 'raw-html': return <RawHtmlLayout slide={slide} />
      case 'content':
      case 'stats':
      default:
        return <GenericComponentsLayout slide={slide} editHandler={editHandler} />
    }
  }

  const hexToRgb = (hex: string) => {
    const m = hex.replace('#', '').match(/.{2}/g)
    return m ? m.map(x => parseInt(x, 16)).join(', ') : '255, 145, 2'
  }

  const primaryRgb = hexToRgb(primary)
  const secondaryRgb = hexToRgb(secondary)

  return (
    <div className="w-full h-full relative flex flex-col justify-center items-center p-8 overflow-hidden" style={{ ...bgStyle, '--brand-primary': primary, '--brand-secondary': secondary } as React.CSSProperties}>
      {/* Star background pattern */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70' viewBox='0 0 70 70'%3E%3Cpath d='M35 20 L36.3 33.2 L46.5 40.5 L35 36.5 L23.5 40.5 L33.7 33.2 Z' fill='${slide.theme === 'dark' ? '%23ffffff' : '%23c8a050'}'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }} />

      {/* Gradient overlay — uses brand colors */}
      {slide.theme === 'dark' && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at top right, rgba(${primaryRgb}, 0.2) 0%, transparent 45%), radial-gradient(ellipse at bottom left, rgba(${primaryRgb}, 0.15) 0%, transparent 45%)`,
        }} />
      )}
      {slide.theme === 'light' && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at top left, rgba(${secondaryRgb}, 0.25) 0%, transparent 40%), radial-gradient(ellipse at bottom right, rgba(${secondaryRgb}, 0.2) 0%, transparent 40%)`,
        }} />
      )}

      <MBLogo theme={slide.theme} />

      {/* Slide content */}
      <div className="relative z-10 w-full max-w-full px-2">
        {renderLayout()}
      </div>

      <SlideFooter theme={slide.theme} />
    </div>
  )
}
