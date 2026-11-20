#!/usr/bin/env node
// pack-vendor.mjs — 把 profile 里已安装的插件打包成离线副本，放进 vendor/。
//
//   node pack-vendor.mjs            # 只补 vendor 里还没有的插件
//   node pack-vendor.mjs --force    # 全部重打
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
const PROFILE = process.env.DSH_SYNC_PROFILE ?? join(DSH_HOME, 'profiles', process.env.DSH_PROFILE ?? 'desktop')
const force = process.argv.includes('--force')
// npm 默认缓存目录在沙箱外，会 EPERM；固定用本地缓存
const NPM_CACHE = process.env.DSH_SYNC_NPM_CACHE ?? join(HERE, '.npm-cache')

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

const vendorFileName = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`

async function fromRegistry(name, version, file) {
  const meta = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`)
  if (!meta.ok) return false
  const tarball = (await meta.json()).dist?.tarball
  if (tarball === undefined) return false
  const download = await fetch(tarball)
  if (!download.ok) return false
  writeFileSync(join(VENDOR, file), Buffer.from(await download.arrayBuffer()))
  return true
}

console.log(`\npack-vendor  ${PROFILE}\n  → ${VENDOR}\n`)
let packed = 0
for (const target of targets) {
  const file = vendorFileName(target.name, target.version)
  if (!force && existsSync(join(VENDOR, file))) {
    console.log(`  = ${file}${target.local ? '（自建）' : ''}`)
    continue
  }
  let ok = false
  if (existsSync(target.sourceDir)) {
    const result = spawnSync('npm', ['pack', target.sourceDir, '--ignore-scripts', '--cache', NPM_CACHE, '--pack-destination', VENDOR], {
      cwd: HERE,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    ok = result.status === 0 && existsSync(join(VENDOR, file))
  }
  if (!ok && !target.local) {
    console.log(`  · ${target.name}@${target.version}: npm pack 不可用，改从 registry 下载`)
    ok = await fromRegistry(target.name, target.version, file)
  }
  console.log(`  ${ok ? '↓' : '✖'} ${file}${target.local ? '（自建）' : ''}`)
  if (ok) packed += 1
}

const wanted = new Set(targets.map(target => vendorFileName(target.name, target.version)))
for (const file of readdirSync(VENDOR)) {
  if (file.endsWith('.tgz') && !wanted.has(file)) console.log(`  - 过期副本（保留在本地，未删除） ${file}`)
}

console.log(`\n  新增 ${packed} 个，vendor 现有 ${readdirSync(VENDOR).filter(file => file.endsWith('.tgz')).length} 个 tarball`)
console.log('  上传：node upload-vendor.mjs\n')