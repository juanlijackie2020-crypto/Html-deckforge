export type SlideTheme = 'dark' | 'light'

export type SlideLayoutType =
  | 'title'
  | 'title-image'
  | 'chapter'
  | 'agenda'
  | 'chapter-cards'
  | 'two-column'
  | 'grid'
  | 'table'
  | 'interactive-table'
  | 'process'
  | 'quote'
  | 'statement'
  | 'image-text'
  | 'team'
  | 'timeline'
  | 'two-images-text'
  | 'topic-overview'
  | 'three-images'
  | 'content'
  | 'stats'
  | 'meeting'
  | 'meeting-summary'
  | 'meeting-decisions'
  | 'meeting-nextsteps'
  | 'meeting-ai'
  | 'blank'
  | 'raw-html'

export type ComponentType =
  | 'heading'
  | 'text'
  | 'list'
  | 'card'
  | 'stat'
  | 'image'
  | 'flow'
  | 'grid'
  | 'table'
  | 'chart'
  | 'raw'

export interface SlideComponent {
  id: string
  type: ComponentType
  props: Record<string, unknown>
}

export interface TableProps {
  headers: string[]
  rows: string[][]
}

export interface ChartProps {
  chartType: 'pie' | 'bar'
  title: string
  labels: string[]
  values: number[]
}

export interface ImageProps {
  src: string
  alt: string
  caption?: string
}

export type SlideTransition = 'slide' | 'fade' | 'zoom' | 'none'

export interface Slide {
  id: string
  theme: SlideTheme
  layout: SlideLayoutType
  transition?: SlideTransition
  components: SlideComponent[]
  notes?: string
  /** Chapter label used to group this slide under a deck-level chapter-nav frame. */
  chapter?: string
}

/** Deck-level chrome/frame rendered around every slide (e.g. a persistent left chapter navigator). */
export type DeckFrameType = 'none' | 'chapter-nav'

export interface DeckFrame {
  type: DeckFrameType
  /** Sidebar width in px (chapter-nav). */
  sidebarWidth?: number
  /** Footer text shown at the bottom of the chapter-nav (e.g. "MB PET · Workshop"). */
  footText?: string
}

export interface DeckMeta {
  title: string
  subtitle?: string
  date?: string
  author?: string
  brand: 'mercedes' | 'deloitte' | 'custom'
  tags: string[]
}

export interface BrandKit {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  darkBg: string
  lightBg: string
  titleFont: string
  bodyFont: string
  logoSvg?: string
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  primaryColor: '#FF9102',
  secondaryColor: '#FFC767',
  accentColor: '#00B0F0',
  darkBg: '#0a0a0a',
  lightBg: '#ffffff',
  titleFont: 'MB Corpo A Title Cond',
  bodyFont: 'Inter',
}

export const BRAND_PRESETS: Record<string, BrandKit> = {
  mercedes: DEFAULT_BRAND_KIT,
  'mercedes-cyan': { ...DEFAULT_BRAND_KIT, primaryColor: '#00B0F0', secondaryColor: '#4DD4F7', accentColor: '#FF9102' },
  'mercedes-red': { ...DEFAULT_BRAND_KIT, primaryColor: '#FF0000', secondaryColor: '#FF6666', accentColor: '#FFC767' },
  deloitte: { ...DEFAULT_BRAND_KIT, primaryColor: '#86BC25', secondaryColor: '#C4D600', accentColor: '#00B0F0' },
  minimal: { ...DEFAULT_BRAND_KIT, primaryColor: '#666666', secondaryColor: '#999999', accentColor: '#333333', darkBg: '#111111', lightBg: '#fafafa' },
}

export interface Deck {
  id: string
  meta: DeckMeta
  brandKit?: BrandKit
  slides: Slide[]
  createdAt: string
  updatedAt: string
  sourcePath?: string
  /** Optional deck-level frame (e.g. persistent left chapter navigator). */
  frame?: DeckFrame
}

export interface DeckListItem {
  name: string
  path: string
  modified: string
}

export interface ThemeConfig {
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    muted: string
  }
  fonts: {
    title: string
    body: string
  }
}

export const MB_THEME: ThemeConfig = {
  name: 'Mercedes-Benz',
  colors: {
    primary: '#FF9102',
    secondary: '#FFC767',
    accent: '#00B0F0',
    background: '#0a0a0a',
    surface: '#262626',
    text: '#ffffff',
    muted: '#7D7D7D',
  },
  fonts: {
    title: 'MB Corpo A Title Cond',
    body: 'Inter',
  },
}

export const DELOITTE_THEME: ThemeConfig = {
  name: 'Deloitte',
  colors: {
    primary: '#86BC25',
    secondary: '#FFC767',
    accent: '#00B0F0',
    background: '#0a0a0a',
    surface: '#262626',
    text: '#ffffff',
    muted: '#7D7D7D',
  },
  fonts: {
    title: 'MB Corpo A Title Cond',
    body: 'Inter',
  },
}
