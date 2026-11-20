#!/usr/bin/env node
// restore.mjs — 把插件市场里装的插件装回 profile（本仓库自带 vendor/ 离线副本）。
//
//   node restore.mjs            # 只看：清单里哪些插件在本机缺失、vendor 里有没有备份
//   node restore.mjs install    # 真装：先 pnpm install；仍缺的用 vendor 里的 tarball 补
//   node restore.mjs install --dry-run
//
// vendor/*.tgz 是用 `npm pack` 从已安装目录原样打出来的发布包，所以即使某个
// 插件在插件市场里下架、或 registry 抽风，也能从本仓库把它装回来。
// 传递依赖（react、mermaid 之类）仍由 pnpm install 从 registry 解析；断网重建
// 请用 Release 里的 node_modules 快照。
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, 'vendor')
const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? 'C:/Users/YD', '.dsh')
const PROFILE = process.env.DSH_SYNC_PROFILE ?? join(DSH_HOME, 'profiles', process.env.DSH_PROFILE ?? 'desktop')

const argv = process.argv.slice(2)
const mode = argv.includes('install') ? 'install' : 'plan'
const dryRun = argv.includes('--dry-run')
const pnpm = process.env.DSH_PNPM ?? 'pnpm'

function vendorName(name) {
  // @scope/pkg → scope-pkg，与 npm pack 的输出命名一致
  return name.replace(/^@/, '').replace('/', '-')
}

function vendorTarball(name, version) {
  if (!existsSync(VENDOR)) return undefined
  const prefix = vendorName(name)
  return readdirSync(VENDOR).find(file => file === `${prefix}-${version}.tgz`)
    ?? readdirSync(VENDOR).find(file => file.startsWith(`${prefix}-`))
}

function readManifest() {
  // 本机有 profile 就用它（这是要装回去的目标）；没有就退回到仓库里那份清单。
  const candidates = [join(PROFILE, 'package.json'), join(HERE, 'package.json')]
  const path = candidates.find(candidate => existsSync(candidate))
  if (path === undefined) fail('no package.json found — run `node sync.mjs pull` first, or point DSH_SYNC_PROFILE at a profile')
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fail(message) {
  console.error(`\n  ✖ ${message}\n`)
  process.exit(1)
}

function installed(name) {
  return existsSync(join(PROFILE, 'node_modules', name, 'package.json'))
}

function run(command, args, cwd) {
  console.log(`  $ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  return result.status === 0
}

const manifest = readManifest()
const dependencies = manifest.dependencies ?? {}
const bundles = manifest.dsh?.profile?.bundles ?? []
// 内置的 @deepseek-ai/* 随 DSH 本体安装，不在备份范围；自建 link: 插件另有仓库。
const wanted = [...new Set([...bundles, ...Object.keys(dependencies)])]
  .filter(name => name !== '@local/pwbrowser-browsers')
  .filter(name => !name.startsWith('@deepseek-ai/'))

console.log(`\nrestore  ${PROFILE}\n`)
const rows = []
for (const name of wanted) {
  const version = String(dependencies[name] ?? '').replace(/^[\^~]/, '')
  const tarball = vendorTarball(name, version)
  rows.push({ name, version, tarball, present: installed(name) })
}
const missing = rows.filter(row => !row.present)
const missingNoVendor = missing.filter(row => row.tarball === undefined)

for (const row of rows.sort((a, b) => Number(a.present) - Number(b.present))) {
  const state = row.present ? '已装' : '缺失'
  const backup = row.tarball === undefined ? '（无离线副本）' : `vendor/${row.tarball}`
  console.log(`  ${state}  ${row.name.padEnd(26)}  ${row.version.padEnd(9)}  ${backup}`)
}

console.log(`\n  已装 ${rows.length - missing.length} / 共 ${rows.length}，缺失 ${missing.length}，其中 vendor 有备份 ${missing.filter(row => row.tarball !== undefined).length}`)
if (missingNoVendor.length > 0) {
  console.log(`  这些缺失且没有离线副本（内置插件或需要联网装）：${missingNoVendor.map(row => row.name).join(', ')}`)
}

if (mode === 'plan') {
  console.log('\n  下一步：node restore.mjs install\n')
  process.exit(0)
}
if (missing.length === 0) {
  console.log('\n  什么都不用装\n')
  process.exit(0)
}
if (dryRun) {
  console.log('\n  --dry-run：不执行任何安装\n')
  process.exit(0)
}

console.log('\n  1) 按 lock 从 registry 安装')
const installedOk = run(pnpm, ['install'], PROFILE)
if (!installedOk) console.log('  （pnpm install 失败，继续用 vendor 离线补齐）')

console.log('\n  2) 仍缺失的用 vendor 离线补齐')
for (const row of missing.filter(entry => entry.tarball !== undefined)) {
  if (installed(row.name)) {
    console.log(`  = ${row.name}`)
    continue
  }
  const target = join(PROFILE, 'node_modules', row.name)
  mkdirSync(target, { recursive: true })
  // npm tarball 的根是 package/，所以 strip 掉一层
  const ok = run('tar', ['-xzf', join(VENDOR, row.tarball), '--strip-components=1', '-C', target], HERE)
  console.log(`  ${ok ? '↓' : '✖'} ${row.name}`)
}

const stillMissing = wanted.filter(name => !installed(name))
console.log(`\n  完成，仍缺失 ${stillMissing.length} 个${stillMissing.length === 0 ? '' : '：' + stillMissing.join(', ')}`)
console.log('  重启 DSH 后到插件页确认这些插件都是「已启用」\n')
process.exit(stillMissing.length === 0 ? 0 : 1)