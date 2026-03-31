import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const assetsDir = path.join(rootDir, 'assets')
const docDir = path.join(rootDir, 'doc')
const brandingDir = path.join(assetsDir, 'branding')

const palette = {
  canvas: '#FBF7EF',
  canvasWarm: '#F6E7C8',
  sand: '#E9D1AE',
  ink: '#221F1A',
  muted: '#625B52',
  orange: '#F28C28',
  coral: '#F45D22',
  leaf: '#38A34A',
  leafDark: '#1E7A33',
  teal: '#2AA6B3',
  plum: '#5A3D73',
  cream: '#FFF9EF',
  white: '#FFFFFF',
  smoke: '#EDE6DA',
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeText(filePath, contents) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, contents, 'utf8')
}

function convertSvgToPng(svgPath, pngPath, width, height) {
  ensureDir(path.dirname(pngPath))
  run('sips', ['-z', String(height), String(width), '-s', 'format', 'png', svgPath, '--out', pngPath])
}

function convertPngToJpg(pngPath, jpgPath) {
  ensureDir(path.dirname(jpgPath))
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-q:v', '2', jpgPath])
}

function convertPngToIco(pngPath, icoPath) {
  ensureDir(path.dirname(icoPath))
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-vf', 'scale=256:256', icoPath])
}

function convertPngToIcns(pngPath, icnsPath) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-carrot-iconset-'))
  const iconsetDir = path.join(tempRoot, 'mr-carrots.iconset')
  ensureDir(iconsetDir)

  const sizes = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ]

  for (const [size, fileName] of sizes) {
    run('sips', ['-z', String(size), String(size), pngPath, '--out', path.join(iconsetDir, fileName)])
  }

  run('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath])
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

function svgShell({ width, height, defs = '', background = '', body }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
${defs}
  </defs>
${background}
${body}
</svg>
`
}

function carrotMark({ x, y, scale = 1, angle = -18, bodyFill = 'url(#carrotGradient)', leafFill = 'url(#leafGradient)', bodyShadow = 'url(#carrotShadow)' }) {
  return `
  <g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">
    <path d="M0 10 C72 58 95 184 58 300 C42 350 16 380 0 390 C-16 380 -42 350 -58 300 C-95 184 -72 58 0 10 Z" fill="${bodyShadow}" opacity="0.18" transform="translate(12 24)"/>
    <path d="M0 0 C72 48 96 176 58 292 C42 342 16 372 0 382 C-16 372 -42 342 -58 292 C-96 176 -72 48 0 0 Z" fill="${bodyFill}"/>
    <path d="M-18 -26 C-66 -70 -72 -132 -42 -162 C-2 -148 18 -112 18 -58 C-4 -42 -10 -34 -18 -26 Z" fill="${leafFill}"/>
    <path d="M18 -22 C-4 -84 8 -150 52 -172 C86 -140 82 -94 48 -40 C32 -28 28 -24 18 -22 Z" fill="${leafFill}"/>
    <path d="M2 -40 C-14 -98 12 -174 78 -206 C114 -154 94 -82 36 -30 C18 -28 10 -30 2 -40 Z" fill="${leafFill}"/>
  </g>`
}

function chip(x, y, text, fill, textColor = palette.ink) {
  const width = 42 + text.length * 10
  return `
  <g transform="translate(${x} ${y})">
    <rect width="${width}" height="42" rx="21" fill="${fill}"/>
    <text x="${width / 2}" y="27" fill="${textColor}" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle">${text}</text>
  </g>`
}

function panel(x, y, width, height, title, lines = [], accent = palette.orange) {
  const bodyLines = lines.map((line, index) => `
      <text x="28" y="${86 + index * 28}" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="20">${line}</text>`).join('')
  return `
  <g transform="translate(${x} ${y})">
    <rect width="${width}" height="${height}" rx="28" fill="${palette.white}"/>
    <rect x="0" y="0" width="${width}" height="14" rx="7" fill="${accent}" opacity="0.9"/>
    <text x="28" y="54" fill="${palette.ink}" font-family="Helvetica Neue, Arial, sans-serif" font-size="26" font-weight="700">${title}</text>
${bodyLines}
  </g>`
}

function statPill(x, y, label, value, accent = palette.teal) {
  return `
  <g transform="translate(${x} ${y})">
    <rect width="180" height="92" rx="26" fill="${palette.white}"/>
    <text x="24" y="36" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="18">${label}</text>
    <text x="24" y="70" fill="${accent}" font-family="Helvetica Neue, Arial, sans-serif" font-size="28" font-weight="800">${value}</text>
  </g>`
}

function buildIconSvg() {
  const defs = `
    <linearGradient id="bgGradient" x1="80" y1="70" x2="930" y2="950" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.cream}"/>
      <stop offset="1" stop-color="${palette.canvasWarm}"/>
    </linearGradient>
    <linearGradient id="carrotGradient" x1="-90" y1="40" x2="100" y2="360" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.orange}"/>
      <stop offset="1" stop-color="${palette.coral}"/>
    </linearGradient>
    <linearGradient id="leafGradient" x1="-90" y1="-180" x2="110" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.leaf}"/>
      <stop offset="1" stop-color="${palette.leafDark}"/>
    </linearGradient>
    <linearGradient id="sparkGradient" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.teal}"/>
      <stop offset="1" stop-color="${palette.plum}"/>
    </linearGradient>
    <radialGradient id="haloGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(760 780) rotate(135) scale(420 360)">
      <stop stop-color="${palette.orange}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${palette.orange}" stop-opacity="0"/>
    </radialGradient>
  `

  const background = `
  <rect width="1024" height="1024" rx="210" fill="url(#bgGradient)"/>
  <circle cx="760" cy="780" r="350" fill="url(#haloGradient)"/>
  <rect x="52" y="52" width="920" height="920" rx="180" stroke="${palette.sand}" stroke-width="4" opacity="0.45"/>
  <path d="M146 756 C 242 852 338 894 448 898" stroke="${palette.white}" stroke-width="18" stroke-linecap="round" opacity="0.35"/>
  <path d="M590 140 C 742 166 844 240 914 354" stroke="${palette.white}" stroke-width="14" stroke-linecap="round" opacity="0.2"/>
  `

  const body = `
${carrotMark({ x: 474, y: 404, scale: 1.42 })}
  <path d="M648 694 L724 606 L738 660 L792 672 L710 754 Z" fill="url(#sparkGradient)"/>
  <circle cx="720" cy="236" r="28" fill="${palette.teal}" opacity="0.25"/>
  <circle cx="760" cy="196" r="14" fill="${palette.teal}"/>
  <circle cx="806" cy="242" r="10" fill="${palette.plum}"/>
  `

  return svgShell({ width: 1024, height: 1024, defs, background, body })
}

function buildTraySvg(fill, includeBadge = false) {
  const badge = includeBadge
    ? `<circle cx="46" cy="18" r="8" fill="${fill}"/>`
    : ''
  return svgShell({
    width: 64,
    height: 64,
    body: `
  <g transform="translate(30 34) rotate(-18)">
    <path d="M0 -2 C18 9 24 39 14 67 C10 79 3 88 0 90 C-3 88 -10 79 -14 67 C-24 39 -18 9 0 -2 Z" fill="${fill}"/>
    <path d="M-6 -12 C-19 -24 -20 -40 -12 -48 C-1 -44 4 -34 4 -20 C-2 -16 -4 -14 -6 -12 Z" fill="${fill}"/>
    <path d="M6 -10 C0 -27 3 -42 15 -48 C24 -38 22 -24 14 -12 C10 -9 8 -9 6 -10 Z" fill="${fill}"/>
    <path d="M0 -16 C-5 -31 4 -50 22 -58 C31 -43 26 -24 10 -10 C4 -10 1 -11 0 -16 Z" fill="${fill}"/>
  </g>
  ${badge}`,
  })
}

function buildDmgBackgroundSvg() {
  const defs = `
    <linearGradient id="dmgBg" x1="40" y1="20" x2="620" y2="470" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.cream}"/>
      <stop offset="1" stop-color="${palette.canvasWarm}"/>
    </linearGradient>
    <radialGradient id="dmgGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 120) rotate(45) scale(200 170)">
      <stop stop-color="${palette.orange}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${palette.orange}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="carrotGradient" x1="-90" y1="40" x2="100" y2="360" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.orange}"/>
      <stop offset="1" stop-color="${palette.coral}"/>
    </linearGradient>
    <linearGradient id="leafGradient" x1="-90" y1="-180" x2="110" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.leaf}"/>
      <stop offset="1" stop-color="${palette.leafDark}"/>
    </linearGradient>
  `
  return svgShell({
    width: 658,
    height: 492,
    defs,
    background: `
  <rect width="658" height="492" rx="32" fill="url(#dmgBg)"/>
  <circle cx="140" cy="122" r="160" fill="url(#dmgGlow)"/>
  <rect x="18" y="18" width="622" height="456" rx="28" stroke="${palette.sand}" opacity="0.55"/>
  `,
    body: `
  <g opacity="0.18">
${carrotMark({ x: 150, y: 170, scale: 0.58, angle: -12 })}
  </g>
  <text x="54" y="104" fill="${palette.ink}" font-family="Helvetica Neue, Arial, sans-serif" font-size="50" font-weight="800">Mr. Carrot's</text>
  <text x="54" y="156" fill="${palette.ink}" font-family="Helvetica Neue, Arial, sans-serif" font-size="50" font-weight="800">AI Client</text>
  <text x="54" y="206" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="24">Universal MCP client for local and hosted AI workflows</text>
  <text x="54" y="286" fill="${palette.leafDark}" font-family="Helvetica Neue, Arial, sans-serif" font-size="28" font-weight="700">Drag into Applications to install</text>
  <path d="M282 344 H 392" stroke="${palette.leaf}" stroke-width="10" stroke-linecap="round"/>
  <path d="M364 316 L392 344 L364 372" stroke="${palette.leaf}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="54" y="420" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="18">Open source fork maintained by Erman Havuc</text>
  `,
  })
}

function buildDocCardSvg({ title, subtitle, chips, panels, stats, accent, fileLabel }) {
  const defs = `
    <linearGradient id="cardBg" x1="80" y1="20" x2="1540" y2="980" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.cream}"/>
      <stop offset="1" stop-color="${palette.canvas}"/>
    </linearGradient>
    <radialGradient id="accentGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1380 780) rotate(120) scale(420 320)">
      <stop stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="carrotGradient" x1="-90" y1="40" x2="100" y2="360" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.orange}"/>
      <stop offset="1" stop-color="${palette.coral}"/>
    </linearGradient>
    <linearGradient id="leafGradient" x1="-90" y1="-180" x2="110" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.leaf}"/>
      <stop offset="1" stop-color="${palette.leafDark}"/>
    </linearGradient>
  `

  const chipsSvg = chips.map((entry, index) => chip(82 + index * 160, 226, entry, `${accent}22`, accent)).join('')
  const panelsSvg = panels.map((entry) => panel(entry.x, entry.y, entry.width, entry.height, entry.title, entry.lines, entry.accent || accent)).join('')
  const statsSvg = stats.map((entry, index) => statPill(82 + index * 206, 840, entry.label, entry.value, entry.accent || accent)).join('')

  return svgShell({
    width: 1600,
    height: 1000,
    defs,
    background: `
  <rect width="1600" height="1000" rx="44" fill="url(#cardBg)"/>
  <rect x="28" y="28" width="1544" height="944" rx="36" stroke="${palette.sand}" opacity="0.55"/>
  <circle cx="1380" cy="780" r="340" fill="url(#accentGlow)"/>
  <path d="M88 930 C 420 814 698 790 1028 872" stroke="${palette.white}" stroke-width="20" opacity="0.42" stroke-linecap="round"/>
  `,
    body: `
  <g opacity="0.13">
${carrotMark({ x: 1220, y: 258, scale: 0.78, angle: -20 })}
  </g>
  <text x="82" y="118" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="700">Mr. Carrot's AI Client</text>
  <text x="82" y="176" fill="${palette.ink}" font-family="Helvetica Neue, Arial, sans-serif" font-size="64" font-weight="800">${title}</text>
  <text x="82" y="214" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="28">${subtitle}</text>
${chipsSvg}
${panelsSvg}
${statsSvg}
  <text x="1456" y="950" fill="${palette.muted}" font-family="Helvetica Neue, Arial, sans-serif" font-size="18" text-anchor="end">${fileLabel}</text>
  `,
  })
}

function generateDocCards() {
  return [
    {
      fileName: 'main1',
      title: 'Multi-provider chat',
      subtitle: 'One desktop workspace for hosted models, local models, and MCP tools.',
      chips: ['OpenAI', 'Anthropic', 'Ollama', 'MCP'],
      accent: palette.orange,
      panels: [
        { x: 82, y: 330, width: 360, height: 460, title: 'Conversation Rail', lines: ['Pinned chats', 'Searchable history', 'Workspace context'], accent: palette.coral },
        { x: 478, y: 330, width: 500, height: 460, title: 'Answer Canvas', lines: ['Markdown, code, tables', 'Artifacts and tool output', 'Long-form responses'], accent: palette.teal },
        { x: 1014, y: 330, width: 494, height: 460, title: 'Assistant Controls', lines: ['Engine and model switching', 'Prompt presets', 'Per-chat tool selection'], accent: palette.leaf },
      ],
      stats: [
        { label: 'Providers', value: '10+' },
        { label: 'Tool modes', value: 'MCP + HTTP' },
        { label: 'Flow', value: 'Chat-first' },
      ],
    },
    {
      fileName: 'main2',
      title: 'Knowledge and memory',
      subtitle: 'Ground chats in local documents, curated collections, and reusable prompts.',
      chips: ['RAG', 'Collections', 'Memory', 'Search'],
      accent: palette.teal,
      panels: [
        { x: 82, y: 330, width: 420, height: 460, title: 'Collections', lines: ['Attach docs and folders', 'Refresh on change', 'Scoped to each workspace'], accent: palette.teal },
        { x: 536, y: 330, width: 462, height: 460, title: 'Retrieval', lines: ['Fast local search', 'Chunk ranking', 'Model-ready context blocks'], accent: palette.orange },
        { x: 1032, y: 330, width: 476, height: 460, title: 'Reusable context', lines: ['Experts', 'Prompt templates', 'Saved defaults per workflow'], accent: palette.plum },
      ],
      stats: [
        { label: 'Knowledge mode', value: 'Attached' },
        { label: 'Search', value: 'Local-first' },
        { label: 'Reuse', value: 'Promptable' },
      ],
    },
    {
      fileName: 'studio',
      title: 'Design Studio',
      subtitle: 'Compose image and video prompts with presets, variants, and fast iteration loops.',
      chips: ['Images', 'Video', 'Variants', 'Prompting'],
      accent: palette.plum,
      panels: [
        { x: 82, y: 330, width: 384, height: 460, title: 'Prompt Builder', lines: ['Style prompts', 'Seed and aspect ratio', 'Provider-specific tuning'], accent: palette.plum },
        { x: 500, y: 330, width: 610, height: 460, title: 'Generation Board', lines: ['Preview grid', 'Version comparisons', 'Download and retry'], accent: palette.orange },
        { x: 1144, y: 330, width: 364, height: 460, title: 'Media Controls', lines: ['Image-to-image', 'Image-to-video', 'Output organization'], accent: palette.teal },
      ],
      stats: [
        { label: 'Studio mode', value: 'Visual' },
        { label: 'Outputs', value: 'Image + Video' },
        { label: 'Iteration', value: 'Fast' },
      ],
    },
    {
      fileName: 'settings',
      title: 'Engine control',
      subtitle: 'Tune providers, models, shortcuts, and local integrations from one settings surface.',
      chips: ['Providers', 'Shortcuts', 'Voice', 'Advanced'],
      accent: palette.leaf,
      panels: [
        { x: 82, y: 330, width: 376, height: 460, title: 'Provider Profiles', lines: ['Keys and endpoints', 'Model defaults', 'Per-engine setup'], accent: palette.leaf },
        { x: 492, y: 330, width: 516, height: 460, title: 'Productivity Controls', lines: ['Prompt Anywhere', 'AI commands', 'Realtime voice and dictation'], accent: palette.orange },
        { x: 1042, y: 330, width: 466, height: 460, title: 'Advanced Settings', lines: ['HTTP server', 'CLI install', 'Safe storage and workspaces'], accent: palette.teal },
      ],
      stats: [
        { label: 'Settings model', value: 'Unified' },
        { label: 'Shortcuts', value: 'System-wide' },
        { label: 'Control', value: 'Granular' },
      ],
    },
    {
      fileName: 'commands1',
      title: 'Prompt Anywhere',
      subtitle: 'Capture text from any app, ask for help, and paste polished results back instantly.',
      chips: ['Shortcut', 'Inline', 'Focused'],
      accent: palette.coral,
      panels: [
        { x: 82, y: 330, width: 454, height: 460, title: 'Capture', lines: ['Read selected text', 'Open a compact prompt panel', 'Stay in the current app'], accent: palette.coral },
        { x: 570, y: 330, width: 430, height: 460, title: 'Refine', lines: ['Rewrite', 'Summarize', 'Expand with context'], accent: palette.orange },
        { x: 1034, y: 330, width: 474, height: 460, title: 'Return', lines: ['Paste the result back', 'Keep your clipboard safe', 'Move quickly between tasks'], accent: palette.leaf },
      ],
      stats: [
        { label: 'Input', value: 'Selected text' },
        { label: 'Launch', value: 'One shortcut' },
        { label: 'Output', value: 'Instant paste' },
      ],
    },
    {
      fileName: 'commands2',
      title: 'AI Commands',
      subtitle: 'Ship repeatable desktop actions for rewriting, translating, summarizing, and more.',
      chips: ['Translate', 'Rewrite', 'Summarize', 'Custom'],
      accent: palette.orange,
      panels: [
        { x: 82, y: 330, width: 472, height: 460, title: 'Command Shelf', lines: ['Curated built-in commands', 'Custom command authoring', 'Shortcut-triggered selection'], accent: palette.orange },
        { x: 588, y: 330, width: 392, height: 460, title: 'Execution', lines: ['Runs against the active model', 'Applies to highlighted text', 'Returns clean output'], accent: palette.teal },
        { x: 1014, y: 330, width: 494, height: 460, title: 'Automation Ready', lines: ['Designed for repeated workflows', 'Works with experts and defaults', 'Scales beyond one-off prompts'], accent: palette.plum },
      ],
      stats: [
        { label: 'Commands', value: 'Reusable' },
        { label: 'Launch', value: 'Popup menu' },
        { label: 'Scope', value: 'Desktop-wide' },
      ],
    },
    {
      fileName: 'commands3',
      title: 'Desktop automation',
      subtitle: 'Combine commands, voice, HTTP triggers, and MCP integrations into one workflow surface.',
      chips: ['HTTP', 'Voice', 'MCP', 'CLI'],
      accent: palette.teal,
      panels: [
        { x: 82, y: 330, width: 410, height: 460, title: 'Triggers', lines: ['HTTP endpoints', 'CLI access', 'System shortcuts'], accent: palette.teal },
        { x: 526, y: 330, width: 468, height: 460, title: 'Execution Path', lines: ['Model call', 'Tool execution', 'Artifact and result delivery'], accent: palette.coral },
        { x: 1028, y: 330, width: 480, height: 460, title: 'Integration Surface', lines: ['MCP servers', 'Prompt Anywhere', 'Realtime and dictation'], accent: palette.leaf },
      ],
      stats: [
        { label: 'Automation', value: 'Composable' },
        { label: 'Surfaces', value: 'Voice + HTTP' },
        { label: 'Tools', value: 'MCP-native' },
      ],
    },
  ]
}

function generateAssets() {
  ensureDir(brandingDir)
  ensureDir(docDir)

  const iconSvgPath = path.join(brandingDir, 'icon-master.svg')
  const iconPngPath = path.join(assetsDir, 'icon.png')
  writeText(iconSvgPath, buildIconSvg())
  convertSvgToPng(iconSvgPath, iconPngPath, 1024, 1024)
  convertPngToIco(iconPngPath, path.join(assetsDir, 'icon.ico'))
  convertPngToIcns(iconPngPath, path.join(assetsDir, 'icon.icns'))

  const dmgSvgPath = path.join(brandingDir, 'dmg-background.svg')
  writeText(dmgSvgPath, buildDmgBackgroundSvg())
  convertSvgToPng(dmgSvgPath, path.join(assetsDir, 'dmg_background.png'), 658, 492)

  const trayTemplateSvg = path.join(brandingDir, 'tray-template.svg')
  const trayWhiteSvg = path.join(brandingDir, 'tray-white.svg')
  const trayTemplateUpdateSvg = path.join(brandingDir, 'tray-template-update.svg')
  const trayWhiteUpdateSvg = path.join(brandingDir, 'tray-white-update.svg')
  writeText(trayTemplateSvg, buildTraySvg('#111111', false))
  writeText(trayWhiteSvg, buildTraySvg('#FFFFFF', false))
  writeText(trayTemplateUpdateSvg, buildTraySvg('#111111', true))
  writeText(trayWhiteUpdateSvg, buildTraySvg('#FFFFFF', true))

  convertSvgToPng(trayTemplateSvg, path.join(assetsDir, 'trayTemplate.png'), 22, 22)
  convertSvgToPng(trayTemplateSvg, path.join(assetsDir, 'trayTemplate@2x.png'), 44, 44)
  convertSvgToPng(trayWhiteSvg, path.join(assetsDir, 'trayWhite.png'), 22, 22)
  convertSvgToPng(trayWhiteSvg, path.join(assetsDir, 'trayWhite@2x.png'), 44, 44)
  convertSvgToPng(trayTemplateUpdateSvg, path.join(assetsDir, 'trayUpdateTemplate.png'), 22, 22)
  convertSvgToPng(trayTemplateUpdateSvg, path.join(assetsDir, 'trayUpdateTemplate@2x.png'), 44, 44)
  convertSvgToPng(trayWhiteUpdateSvg, path.join(assetsDir, 'trayUpdateWhite.png'), 22, 22)
  convertSvgToPng(trayWhiteUpdateSvg, path.join(assetsDir, 'trayUpdateWhite@2x.png'), 44, 44)

  for (const card of generateDocCards()) {
    const svgPath = path.join(brandingDir, `${card.fileName}.svg`)
    const pngPath = path.join(brandingDir, `${card.fileName}.png`)
    const jpgPath = path.join(docDir, `${card.fileName}.jpg`)
    writeText(svgPath, buildDocCardSvg({ ...card, fileLabel: `${card.fileName}.jpg` }))
    convertSvgToPng(svgPath, pngPath, 1600, 1000)
    convertPngToJpg(pngPath, jpgPath)
  }

  console.log('Brand assets generated successfully.')
}

generateAssets()