# 更新备份的工具（三个脚本，零依赖）

这个文件夹是给**维护者自己**用的：插件升级、新增、卸载之后，把 `dsh-vendor` 的 Release 重新打一遍。普通用户用不到。

## 三个脚本

| 脚本 | 干什么 | 什么时候跑 |
| --- | --- | --- |
| `pack-vendor.mjs` | 读 profile 的 `package.json`，把每个已装插件 `npm pack` 到 `vendor/`（`link:` 自建包从源码目录打，registry 包直接下 tarball） | 插件有变化后 |
| `upload-vendor.mjs` | 把 `vendor/*.tgz` 传进本仓库的 Release（同名跳过） | `pack-vendor` 之后 |
| `restore.mjs` | 反过来：检查 profile 里缺哪个包、用 `vendor/*.tgz` 补装 | 换机器/装坏了 |

## 用法

需要 Node 18+（脚本只用 `fetch` 和 fs）。

```bash
# 1) 重新打包（默认读 %USERPROFILE%\.dsh\profiles\desktop）
node tools/pack-vendor.mjs

# 2) 上传新包（token 放 tools/.ghtok，或设 GH_TOKEN 环境变量）
node tools/upload-vendor.mjs

# 3) 看看 profile 缺什么
node tools/restore.mjs plan
```

`pack-vendor` 会跳过内置的 `@deepseek-ai/*`（那些是 DSH 自带的，不用备份）。

## 凭据

`upload-vendor.mjs` 从两个地方取 token，二选一：

- 环境变量 `GH_TOKEN`（推荐，不落盘）
- 脚本旁边的 `.ghtok` 文件（已在 `.gitignore` 里，别提交）

token 需要一个能 `repo` 写入的 GitHub PAT。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_HOME` | `%USERPROFILE%\.dsh` | DSH 根目录 |
| `DSH_PROFILE` | `desktop` | profile 名 |
| `DSH_VENDOR_OWNER` | `KINGs74` | 仓库 owner |
| `DSH_VENDOR_REPO` | `dsh-vendor` | 仓库名 |
| `DSH_VENDOR_NPM_CACHE` | `tools/.npm-cache` | `npm pack` 的缓存目录（默认 npm 缓存常常没权限） |
| `DSH_VENDOR_TAG` | `plugins-2026-11-20` | Release 标签 |

## 出问题看这里

- `npm pack` 报 `EPERM`/`Exit handler never called`：换缓存目录（上面的 `DSH_VENDOR_NPM_CACHE`），大包（`dsh-ops` 这种几十 MB、上千文件的）改用 registry 直链下 tarball（`pack-vendor.mjs` 里已有回落）。
- 上传报 401/404：token 过期或没有 `repo` 写权限。
- `restore.mjs` 说缺包但 `vendor/` 里有：检查包名与文件名的对应关系（`vendorFileName()`）。
