import mammoth from 'mammoth'
import JSZip from 'jszip'

export async function parseFileToMarkdown(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'docx':
    case 'doc':
      return parseDocx(file)
    case 'pptx':
      return parsePptx(file)
    case 'txt':
      return parseTxt(file)
    case 'md':
    case 'markdown':
      return parseTxt(file)
    default:
      return parseTxt(file)
  }
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlToMarkdown(result.value)
}

function htmlToMarkdown(html: string): string {
  let md = html
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
  md = md.replace(/<[^>]+>/g, '')
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  md = md.replace(/\n{3,}/g, '\n\n')
  return md.trim()
}

async function parsePptx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const slideFiles: string[] = []
  zip.forEach((path) => {
    if (path.match(/^ppt\/slides\/slide\d+\.xml$/)) {
      slideFiles.push(path)
    }
  })

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
    return numA - numB
  })

  const slides: string[] = []

  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath)?.async('string')
    if (!xml) continue

    const texts = extractTextsFromXml(xml)
    if (texts.length === 0) continue

    const slideNum = slidePath.match(/slide(\d+)/)?.[1] || '?'
    const title = texts[0]
    const body = texts.slice(1)

    let md = `### Slide ${slideNum}: ${title}`
    if (body.length > 0) {
      md += '\n' + body.map(t => `- ${t}`).join('\n')
    }
    slides.push(md)
  }

  const fileName = file.name.replace(/\.pptx$/i, '')
  return `# ${fileName}\n\n${slides.join('\n\n')}`
}

function extractTextsFromXml(xml: string): string[] {
  const texts: string[] = []
  const paragraphs = xml.split(/<a:p[ >]/)

  for (const para of paragraphs) {
    const runs = para.match(/<a:t>([^<]*)<\/a:t>/g)
    if (!runs) continue
    const line = runs.map(r => r.replace(/<\/?a:t>/g, '')).join('')
    const cleaned = line.trim()
    if (cleaned) texts.push(cleaned)
  }

  return texts
}

async function parseTxt(file: File): Promise<string> {
  return await file.text()
}
