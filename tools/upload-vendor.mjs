#!/usr/bin/env node
// upload-vendor.mjs — 把 vendor/*.tgz 作为 GitHub Release 资产上传（不塞进 git 仓库，避免仓库膨胀）。
//
//   node upload-vendor.mjs                 # 上传到标签 plugins-<今天>
//   node upload-vendor.mjs plugins-2026-11-20
//
// 已存在的同名资产会跳过，所以可以反复跑。
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, 'vendor')
const TOKEN = (process.env.GH_TOKEN ?? (() => {
  try { return readFileSync(join(HERE, '.ghtok'), 'utf8') } catch { return '' }
})()).trim()
const OWNER = process.env.DSH_VENDOR_OWNER ?? 'KINGs74'
const REPO = process.env.DSH_VENDOR_REPO ?? 'dsh-vendor'
const TAG = process.argv[2] ?? `plugins-${new Date().toISOString().slice(0, 10)}`

if (TOKEN === '') {
  console.error('\n  ✖ missing credential: set GH_TOKEN or put the token in .ghtok next to this script\n')
  process.exit(1)
}

const headers = {
  authorization: `Bearer ${TOKEN}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'dsh-vendor-upload',
}

let releaseId
const existing = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers })
if (existing.ok) {
  releaseId = (await existing.json()).id
  console.log(`reuse release ${TAG} (${releaseId})`)
} else {
  const created = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      tag_name: TAG,
      name: `插件离线包 ${TAG.replace('plugins-', '')}`,
      body: '插件市场里已安装插件的离线副本（npm pack 原样打包），断网或插件下架时用来恢复。恢复方法见仓库 README。',
    }),
  })
  const body = await created.json()
  if (!created.ok) {
    console.error(`create release failed: ${created.status} ${body.message}`)
    process.exit(1)
  }
  releaseId = body.id
  console.log(`created release ${TAG} (${releaseId})`)
}

const uploaded = new Set()
const listing = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets`, { headers })
if (listing.ok) for (const asset of await listing.json()) uploaded.add(asset.name)

for (const name of readdirSync(VENDOR).filter(file => file.endsWith('.tgz')).sort()) {
  if (uploaded.has(name)) {
    console.log(`  = ${name}`)
    continue
  }
  const bytes = readFileSync(join(VENDOR, name))
  const response = await fetch(`https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/octet-stream' },
    body: bytes,
  })
  console.log(`  ${response.ok ? '↑' : '✖'} ${name}  ${(bytes.length / 1048576).toFixed(1)}MB${response.ok ? '' : ' — ' + (await response.text()).slice(0, 160)}`)
}

console.log(`\n  https://github.com/${OWNER}/${REPO}/releases/tag/${TAG}\n`)