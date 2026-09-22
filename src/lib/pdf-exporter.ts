import type { Deck } from '@/types/deck'
import { exportDeckToHtml } from './html-exporter'

export function exportDeckToPdf(deck: Deck): void {
  const html = exportDeckToHtml(deck)

  const pdfStyles = `
    <style>
      @media print {
        html, body { height: auto; overflow: visible; }
        .presentation { height: auto; overflow: visible; }
        .slide { position: relative !important; opacity: 1 !important; transform: none !important; width: 100vw; height: 100vh; page-break-after: always; display: flex !important; }
        .slide:last-child { page-break-after: auto; }
        .nav-controls, .progress-bar { display: none !important; }
      }
    </style>`

  const finalHtml = html.replace('</head>', pdfStyles + '\n</head>')

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(finalHtml)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}
