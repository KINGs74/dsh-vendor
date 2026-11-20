#!/usr/bin/env node
// pack-vendor.mjs — 把本机 profile 里已安装的插件打包成离线副本，放进 vendor/。
//
//   node pack-vendor.mjs                     # 只补 vendor 里还没有的插件
//   node pack-vendor.mjs --force             # 全部重打
//   node pack-vendor.mjs --only dsh-ops      # 只打指定的（可重复 / 可逗号分隔）
//   node pack-vendor.mjs --list              # 只列清单，不下载
//
// 覆盖三类：插件市场装的第三方插件、`link:`/`file:` 指向本机源码目录的自建插件。
// 内置的 @deepseek-ai/* 随 DSH 本体，不备份。
//
// 做法：优先 `npm pack` 已安装目录（离线、无视 registry）；`npm pack` 崩了的
// （例如 dsh-ops 那种几十兆、上千文件的包，npm 会报 Exit handler never called）
// 回落到从 registry 直接下载它发布的 tarball。
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, isAbsolute, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, 'vendor')
const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? 'C:/Users/YD', '.dsh')
// DSH_PROFILE 是 DSH 自己的变量（值是 desktop），要换 profile 用 DSH_VENDOR_PROFILE
const PROFILE_NAME = process.env.DSH_VENDOR_PROFILE ?? process.env.DSH_SYNC_PROFILE ?? process.env.DSH_PROFILE ?? 'desktop'
const PROFILE = join(DSH_HOME, 'profiles', PROFILE_NAME)
// npm 默认缓存目录在沙箱外会 EPERM；固定用本地缓存
const NPM_CACHE = process.env.DSH_VENDOR_NPM_CACHE ?? process.env.DSH_SYNC_NPM_CACHE ?? join(HERE, '.npm-cache')

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const listOnly = argv.includes('--list')
const only = new Set()
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  const take = (value) => { for (const part of String(value ?? '').split(',')) if (part.trim() !== '') only.add(part.trim()) }
  if (arg === '--only' || arg === '-o') take(argv[i + 1]), (i += 1)
  else if (arg.startsWith('--only=')) take(arg.slice(7))
}

if (!existsSync(join(PROFILE, 'package.json'))) {
  console.log(`\n✖ 找不到 profile：${PROFILE}`)
  console.log('  用 DSH_VENDOR_PROFILE=<profile 名> 指定，或用 DSH_HOME=<.dsh 目录> 指定根目录\n')
  process.exit(1)
}

mkdirSync(VENDOR, { recursive: true })

const manifest = JSON.parse(readFileSync(join(PROFILE, 'package.json'), 'utf8'))
const dependencies = manifest.dependencies ?? {}
const bundles = new Set(manifest.dsh?.profile?.bundles ?? [])

const isLocal = spec => spec.startsWith('link:') || spec.startsWith('file:')

function localDir(spec) {
  const raw = spec.replace(/^(link|file):/, '')
  return isAbsolute(raw) ? raw : join(PROFILE, raw)
}

// { name, version, sourceDir }，version 对 link: 的包取自它自己的 package.json
const targets = []
for (const [name, raw] of Object.entries(dependencies)) {
  const spec = String(raw)
  if (name.startsWith('@deepseek-ai/')) continue
  if (only.size > 0 && !only.has(name)) continue
  if (isLocal(spec)) {
    const dir = localDir(spec)
    if (!existsSync(join(dir, 'package.json'))) {
      console.log(`  ! ${name}: 源码目录不存在（${dir}），跳过`)
      continue
    }
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version ?? '0.0.0'
    targets.push({ name, version, sourceDir: dir, local: true })
    continue
  }
  if (!bundles.has(name) && name.startsWith('@deepseek-ai/')) continue
  targets.push({ name, version: spec.replace(/^[\^~]/, ''), sourceDir: join(PROFILE, 'node_modules', name), local: false })
}

if (only.size > 0 && targets.length === 0) {
  console.log(`\n✖ 这台机器的 profile 里没有这些插件：${[...only].join(', ')}`)
  console.log(`  已安装：${Object.keys(dependencies).filter(n => !n.startsWith('@deepseek-ai/')).join(', ')}\n`)
  process.exit(1)
}

const vendorFileName = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`

// 找 npm 的 CLI 入口，用 node 直接跑（绕开 .cmd → cmd.exe，某些受限环境里 spawn 不了 cmd）
function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(candidate => typeof candidate === 'string' && candidate.endsWith('.js'))
  return candidates.find(candidate => existsSync(candidate))
}

const NPM_CLI = npmCli()

function packDirectory(sourceDir, file) {
  const args = ['pack', sourceDir, '--ignore-scripts', '--cache', NPM_CACHE, '--pack-destination', VENDOR]
  const attempts = []
  if (NPM_CLI !== undefined) attempts.push({ command: process.execPath, args: [NPM_CLI, ...args], shell: false })
  attempts.push({ command: 'npm', args, shell: process.platform === 'win32' })
  for (const attempt of attempts) {
    const result = spawnSync(attempt.command, attempt.args, { cwd: HERE, encoding: 'utf8', shell: attempt.shell })
    if (result.error === undefined && result.status === 0 && existsSync(join(VENDOR, file))) return true
  }
  return false
}

async function fetchTarball(url, file) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const download = await fetch(url)
      if (!download.ok) return false
      writeFileSync(join(VENDOR, file), Buffer.from(await download.arrayBuffer()))
      return true
    } catch { await new Promise(resolve => setTimeout(resolve, 1200)) }
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
      return await fetchTarball(tarball, file)
    } catch { await new Promise(resolve => setTimeout(resolve, 1200)) }
  }
  return false
}

console.log(`\npack-vendor  ${PROFILE}\n  → ${VENDOR}\n`)

if (listOnly) {
  for (const target of targets) console.log(`  · ${target.name}@${target.version}${target.local ? '（自建）' : ''}`)
  console.log(`\n  共 ${targets.length} 个\n`)
  process.exit(0)
}

let packed = 0
for (const target of targets) {
  const file = vendorFileName(target.name, target.version)
  if (!force && existsSync(join(VENDOR, file))) {
    console.log(`  = ${file}${target.local ? '（自建）' : ''}`)
    continue
  }
  let ok = false
  if (existsSync(target.sourceDir)) ok = packDirectory(target.sourceDir, file)
  if (!ok && !target.local) {
    console.log(`  · ${target.name}@${target.version}: npm pack 不可用，改从 registry 下载`)
    ok = await fromRegistry(target.name, target.version, file)
  }
  if (!ok && target.local) console.log(`  · ${target.name}: 本机跑不了 npm pack，请手动在该源码目录执行 npm pack --ignore-scripts`)
  console.log(`  ${ok ? '↓' : '✖'} ${file}${target.local ? '（自建）' : ''}`)
  if (ok) packed += 1
}

const wanted = new Set(targets.map(target => vendorFileName(target.name, target.version)))
for (const file of readdirSync(VENDOR)) {
  if (file.endsWith('.tgz') && !wanted.has(file)) console.log(`  - 过期副本（保留在本地，未删除） ${file}`)
}

console.log(`\n  新增 ${packed} 个，vendor 现有 ${readdirSync(VENDOR).filter(file => file.endsWith('.tgz')).length} 个 tarball`)
console.log('  上传：node upload-vendor.mjs\n')