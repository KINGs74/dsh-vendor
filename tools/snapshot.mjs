#!/usr/bin/env node
// 把本机 DSH profile 的 node_modules 打成一个可移植的 tgz。
//
//   node tools/snapshot.mjs                      打包到 桌面\dsh-backup\node-modules-snapshot-<日期>.tgz
//   node tools/snapshot.mjs --out D:\tmp\x.tgz   指定输出路径
//   node tools/snapshot.mjs --upload             打包后上传到 Release（需要 GH_TOKEN 或 .ghtok）
//
// 环境变量：DSH_HOME（默认 %USERPROFILE%\.dsh）、DSH_VENDOR_PROFILE（默认 desktop）、
//           DSH_VENDOR_TAG（默认 plugins-2026-11-21）、DSH_VENDOR_REPO（默认 dsh-vendor）
//
// 这不是 pack-vendor.mjs：pack-vendor 是「一包一个 tgz」，这里是「整棵 node_modules 一个 tgz」。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? homedir(), '.dsh')
const PROFILE_NAME = process.env.DSH_VENDOR_PROFILE ?? 'desktop'
const PROFILE = join(DSH_HOME, 'profiles', PROFILE_NAME)
const OWNER = process.env.DSH_VENDOR_OWNER ?? 'KINGs74'
const REPO = process.env.DSH_VENDOR_REPO ?? 'dsh-vendor'
const TAG = process.env.DSH_VENDOR_TAG ?? 'plugins-2026-11-21'

const argv = process.argv.slice(2)
let out
let upload = false
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--out' || arg === '-o') out = argv[(i += 1)]
  else if (arg.startsWith('--out=')) out = arg.slice(6)
  else if (arg === '--upload' || arg === '-u') upload = true
  else if (arg === '--help' || arg === '-h') {
    const lines = readFileSync(new URL(import.meta.url), 'utf8').split('\n')
    const head = []
    for (const line of lines) {
      if (line.startsWith('//')) head.push(line.slice(3))
      else if (head.length > 0) break
    }
    console.log(head.join('\n'))
    process.exit(0)
  } else {
    console.error(`\n  ✖ 不认识的参数：${arg}（用 --help 看用法）\n`)
    process.exit(1)
  }
}

const stamp = new Date().toISOString().slice(0, 10)
const target = out ?? join(process.env.USERPROFILE ?? homedir(), 'Desktop', 'dsh-backup', `node-modules-snapshot-${stamp}.tgz`)

if (!existsSync(join(PROFILE, 'node_modules'))) {
  console.error(`\n  ✖ 找不到 ${PROFILE}\\node_modules`)
  console.error('    用 DSH_VENDOR_PROFILE=<profile 名> 或 DSH_HOME=<.dsh 目录> 指定\n')
  process.exit(1)
}

mkdirSync(dirname(target), { recursive: true })

const started = Date.now()
console.log(`\n  正在打包 ${PROFILE}\\node_modules → ${target}`)
console.log('  （约 500 MB / 2 万个文件，慢的话几分钟，别关窗口）\n')

const tar = spawnSync('tar', ['-czf', target, '-C', PROFILE, 'node_modules'], { encoding: 'utf8' })
if (tar.error !== undefined) {
  const code = tar.error.code === 'EPERM'
    ? '被当前环境拦住了（沙箱/权限策略不允许脚本起子进程）'
    : tar.error.message
  console.error(`  ✖ 调不起 tar：${code}`)
  console.error('\n    在 PowerShell 里手动跑同样的命令即可：\n')
  console.error(`      tar -czf "${target}" -C "${PROFILE}" node_modules\n`)
  process.exit(1)
}
if (tar.status !== 0) {
  console.error(`  ✖ tar 退出码 ${tar.status}\n${tar.stderr ?? ''}\n`)
  process.exit(1)
}

const seconds = ((Date.now() - started) / 1000).toFixed(1)
const size = statSync(target).size
const megabyte = size / 1024 / 1024

const hash = createHash('sha256')
await new Promise((resolve, reject) => {
  createReadStream(target).on('data', chunk => hash.update(chunk)).on('end', resolve).on('error', reject)
})

console.log(`✓ ${megabyte.toFixed(1)} MB  ${target}`)
console.log(`  用时 ${seconds}s  sha256 ${hash.digest('hex').slice(0, 16)}…`)
console.log('\n  另一台机器恢复：')
console.log(`    tar -xzf "${target.split('\\').pop()}" -C "$env:USERPROFILE\\.dsh\\profiles\\desktop"`)
console.log('    （打包时路径写的是相对的，所以换机解包即可用；解包后再开 DSH）')

if (!upload) {
  console.log(`\n  上传：把上面的 tgz 拖到 https://github.com/${OWNER}/${REPO}/releases 的「Attach binaries」框`)
  console.log('        或者配上 token 后重跑一次并加 --upload\n')
  process.exit(0)
}

// ---- 上传 ----
let token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
if (token === undefined) {
  for (const candidate of [join(process.cwd(), '.ghtok'), join(dirname(process.argv[1] ?? ''), '.ghtok'), join(dirname(process.argv[1] ?? ''), '..', '.ghtok')]) {
    if (existsSync(candidate)) { token = readFileSync(candidate, 'utf8').trim(); break }
  }
}
if (token === undefined || token === '') {
  console.error('\n  ✖ missing credential: set GH_TOKEN or put the token in .ghtok next to this script\n')
  process.exit(1)
}

const H = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'dsh-vendor-tools',
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } })
  if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${await res.text()}`)
  return { status: res.status, body: res.status === 204 ? undefined : await res.json() }
}

const release = await gh(`/repos/${OWNER}/${REPO}/releases/tags/${TAG}`)
if (release.status === 404) {
  console.error(`\n  ✖ 仓库里没有 tag ${TAG} 的 Release，先在网页上建一个（或用 DSH_VENDOR_TAG 指定已有的）\n`)
  process.exit(1)
}

const releaseId = release.body.id
const name = target.split('\\').pop()
const existing = (release.body.assets ?? []).find(asset => asset.name === name)
if (existing !== undefined) {
  console.log(`\n  · Release 里已经有 ${name}（${(existing.size / 1024 / 1024).toFixed(1)} MB），跳过上传\n`)
  process.exit(0)
}

console.log(`\n  上传 ${name}（${megabyte.toFixed(1)} MB）到 release #${releaseId} …`)
const body = await new Promise((resolve, reject) => {
  const chunks = []
  createReadStream(target).on('data', chunk => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject)
})
const uploaded = await fetch(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
  method: 'POST',
  headers: { ...H, 'content-type': 'application/gzip', 'content-length': String(size) },
  body,
})
console.log(uploaded.status === 201 ? `✓ 上传完成：${(await uploaded.json()).browser_download_url}` : `✖ 上传失败 ${uploaded.status} ${(await uploaded.text()).slice(0, 300)}`)
process.exit(uploaded.status === 201 ? 0 : 1)