# 维护备份的工具（五个脚本，零依赖）

给**维护者自己**用的：插件新增、升级、卸载之后，把 `dsh-vendor` 的 Release 补上。只想装插件的话用不到这里。

## 五个脚本

| 脚本 | 干什么 | 什么时候跑 |
| --- | --- | --- |
| `pack-one.mjs` | **只打指定的插件** → `桌面\dsh-backup\名字-版本.tgz`；加 `--upload` 直接传 Release | 某台机器新装了一个插件 |
| `pack-vendor.mjs` | 读 profile 的 `package.json`，把**每个**已装插件打包到 `tools/vendor/` | 批量/整份刷新 |
| `upload-vendor.mjs` | 把 `tools/vendor/*.tgz` 传进 Release（同名跳过） | `pack-vendor` 之后 |
| `restore.mjs` | 反过来：检查 profile 缺哪个包、用 `vendor/*.tgz` 补装 | 换机器/装坏了 |
| `snapshot.mjs` | 把整个 `node_modules` 打成一个 tgz（134 MB 左右），加 `--upload` 直接传 Release | 想整份照搬、或怕作者删包 |

## 最常用：只备份一个新装的插件

需要 Node 18+（脚本只用 `fetch` 和 fs）。在**装了那个插件的机器**上：

```bash
# 1) 先看这台机器装了哪些（不给参数 = 只列清单，带编号）
node tools/pack-one.mjs

# 2) 打那一个（名字可以只写一部分，会自动匹配）
node tools/pack-one.mjs dsh-ops
#    → 桌面\dsh-backup\dsh-ops-0.5.5.tgz

# 3) 传上去：要么加 --upload（要 token），要么手动把 tgz 拖到 Release 页面
node tools/pack-one.mjs dsh-ops --upload
```

- 输出目录换成别的：`--out D:\bak`
- 一次打多个：`node tools/pack-one.mjs dsh-ops dshmarket`
- 名字对不上时，脚本会把这台机器已装的包名全列出来
- 不配 token 也能用：跳过 `--upload`，把 tgz 拖到 <https://github.com/KINGs74/dsh-vendor/releases/tag/plugins-2026-11-20> 的 “Attach binaries by dropping them here or selecting them” 框里

## 整份刷新（批量）

```bash
node tools/pack-vendor.mjs --list    # 只列清单
node tools/pack-vendor.mjs           # 补 vendor/ 里没有的；--force 全部重打
node tools/pack-vendor.mjs --only dsh-ops,dshmarket   # 只打这几个
node tools/upload-vendor.mjs         # 传进 Release（同名跳过，可反复跑）
node tools/restore.mjs plan          # 看 profile 缺什么
```

`pack-vendor` / `pack-one` 都会跳过内置的 `@deepseek-ai/*`（那些是 DSH 自带的，不用备份）。

## 整棵 node_modules 快照（`snapshot.mjs`）

前面四个脚本都是「一包一个 tgz」；**快照**是另一种兜底：把整个 `node_modules` 打成一个 tgz，
换机器时解包就得到一模一样的插件集合（不用跑 `pnpm install`，也不怕哪个作者删了包）。

```powershell
# 打包到 桌面\dsh-backup\node-modules-snapshot-<今天日期>.tgz
node tools/snapshot.mjs

# 指定路径
node tools/snapshot.mjs --out D:\\bak\\nm.tgz

# 打完直接传 Release（要 token；tag 用 DSH_VENDOR_TAG，默认 plugins-2026-11-20）
node tools/snapshot.mjs --upload
```

另一台机器恢复：

```powershell
tar -xzf node-modules-snapshot-2026-11-21.tgz -C "$env:USERPROFILE\.dsh\profiles\desktop"
```

- 体积参考：本机 `node_modules` 约 500 MB、2 万个文件 → 压缩后 134 MB，压缩 2～4 分钟。
- 打包时写的是**相对路径**（`node_modules/...`），所以换机器解包即可，不需要改路径。
- 快照不替代 tgz：tgz 是「按包挑着装」，快照是「整份照搬」，体量大、每次都 134 MB，按需更新即可。
- 注意：`node_modules` 里若有已卸载插件的残留目录，也会被一起打进去（解包后 `restore.mjs plan` 能看出来）。

## 凭据

上传要一个能写 `repo` 的 GitHub PAT，二选一：

- 环境变量 `GH_TOKEN`（推荐，不落盘）
- 脚本旁边的 `.ghtok` 文件（已在 `.gitignore` 里，别提交）

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_HOME` | `%USERPROFILE%\.dsh` | DSH 根目录 |
| `DSH_VENDOR_PROFILE` | `desktop` | profile 名（**别用 `DSH_PROFILE`**，那是 DSH 自己的变量） |
| `DSH_VENDOR_OWNER` | `KINGs74` | 仓库 owner |
| `DSH_VENDOR_REPO` | `dsh-vendor` | 仓库名 |
| `DSH_VENDOR_NPM_CACHE` | `tools/.npm-cache` | `npm pack` 的缓存目录（默认 npm 缓存常常没权限） |
| `DSH_VENDOR_TAG` | `plugins-2026-11-20` | Release 标签 |

## 出问题看这里

- **`npm pack` 报 `EPERM` / `Exit handler never called`**：换缓存目录（`DSH_VENDOR_NPM_CACHE`）；几十兆的大包（`dsh-ops`）脚本会自动回落到 registry 直链下 tarball。
- **提示「这台机器不允许起子进程」**：说明运行环境是沙箱，手动在该插件目录执行 `npm pack --ignore-scripts`，再把 tgz 放进输出目录/`vendor/`。
- **不打 `--ignore-scripts` 会怎样**：npm 会跑作者写的 `prepack`（要 tsc/vite），多数机器上直接报错。脚本里已经固定带上这个参数。
- **上传报 401/404**：token 过期或没有 `repo` 写权限。
- **`restore.mjs` 说缺包但 `vendor/` 里有**：检查文件名对应关系（`@scope/name` → `scope-name-版本.tgz`）。
- **`link:` 自建插件**：从源码目录打，版本取那个目录的 `package.json`，所以改动源码后重跑一次就能拿到最新包（记得先改版本号，否则同名会被跳过）。