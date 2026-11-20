# 更新备份的工具（三个脚本，零依赖）

这个文件夹是给**维护者自己**用的：插件升级、新增、卸载之后，把 `dsh-vendor` 的 Release 重新打一遍。只想装插件的话用不到这里。

## 三个脚本

| 脚本 | 干什么 | 什么时候跑 |
| --- | --- | --- |
| `pack-vendor.mjs` | 读 profile 的 `package.json`，把每个已装插件 `npm pack` 到 `vendor/`（`link:` 自建包从源码目录打，registry 包直接下 tarball） | 插件有变化后 |
| `upload-vendor.mjs` | 把 `vendor/*.tgz` 传进本仓库的 Release（同名跳过） | `pack-vendor` 之后 |
| `restore.mjs` | 反过来：检查 profile 里缺哪个包、用 `vendor/*.tgz` 补装 | 换机器/装坏了 |

## 用法

需要 Node 18+（脚本只用 `fetch` 和 fs）。

```bash
# 0) 先看看这台机器都装了哪些（不下载，只列清单）
node tools/pack-vendor.mjs --list

# 1) 重新打包：默认补 vendor/ 里没有的；--force 全部重打
node tools/pack-vendor.mjs
node tools/pack-vendor.mjs --force
#    只打某几个（逗号分隔，可重复写 --only）
node tools/pack-vendor.mjs --only dsh-ops,dshmarket

# 2) 上传新包（token 放 tools/.ghtok，或设 GH_TOKEN 环境变量）
node tools/upload-vendor.mjs

# 3) 看看 profile 缺什么
node tools/restore.mjs plan
```

`pack-vendor` 会跳过内置的 `@deepseek-ai/*`（那些是 DSH 自带的，不用备份）。

## 在另一台机器上新装的插件，怎么补进备份

那台机器上装完新插件后，在它的 DSH profile 里就能看到新插件了，三步：

1. 把本仓库的 `tools/` 三个脚本拷到那台机器（或直接 `git clone` 整个仓库）
2. 在那台机器上跑 `node tools/pack-vendor.mjs --list` 确认能看到新插件，然后 `node tools/pack-vendor.mjs`
3. 配好 token（`GH_TOKEN` 或 `tools/.ghtok`），跑 `node tools/upload-vendor.mjs`

上传只**新增**缺的资产，同名会跳过，所以不会把已有备份搞乱。打完看一眼：
<https://github.com/KINGs74/dsh-vendor/releases>

**不想配 token 的替代做法**：只把那几个 tgz 存在本地，哪天要装回来时用「添加插件 → 本地绝对路径」。

```powershell
# 在 Windows PowerShell 里，把 <包名> 换成实际包名，例如 dsh-ops
cd "$env:USERPROFILE\.dsh\profiles\desktop\node_modules"
npm pack <包名> --ignore-scripts --pack-destination "$env:USERPROFILE\Desktop\dsh-vendor"
```

`--ignore-scripts` 必须加：不加会触发作者的 `prepack`（要 tsc/vite，没装就报错）。

## 凭据

`upload-vendor.mjs` 从两个地方取 token，二选一：

- 环境变量 `GH_TOKEN`（推荐，不落盘）
- 脚本旁边的 `.ghtok` 文件（已在 `.gitignore` 里，别提交）

token 需要一个能 `repo` 写入的 GitHub PAT。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_HOME` | `%USERPROFILE%\.dsh` | DSH 根目录 |
| `DSH_VENDOR_PROFILE` | `desktop` | profile 名（**别用 `DSH_PROFILE`**，那是 DSH 自己的变量，可能已被设成别的值） |
| `DSH_VENDOR_OWNER` | `KINGs74` | 仓库 owner |
| `DSH_VENDOR_REPO` | `dsh-vendor` | 仓库名 |
| `DSH_VENDOR_NPM_CACHE` | `tools/.npm-cache` | `npm pack` 的缓存目录（默认 npm 缓存常常没权限） |
| `DSH_VENDOR_TAG` | `plugins-2026-11-20` | Release 标签 |

## 出问题看这里

- `npm pack` 报 `EPERM`/`Exit handler never called`：换缓存目录（上面的 `DSH_VENDOR_NPM_CACHE`）；大包（`dsh-ops` 这种几十 MB、上千文件的）脚本会自动回落到 registry 直链下载 tarball。
- 提示 `本机跑不了 npm pack`：说明这个环境不允许起子进程（沙箱），手动在源码目录执行 `npm pack --ignore-scripts` 再把 tgz 放进 `vendor/`。
- 上传报 401/404：token 过期或没有 `repo` 写权限。
- `restore.mjs` 说缺包但 `vendor/` 里有：检查包名与文件名的对应关系（`vendorFileName()`，`@scope/name` → `scope-name-版本.tgz`）。