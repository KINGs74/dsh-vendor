# DeepSeek Harness 插件离线包（公开镜像）

备份 DSH desktop profile 已安装的插件包，用于换机重装。每个插件单独提供 TGZ。

[插件离线包 2026-11-27](https://github.com/KINGs74/dsh-vendor/releases/tag/plugins-2026-11-27) · [历史发布](https://github.com/KINGs74/dsh-vendor/releases)

## 插件清单（15 个）

| 插件包 | 版本 |
| --- | --- |
| billion-context-0.1.216.tgz | 0.1.216 |
| dsh-auto-memory-1.10.0.tgz | 1.10.0 |
| dsh-better-sidebar-0.32.1.tgz | 0.32.1 |
| dsh-codex-effort-slider-1.1.5.tgz | 1.1.5 |
| dsh-context-0.84.1.tgz | 0.84.1 |
| dsh-mcp-connector-0.2.109.tgz | 0.2.109 |
| dsh-ops-0.5.5.tgz | 0.5.5 |
| dsh-pet-0.4.1.tgz | 0.4.1 |
| dsh-prompt-rewriter-1.8.4.tgz | 1.8.4 |
| dsh-quote-followup-0.2.10.tgz | 0.2.10 |
| dsh-sidebar-fold-0.1.6.tgz | 0.1.6 |
| dsh-windows-mcp-0.2.11.tgz | 0.2.11 |
| dshmarket-1.73.19.tgz | 1.73.19 |
| linxin666-dsh-ssh-0.4.18.tgz | 0.4.18 |
| local-pwbrowser-browsers-1.3.1.tgz | 1.3.1 |

## 怎么用

### 最快：在 DSH 界面里点（不用敲命令）

**第 1 步**　左侧栏「插件」→ 右上角「**添加插件**」。

**第 2 步**　在**「包名或地址」**框里填要装的东西：

| 你要装的是 | 框里填 | 例子 |
| --- | --- | --- |
| npm 上发布的插件 | **包名**（可带版本） | `dsh-windows-mcp@0.2.11` |
| 本页 Release 里的 tgz | **文件直链**（匿名可下） | `https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-27/dsh-ops-0.5.5.tgz` |
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

历史整目录快照仍可从 [2026-11-21 备份](https://github.com/KINGs74/dsh-vendor/releases/tag/plugins-2026-11-21) 获取，对应当时的插件版本。

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

## 包来源

第三方插件版权归原作者。自建插件源码和正式版本分别维护在 [dsh-pet](https://github.com/KINGs74/dsh-pet) 和 [dsh-pwbrowser-browsers](https://github.com/KINGs74/dsh-pwbrowser-browsers)。本仓库提供可单独安装的副本和备份工具。
