#!/usr/bin/env node
// pack-one.mjs — 只把「一个插件」打成 tgz，方便补进备份。
//
//   node tools/pack-one.mjs                       # 列出这台机器装了哪些插件（带编号）
//   node tools/pack-one.mjs dsh-ops               # 打这一个 → 桌面\dsh-backup\
//   node tools/pack-one.mjs dsh-ops dshmarket     # 打这几个
//   node tools/pack-one.mjs dsh-ops --out D:\bak  # 换输出目录
//   node tools/pack-one.mjs dsh-ops --upload      # 打完直接传到 Release（要 GH_TOKEN 或 tools/.ghtok）
//
// 零依赖，Node 18+。插件名写成 dsh-ops 或 @linxin666/dsh-ssh 都行；名字记不清就先不带参数跑一次。
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? homedir(), '.dsh')
const PROFILE_NAME = process.env.DSH_VENDOR_PROFILE ?? 'desktop'
const PROFILE = join(DSH_HOME, 'profiles', PROFILE_NAME)
const OWNER = process.env.DSH_VENDOR_OWNER ?? 'KINGs74'
const REPO = process.env.DSH_VENDOR_REPO ?? 'dsh-vendor'
const TAG = process.env.DSH_VENDOR_TAG ?? 'plugins-2026-11-21'

const argv = process.argv.slice(2)
const wanted = []
const askedVersion = new Map()
let outDir = join(process.env.USERPROFILE ?? homedir(), 'Desktop', 'dsh-backup')
let upload = false
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--out' || arg === '-o') outDir = argv[(i += 1)] ?? outDir
  else if (arg.startsWith('--out=')) outDir = arg.slice(6)
  else if (arg === '--upload' || arg === '-u') upload = true
  else if (arg === '--help' || arg === '-h') {
    const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
    console.log(lines.slice(1, lines.findIndex((line, index) => index > 0 && !line.startsWith('//'))).join('\n'))
    process.exit(0)
  }
  else for (const part of arg.split(',')) {
    const token = part.trim()
    if (token === '') continue
    // 允许「名字@版本」写法：版本只用来提示，实际打的是这台机器装着的那个版本
    const bare = token.replace(/@[^/@]*$/, '')
    const asked = token.slice(bare.length).replace(/^@/, '')
    if (asked !== '') askedVersion.set(bare, asked)
    wanted.push(bare)
  }
}

if (!existsSync(join(PROFILE, 'package.json'))) {
  console.error(`\n  ✖ 找不到 profile：${PROFILE}`)
  console.error('    用 DSH_VENDOR_PROFILE=<profile 名> 或 DSH_HOME=<.dsh 目录> 指定\n')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(PROFILE, 'package.json'), 'utf8'))
const installed = new Map()
for (const [name, raw] of Object.entries(manifest.dependencies ?? {})) {
  if (name.startsWith('@deepseek-ai/')) continue
  const spec = String(raw)
  if (spec.startsWith('link:') || spec.startsWith('file:')) {
    const rawPath = spec.replace(/^(link|file):/, '')
    const dir = isAbsolute(rawPath) ? rawPath : join(PROFILE, rawPath)
    let version = '0.0.0'
    try { version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version ?? '0.0.0' } catch { /* 源码目录没了 */ }
    installed.set(name, { version, dir, local: true })
  } else {
    installed.set(name, { version: spec.replace(/^[\^~]/, ''), dir: join(PROFILE, 'node_modules', name), local: false })
  }
}

const sorted = [...installed.entries()].sort((a, b) => a[0].localeCompare(b[0]))

if (wanted.length === 0) {
  console.log(`\n这台机器装了 ${sorted.length} 个插件（${PROFILE}）：\n`)
  sorted.forEach(([name, info], index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${name}@${info.version}${info.local ? '（自建，从源码目录打）' : ''}`)
  })
  console.log('\n打包：node tools/pack-one.mjs <插件名>')
  console.log('例如：node tools/pack-one.mjs dsh-ops\n')
  process.exit(0)
}

// 名字对不上时给出候选
const chosen = []
for (const query of wanted) {
  if (installed.has(query)) {
    const info = installed.get(query)
    const asked = askedVersion.get(query)
    if (asked !== undefined && asked !== info.version) {
      console.log(`  ! 你写的是 ${query}@${asked}，这台机器装的是 ${info.version} —— 按已装的 ${info.version} 打包`)
    }
    chosen.push([query, info]); continue
  }
  const hits = sorted.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
  if (hits.length === 0) {
    console.error(`\n  ✖ 这台机器没有「${query}」。已装的：${sorted.map(([name]) => name).join(', ')}\n`)
    process.exit(1)
  }
  if (hits.length > 1) {
    console.error(`\n  ✖「${query}」匹配到多个：${hits.map(([name]) => name).join(', ')} —— 请写全名\n`)
    process.exit(1)
  }
  chosen.push(hits[0])
}

mkdirSync(outDir, { recursive: true })

const tarballName = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`
const npmCache = join(HERE, '.npm-cache')

function npmCli() {
  return [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(candidate => typeof candidate === 'string' && candidate.endsWith('.js')).find(candidate => existsSync(candidate))
}

function packWithNpm(dir) {
  const args = ['pack', dir, '--ignore-scripts', '--cache', npmCache, '--pack-destination', outDir]
  const cli = npmCli()
  const attempts = []
  if (cli !== undefined) attempts.push([process.execPath, [cli, ...args], false])
  attempts.push(['npm', args, process.platform === 'win32'])
  for (const [command, commandArgs, shell] of attempts) {
    const result = spawnSync(command, commandArgs, { cwd: HERE, encoding: 'utf8', shell })
    if (result.error === undefined && result.status === 0) return true
  }
  return false
}

async function fromRegistry(name, version, file) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const meta = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`)
      if (!meta.ok) return false
      const tarball = (await meta.json()).dist?.tarball
      if (tarball === undefined) return false
      const download = await fetch(tarball)
      if (!download.ok) return false
      writeFileSync(join(outDir, file), Buffer.from(await download.arrayBuffer()))
      return true
    } catch { await new Promise(resolve => setTimeout(resolve, 1200)) }
  }
  return false
}

const files = []
for (const [name, info] of chosen) {
  const file = tarballName(name, info.version)
  const target = join(outDir, file)
  process.stdout.write(`  ${name}@${info.version} … `)
  let ok = existsSync(info.dir) && packWithNpm(info.dir)
  if (!ok && !info.local) ok = await fromRegistry(name, info.version, file)
  if (ok && existsSync(target)) {
    console.log(`✓ ${(statSync(target).size / 1048576).toFixed(2)}MB  ${target}`)
    files.push(target)
  } else {
    console.log(`✖ 打不出来${info.local ? '（这台机器不允许起子进程，请手动在该源码目录执行 npm pack --ignore-scripts）' : ''}`)
  }
}

if (files.length === 0) process.exit(1)
if (!upload) {
  console.log(`\n  下一步：把上面的 tgz 拖到 https://github.com/${OWNER}/${REPO}/releases/tag/${TAG} 的「Attach binaries」框里`)
  console.log('         或者配上 token 后跑：node tools/pack-one.mjs ' + chosen.map(([name]) => name).join(' ') + ' --upload\n')
  process.exit(0)
}

// ── 上传 ────────────────────────────────────────────────────────────────────
const token = (process.env.GH_TOKEN ?? (() => { try { return readFileSync(join(HERE, '.ghtok'), 'utf8') } catch { return '' } })()).trim()
if (token === '') {
  console.error('\n  ✖ 缺凭据：设 GH_TOKEN 环境变量，或把 token 写进 tools/.ghtok\n')
  process.exit(1)
}
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'dsh-vendor-pack-one',
}

let releaseId
const existing = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers })
if (existing.ok) releaseId = (await existing.json()).id
else {
  const created = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ tag_name: TAG, name: `插件离线包 ${TAG.replace('plugins-', '')}`, body: '插件包离线副本。' }),
  })
  const body = await created.json()
  if (!created.ok) { console.error(`  ✖ 建 Release 失败：${created.status} ${body.message}`); process.exit(1) }
  releaseId = body.id
}

const already = new Set()
const listing = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets`, { headers })
if (listing.ok) for (const asset of await listing.json()) already.add(asset.name)

for (const path of files) {
  const name = path.split(/[\\/]/).pop()
  if (already.has(name)) { console.log(`  = ${name}（已在 Release 里，跳过）`); continue }
  const response = await fetch(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/octet-stream' },
    body: readFileSync(path),
  })
  console.log(`  ${response.ok ? '↑' : '✖'} ${name}${response.ok ? '' : ' — ' + (await response.text()).slice(0, 160)}`)
}

console.log(`\n  https://github.com/${OWNER}/${REPO}/releases/tag/${TAG}\n`)