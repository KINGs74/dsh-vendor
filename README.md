# DeepSeek Harness 插件离线包（公开镜像）

这个仓库**只放插件包本体**，方便任何一台机器直接下载。用途很单纯：**防止原作者删库/下架后装不回来**。不含配置、不含密钥、不含主机清单——那些不需要备份，装回去重新设一遍就行。

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

**第 1 步**　左侧栏「插件」→ 右上角「**添加插件**」。

**第 2 步**　在**「包名或地址」**框里填要装的东西：

| 你要装的是 | 框里填 | 例子 |
| --- | --- | --- |
| npm 上发布的插件 | **包名**（可带版本） | `dsh-windows-mcp@0.2.11` |
| 本页 Release 里的 tgz | **文件直链**（匿名可下） | `https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-20/dsh-ops-0.5.5.tgz` |
| 已下到本机的 tgz | **绝对路径** | `C:\Users\你\Downloads\dsh-ops-0.5.5.tgz` |
| 源码目录 | **目录绝对路径** | `C:\dsh-bundles\pwbrowser-bundle` |

**第 3 步**　「安装源」怎么选：

| 你的情况 | 选这个 | 为什么 |
| --- | --- | --- |
| 装**包名**，网络正常 | **npm 官方源**（默认） | 最全、最新 |
| 装**包名**，国内慢/超时 | **中国大陆镜像源** | npmmirror 同步，通常几 MB/s |
| 装 **tgz / 直链 / 本地目录** | **中国大陆镜像源**（或官方源，都行） | tgz 本体不经过源；但它的**依赖**要从源里拉 |
| 有公司内网私有 registry | **自定义地址** | 只在真填了内网源时用。⚠️ 别把 tgz 地址塞这里 |

> ⚠️ 两个最常见的错：
>
> 1. tgz 地址填进**「安装源」** → 那是 npm registry，pnpm 会拼出 `…/xxx.tgz/包名`，把 GitHub 的 404 HTML 当 JSON 解析，报 `ERR_PNPM_BROKEN_METADATA_JSON`。
> 2. 粘 Release **页面地址** `…/releases/tag/<tag>` 而不是**文件直链** `…/releases/download/<tag>/<文件名>`。

**第 4 步**　点「**安装**」，等状态变成已启用（快捷键：插件页立刻能看到新组件，一般不用重启）。

### 只装其中一个（命令行等价写法）

下面的 `install_bundle` 对应界面的第 2、3 步（`registry` 参数就是「安装源」）：

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

> 只想装**自建的浏览器插件**（`local-pwbrowser-browsers`）的话：它零依赖，单独装那一个 25 KB 的 tgz 就够，会带出 4 个组件（1 个「浏览器」开关 + Chrome/Edge/Brave 三个服务器），不需要快照、也不需要其他 12 个。装完再去每个浏览器装一次 Playwright 扩展、在插件页填 token。

## 维护者：插件新增/升级后，怎么补进这里的包

脚本零依赖，在 [`tools/`](tools/) 里。**只换参数，不用改代码。**

**情况一：某台机器上新装了一个插件，只想把那一个补进备份**（最常见）

```bash
node tools/pack-one.mjs                   # 先看这台机器装了哪些（带编号，不给参数就只列清单）
node tools/pack-one.mjs dsh-ops           # 打这一个 → 桌面\dsh-backup\dsh-ops-0.5.5.tgz
node tools/pack-one.mjs dsh-ops --upload  # 打完直接传进 Release（要 GH_TOKEN 或 tools/.ghtok）
```

不想配 token 就跳过 `--upload`，把生成的 tgz 拖到 Release 页面的 **“Attach binaries by dropping them here or selecting them”** 框里，效果一样。

包名记不清也能写一部分：`pack-one.mjs quote` 会自动匹配到 `dsh-quote-followup`；匹配不唯一时会让你写全名。

**情况二：插件升级了，整份刷新**

```bash
node tools/pack-vendor.mjs     # 按 profile 的 package.json 重新打包到 vendor/
node tools/upload-vendor.mjs   # 传进本仓库的 Release（同名跳过，可反复跑）
node tools/restore.mjs plan    # 检查 profile 缺哪个包
```

细节与坑（npm cache 报 EPERM、几十兆的大包回落 registry、`--ignore-scripts` 必须加）见 [`tools/README.md`](tools/README.md)。


## 说明

- 这些是第三方作者发布的原始 npm 产物，版权归各自作者，本仓库只做离线镜像，方便重装。
- **配置不在备份范围**：模型、主题、MCP、浏览器开关这些本机设置，换机器重新设一遍即可；本仓库只保证「插件包装得回来」。
