import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import https from 'https'
import { readdir, readFile, stat } from 'fs/promises'
import { HttpsProxyAgent } from 'https-proxy-agent'

interface LlmProxyOptions {
  /** Gateway base URL, e.g. https://host/oneapi/alibaba-bailian/apps/anthropic (a trailing /v1 is tolerated). */
  baseUrl: string
  /** Injected server-side only — the client never sees the key. */
  apiKey: string
  /** Agent for the corporate egress proxy (or a permissive agent for direct connections). */
  proxyAgent: https.Agent
}

function llmProxyPlugin(opts: LlmProxyOptions): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      let target: URL | null = null
      let apiPrefix = ''
      if (opts.baseUrl) {
        try {
          target = new URL(opts.baseUrl)
          const base = target.pathname.replace(/\/+$/, '')
          apiPrefix = base + (base.endsWith('/v1') ? '' : '/v1')
        } catch {
          console.error(`[llm-proxy] Invalid LLM_BASE_URL: "${opts.baseUrl}"`)
        }
      }
      if (!target || !opts.apiKey) {
        console.warn(
          '[llm-proxy] LLM_BASE_URL or LLM_API_KEY missing — /api/llm will return 503. ' +
            'Copy .env.example to .env.local and fill in the values.'
        )
      }

      server.middlewares.use('/api/llm', (req, res) => {
        if (!target || !opts.apiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: 'LLM proxy not configured: set LLM_BASE_URL / LLM_API_KEY in .env.local (see .env.example).',
            })
          )
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          // Client calls /api/llm/messages; the gateway serves the
          // Anthropic-style API under <base>/v1.
          const targetPath = apiPrefix + (req.url || '')

          const options: https.RequestOptions = {
            hostname: target.hostname,
            port: Number(target.port) || 443,
            path: targetPath,
            method: req.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': opts.apiKey,
              'anthropic-version': (req.headers['anthropic-version'] as string) || '2023-06-01',
              'Content-Length': body.length.toString(),
            },
            agent: opts.proxyAgent as unknown as https.Agent,
            // Full-deck generation with large max_tokens can take a while
            timeout: 120000,
          }

          const proxyReq = https.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
            proxyRes.pipe(res)
          })

          proxyReq.on('timeout', () => {
            proxyReq.destroy()
            res.writeHead(504, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Gateway timeout' }))
          })

          proxyReq.on('error', (err) => {
            console.error('LLM proxy error:', err.message, err.stack)
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: err.message || 'proxy connection failed' }))
            }
          })

          proxyReq.write(body)
          proxyReq.end()
        })
      })
    },
  }
}

const useElectron = process.env.ELECTRON === '1'

/**
 * Dev-server source for the template marketplace: serves .html files from a
 * local folder (MARKETPLACE_DIR, default <project>/marketplace-templates).
 * Dev-only by nature — configureServer never runs in a production build, so
 * the packaged app simply reports the folder source as unavailable.
 */
function templatesPlugin(marketplaceDir: string): Plugin {
  return {
    name: 'templates-marketplace',
    configureServer(server) {
      const root = path.resolve(marketplaceDir)

      server.middlewares.use('/api/templates', async (req, res) => {
        try {
          const url = (req.url || '/').split('?')[0]
          if (url === '/' || url === '') {
            await serveList(res)
          } else {
            await serveFile(url, res)
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      async function serveList(res: import('http').ServerResponse) {
        let entries: Awaited<ReturnType<typeof readdir>>
        try {
          entries = await readdir(root, { withFileTypes: true })
        } catch {
          // A missing folder is not an error — the marketplace invites the
          // user to create it instead of showing an error banner.
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          res.end('[]')
          return
        }
        const files: { file: string; mtime: number }[] = []
        for (const entry of entries) {
          if (!entry.isFile() || !/\.html?$/i.test(entry.name)) continue
          const s = await stat(path.join(root, entry.name))
          files.push({ file: entry.name, mtime: s.mtimeMs })
        }
        files.sort((a, b) => a.file.localeCompare(b.file))
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify(files))
      }

      async function serveFile(url: string, res: import('http').ServerResponse) {
        let name: string
        try {
          name = decodeURIComponent(url.replace(/^\//, ''))
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('bad request')
          return
        }
        // Path-traversal guard: only bare file names inside the folder.
        if (!name || /[\\/]/.test(name) || name.includes('..')) {
          res.writeHead(403, { 'Content-Type': 'text/plain' })
          res.end('forbidden')
          return
        }
        const filePath = path.resolve(root, name)
        if (!filePath.startsWith(root + path.sep)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' })
          res.end('forbidden')
          return
        }
        try {
          const html = await readFile(filePath, 'utf-8')
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(html)
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('not found')
        }
      }
    },
  }
}

export default defineConfig(async ({ mode }) => {
  // LLM gateway config lives in .env / .env.local (see .env.example) — the API
  // key must never be hardcoded. Empty prefix so LLM_* vars are loaded too.
  const env = loadEnv(mode, __dirname, '')

  const llmBaseUrl = env.LLM_BASE_URL || process.env.LLM_BASE_URL || ''
  const llmApiKey = env.LLM_API_KEY || process.env.LLM_API_KEY || ''
  const corpProxy =
    env.LLM_PROXY || process.env.LLM_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || ''

  const proxyAgent = corpProxy
    ? new HttpsProxyAgent(corpProxy)
    : new https.Agent({ rejectUnauthorized: false })

  const plugins = [
    react(),
    llmProxyPlugin({ baseUrl: llmBaseUrl, apiKey: llmApiKey, proxyAgent }),
    templatesPlugin(path.resolve(env.MARKETPLACE_DIR || path.join(__dirname, 'marketplace-templates'))),
  ]

  if (useElectron) {
    const electron = (await import('vite-plugin-electron')).default
    plugins.push(
      electron([
        {
          entry: 'electron/main.ts',
          vite: { build: { outDir: 'dist-electron' } },
        },
        {
          entry: 'electron/preload.ts',
          onstart(args: { reload: () => void }) { args.reload() },
          vite: { build: { outDir: 'dist-electron' } },
        },
      ])
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Dedicated port — 5173 is routinely taken by the Training & OD Toolkit
      // project, so DeckForge claims 5174 and fails loudly instead of hopping.
      port: 5174,
      strictPort: true,
    },
  }
})
