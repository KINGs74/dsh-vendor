# DeepSeek Harness 插件离线包（公开镜像）

这个仓库**只放插件包本体**，方便任何一台机器直接下载——不含配置、不含密钥、不含主机清单。那些在私有仓库 [`dsh-profile`](https://github.com/KINGs74/dsh-profile) 里。

为什么要单独开公开仓库：私有仓库的 Release 资源下载链接需要登录 GitHub，换台机器第一件事就是登不上；这里的东西全是 npm 上公开的第三方产物，没有泄露面。

## 下载

- 网页：<https://github.com/KINGs74/dsh-vendor/releases/tag/plugins-2026-11-20>
- 直链（无需登录）：`https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-20/<文件名>`

## 里面有什么（13 个插件包）

| 文件 | 版本 | 作用 | 大小 |
| --- | --- | --- | --- |
| `dsh-ops-0.5.5.tgz` | 0.5.5 | 操作台：Bash/文件/PowerShell 工具与行配置 | 67.7 MB |
| `billion-context-0.1.216.tgz` | 0.1.216 | 上下文压缩（长会话不炸） | 11.0 MB |
| `dsh-better-sidebar-0.32.1.tgz` | 0.32.1 | 侧边栏增强 | 5.4 MB |
| `dsh-mcp-connector-0.2.109.tgz` | 0.2.109 | MCP 连接器市场 | 2.3 MB |
| `dshmarket-1.73.19.tgz` | 1.73.19 | 插件市场 | 0.86 MB |
| `linxin666-dsh-ssh-0.4.18.tgz` | 0.4.18 | SSH 主机与隧道 | 0.58 MB |
| `dsh-codex-effort-slider-1.1.5.tgz` | 1.1.5 | Codex 风格 effort 滑杆 | 0.53 MB |
| `dsh-context-0.84.1.tgz` | 0.84.1 | 上下文检索 | 0.39 MB |
| `dsh-sidebar-fold-0.1.6.tgz` | 0.1.6 | 侧边栏折叠 | 0.23 MB |
| `dsh-quote-followup-0.2.10.tgz` | 0.2.10 | 引用追问 | 0.12 MB |
| `dsh-auto-memory-1.7.0.tgz` | 1.7.0 | 自动记忆 | 0.10 MB |
| `dsh-windows-mcp-0.2.11.tgz` | 0.2.11 | Windows 桌面控制（MCP） | 0.10 MB |
| `local-pwbrowser-browsers-1.2.2.tgz` | 1.2.2 | 浏览器控制（自建：composer 开关 + 插件页 token） | 25 KB |

另外还有一个**整份 `node_modules` 快照** `node-modules-snapshot-2026-11-20.tgz`（134 MB，171 个包），给"全新机器一把恢复"用。

## 怎么用

### 最快：在 DSH 界面里点（不用敲命令）

**Plugins** 页 → 右上 **添加插件** → 在**「包名或地址」**框里粘贴下面任一种 → 安装：

| 粘贴什么 | 例子 |
| --- | --- |
| 本页 Release 的**文件直链**（匿名可下） | `https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-20/local-pwbrowser-browsers-1.2.2.tgz` |
| 已经下到本机的**绝对路径** | `C:\Users\你\Downloads\dsh-windows-mcp-0.2.11.tgz` |

「安装源」选**官方源**或**大陆镜像源**都行（只影响依赖从哪个 npm 源拉）。

⚠️ 两个最常见的坑：

1. **别把 tgz 地址填进「安装源」**——那是 npm registry，pnpm 会拼出 `…/xxx.tgz/包名` 这种地址，然后把 GitHub 的 404 HTML 页面当 JSON 解析，报 `ERR_PNPM_BROKEN_METADATA_JSON`（这正是这么踩出来的）。
2. 要贴 **文件直链** `…/releases/download/<tag>/<文件名>`，不是**页面地址** `…/releases/tag/<tag>`。

### 只装其中一个

命令行等价写法（合适写脚本/批量）：

```
plugin_manager action=install_bundle target=C:\\Users\\你\\Downloads\\dsh-windows-mcp-0.2.11.tgz
```

- **不用解压**，pnpm 会直接读 tgz 里的 `package.json`。
- 路径必须**绝对**（相对路径会被拒）。
- 这样装的依赖会记成 `file:C:/...` 绝对路径，换机 `pnpm install` 会失败。想保持可移植：先 `remove_bundle`，再 `install_bundle target=名字@版本`。
- 它的**传递依赖**（react、ssh2 之类）仍要从 registry 下；完全断网时改用快照。

### 全新机器整份恢复

把 `node-modules-snapshot-2026-11-20.tgz`（134 MB）下到本机，解到 profile：

```powershell
tar -xzf node-modules-snapshot-2026-11-20.tgz -C "$env:USERPROFILE\.dsh\profiles\desktop"
```

然后重开 DSH，13 个插件就都在了（约 43 秒解压）。这一步**不需要** registry、不需要 `pnpm install`——连传递依赖都在包里。

> 只想装**自建的浏览器插件**（`local-pwbrowser-browsers`）的话，它没有依赖，单独装那一个 25 KB 的 tgz 就够，不需要快照、也不需要装其他 12 个。

## 说明

- 这些是第三方作者发布的原始 npm 产物，版权归各自作者，本仓库只做离线镜像，方便重装。
- 需要**配置**（模型、主题、MCP、浏览器开关的会话状态）请去私有的 [`dsh-profile`](https://github.com/KINGs74/dsh-profile)——配置里可能有本机路径和内网信息，不适合公开。
