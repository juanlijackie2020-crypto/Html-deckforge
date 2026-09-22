# DeckForge User Manual

## Getting Started

Launch the app:

```powershell
cd deckforge
npm run dev        # Browser mode (http://localhost:5173)
npm run electron:dev  # Full desktop app (requires Electron binary)
```

---

## Interface Overview

```
┌──┬────────────┬──────────────────────────────────┐
│  │            │                                    │
│S │  Panel     │     Slide Editor / Preview         │
│I │  (changes  │                                    │
│D │  based on  │     ┌────────────────────┐        │
│E │  active    │     │  Live Slide Canvas  │        │
│B │  tab)      │     │                    │        │
│A │            │     └────────────────────┘        │
│R │            │                                    │
│  │            ├────────────────────────────────────┤
│  │            │     Properties Panel (right)       │
└──┴────────────┴──────────────────────────────────┘
```

**Sidebar tabs (left icons):**
| Icon | Tab | Purpose |
|------|-----|---------|
| 📁 | Decks | Manage deck files (import, create, export) |
| 📄 | Slides | Navigate & reorder slides in current deck |
| 🎨 | Theme | Switch brand themes & view color palette |
| ✨ | AI | Generate content with AI assistant |

---

## 1. Creating a New Deck

**Steps:**
1. Click the **📁 Decks** tab in the sidebar
2. Click **"+ New Deck"**
3. A new deck appears with one title slide pre-populated

**Example result:**
- A deck named "Untitled Presentation" is created
- It contains 1 slide with:
  - Heading: "Untitled Presentation"
  - Subtitle: "Click to edit"
- The slide uses **dark theme** and **title layout** by default

---

## 2. Importing an Existing HTML Presentation

**Steps:**
1. Click the **📁 Decks** tab
2. Click **"Import HTML Deck"**
3. Select one or more `.html` files (e.g., `index.html` from the parent folder)
4. The importer parses slides, detects layouts, and extracts components

**Example:**
Import `index.html` (the Digital & BI Introduction deck):
- DeckForge detects **9 slides**
- Brand is identified as **Mercedes-Benz** (from the MB logo SVG)
- Each slide's layout is classified:
  - Slide 1 → `title`
  - Slide 2 → `agenda`
  - Slide 3 → `team`
  - Slide 4 → `content`
  - Slide 5 → `timeline`
  - Slide 6 → `content`
  - Slide 7 → `content`
  - Slide 8 → `content`
  - Slide 9 → `grid`

**What gets extracted per slide:**
- Theme (dark/light)
- Headings (h1, h2)
- Text paragraphs (subtitles, descriptions)
- Lists (agenda items, bullet points)

---

## 3. Navigating Slides

**Steps:**
1. Click the **📄 Slides** tab in the sidebar
2. The panel shows all slides as cards with:
   - Slide number
   - Theme badge (dark/light)
   - First heading text
   - Layout type

**Example interaction:**
```
┌─────────────────────┐
│ 1  [dark]           │  ← currently selected (orange border)
│ DIGITAL & BI INTRO  │
│ title               │
├─────────────────────┤
│ 2  [light]          │
│ agenda              │
│ agenda              │
├─────────────────────┤
│ 3  [dark]           │
│ Team Introduction   │
│ team                │
└─────────────────────┘
```

- Click any card to jump to that slide
- The main canvas updates to show the selected slide

---

## 4. Adding a New Slide

**Steps:**
1. In the **📄 Slides** panel, click the **+** button (top-right)
2. A blank "content" slide with dark theme is appended

**Example:**
After clicking +, a new slide 10 appears:
- Theme: dark
- Layout: content
- Components: (empty)

---

## 5. Deleting a Slide

**Steps:**
1. Hover over a slide card in the Slides panel
2. A red 🗑️ icon appears in the top-right corner
3. Click it to delete the slide

**Example:**
Hover over slide 4, click the trash icon → the deck goes from 9 slides to 8.

---

## 6. Editing Slide Properties

**Located in:** the right-side Properties Panel when a slide is selected.

### 6a. Changing Slide Theme

**Steps:**
1. Select a slide
2. In the Properties panel under "Slide Settings", find the **Theme** dropdown
3. Switch between `Dark` and `Light`

**Example:**
Change slide 3 (Team Introduction) from `dark` → `light`:
- Background shifts from dark gradient to white/warm
- Star pattern switches from white to dark
- Text color inverts

### 6b. Changing Slide Layout

**Steps:**
1. In "Slide Settings", change the **Layout** dropdown
2. Options: `title`, `content`, `agenda`, `team`, `grid`, `timeline`, `stats`, `quote`, `blank`

**Example:**
Set slide layout to `quote` — this informs the exporter to apply quote-specific styling.

---

## 7. Adding Components to a Slide

**Steps:**
1. Select a slide
2. In the Properties panel under "Add Component", click one of:
   - **Heading** — adds an h2 element
   - **Text** — adds a paragraph
   - **List** — adds a bullet list

**Example — adding a heading:**
1. Click "Heading"
2. Component appears with default text: "New Heading"
3. Edit inline in the text input
4. The live preview updates in real-time

**Example — adding a list:**
1. Click "List"
2. Component appears with 3 default items
3. Edit in the textarea (one item per line):
   ```
   HR Digital Strategy
   Data Governance
   AI & Analytics
   ```
4. Preview shows styled bullet points

---

## 8. Editing Existing Components

**Steps:**
1. Under "Components (N)" in the Properties panel, each component shows:
   - Type badge (orange label)
   - Editable input/textarea
   - Delete button (🗑️)

**Example — editing a heading:**
```
┌──────────────────────────────┐
│ heading                    🗑️│
│ ┌──────────────────────────┐ │
│ │ Digital & BI Introduction│ │ ← edit here
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
Type "HR Digital Transformation" → preview updates instantly.

**Example — editing a list:**
```
┌──────────────────────────────┐
│ list                       🗑️│
│ ┌──────────────────────────┐ │
│ │ HR Data Service          │ │
│ │ HR INSIGHTS              │ │ ← one item per line
│ │ AI & Analytics           │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## 9. Removing a Component

**Steps:**
1. Find the component in the Properties panel
2. Click the red 🗑️ icon next to the type label

**Example:**
Delete the subtitle text component from the title slide → only the heading remains in preview.

---

## 10. Switching Brand Theme

**Steps:**
1. Click the **🎨 Theme** tab in the sidebar
2. Two brand cards appear:
   - **Mercedes-Benz** — orange/gold/cyan palette
   - **Deloitte** — green/gold/cyan palette
3. Click to select (active card has orange border)

**Example:**
Select "Mercedes-Benz":
```
┌──────────────────────┐
│ Mercedes-Benz        │ ← selected (orange border)
│ 🟠 🟡 🔵            │
└──────────────────────┘
┌──────────────────────┐
│ Deloitte             │
│ 🟢 🟡 🔵            │
└──────────────────────┘
```

The **Color Palette** section below shows all available brand tokens:
```
🔴 #FF0000  🟠 #FF7500  🟠 #FF9102  🟡 #FFC767
⚫ #0a0a0a  ⚫ #262626  🔵 #00B0F0  ⚪ #ffffff
```

---

## 11. AI Assistant

**Steps:**
1. Click the **✨ AI** tab in the sidebar
2. Choose a **Quick Action** or type a custom prompt

### Quick Actions

| Action | What it does |
|--------|-------------|
| Generate title slide | Adds a heading component to the current slide |
| Add bullet points | Adds a 3-item list with strategic content |
| Create agenda from deck | Creates a new agenda slide listing all slide titles |
| Suggest next slide | Appends a "Next Steps" slide with action items |

**Example — "Create agenda from deck":**
1. Open a deck with 5 slides that have headings
2. Click "Create agenda from deck"
3. A new slide is added with:
   - Theme: light
   - Layout: agenda
   - Components:
     - Heading: "Agenda"
     - List: all slide titles auto-extracted

Result in preview:
```
         Agenda
   ─────────────────
   • Building the AI-Native Enterprise
   • What AI-Native Enterprise Means
   • AI Team Maturity Model
   • HR & IT Joint Exploration
   • What We Need from CDAC
```

**Example — Custom Prompt:**
1. Type in the textarea: "Create 3 bullet points about HR data governance best practices"
2. Click "Generate"
3. (Currently returns placeholder content; connect Claude API for real generation)

---

## 12. Exporting to HTML

**Steps:**
1. Click the **📁 Decks** tab
2. Select the deck you want to export
3. Click **"Export to HTML"**
4. Choose save location and filename
5. A self-contained HTML file is generated

**Example output structure:**
The exported file is a single HTML file with:
- Inline `<style>` block (brand colors, slide transitions, nav controls)
- `<div class="slide slide-dark">` for each slide
- Inline `<script>` for keyboard/touch navigation
- Progress bar and slide counter

The file can be opened directly in any browser — no dependencies needed.

**Export preserves:**
- Dark/light theme per slide
- All headings, text, and lists
- MB star-pattern background
- Orange/gold gradient overlays
- Slide transition animations
- Arrow key + touch swipe navigation

---

## 13. Managing Multiple Decks

**Steps:**
1. In the **📁 Decks** panel, all open decks are listed
2. Click any deck to switch to it
3. Hover + click 🗑️ to remove a deck from the workspace

**Example workspace:**
```
┌──────────────────────────┐
│ 📄 Digital & BI Intro    │ ← active
│    9 slides · mercedes   │
├──────────────────────────┤
│ 📄 AI Transformation     │
│    13 slides · deloitte  │
├──────────────────────────┤
│ 📄 AI-Native CDAC        │
│    6 slides · mercedes   │
└──────────────────────────┘
```

---

## Keyboard Shortcuts (Presenter Mode)

| Key | Action |
|-----|--------|
| `→` or `Space` | Next slide |
| `←` | Previous slide |
| Touch swipe left | Next slide |
| Touch swipe right | Previous slide |

---

## File Format Reference

### Internal Format (JSON)

DeckForge stores decks internally as JSON:

```json
{
  "id": "uuid",
  "meta": {
    "title": "Digital & BI Introduction",
    "brand": "mercedes",
    "tags": ["hr", "digital"]
  },
  "slides": [
    {
      "id": "uuid",
      "theme": "dark",
      "layout": "title",
      "components": [
        {
          "id": "uuid",
          "type": "heading",
          "props": { "level": 1, "text": "DIGITAL & BI INTRODUCTION" }
        }
      ]
    }
  ]
}
```

### Supported Component Types

| Type | Props | Description |
|------|-------|-------------|
| `heading` | `level` (1 or 2), `text`, `html` | Title or section heading |
| `text` | `text`, `html`, `className` | Paragraph or subtitle |
| `list` | `items` (string[]), `className` | Bulleted list |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Fonts look different | Install MB Corpo fonts in `C:/Windows/Fonts/` |
| Import doesn't read file content | Use Electron mode (browser mock has limited file access) |
| Electron binary won't download | Corporate proxy may block; use `ELECTRON_SKIP_BINARY_DOWNLOAD=1` and run in browser mode |
| Dev server won't start | Run `npm install` first, ensure Node.js v18+ is installed |
