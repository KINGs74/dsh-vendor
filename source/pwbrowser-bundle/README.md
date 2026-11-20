# 浏览器控制 bundle（Chrome / Edge / Brave）

一个可迁移的 DSH 插件：把三款 Chromium 浏览器作为独立的 MCP 服务接进 DSH，
让模型直接操作你**已经登录**的窗口。

## 在另一台电脑上安装

### 0. 前置条件（三样，缺一样就起不来）

| 前置 | 要求 | 为什么 |
|---|---|---|
| DSH | **0.2.1-rc.3 及以上**（本机即此版本，已验证） | 用到的 `conversation.input.left`、`plugins.row.config`、`plugins.bundle.config` 槽和 `configForms`/`settings`/`configEditor`/`hmr` 服务都在这个版本里 |
| Node.js | **20 或更新**，且 `npx` 在 PATH 里 | 三条 MCP 行都是 `command: npx`，运行时靠 npx 拉 `@playwright/mcp@0.0.86` |
| 浏览器扩展 | Chrome 应用商店那个 Playwright 扩展（链接见下），**该机每个浏览器各装一次** | 扩展才是真正驱动浏览器的另一半；扩展 id `mmlmfjhmonkocbjadbfplnigmagldckm` |

不需要拷贝的东西：**token**（每台机器、每个浏览器各自生成）和**站点登录态**（在那台机器的浏览器里自己登）。

### 1. 装扩展（每台浏览器各一次）

   <https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm>

   Chrome、Edge、Brave 都从这个 Chrome 应用商店链接装同一个扩展。

   不带 token 时，**每次新建连接**（典型就是每次 DSH 启动/插件重载后第一次用浏览器）都会
   打开 connect 页让你点一次 **Allow** —— 扩展只在内存里记会话，不持久化授权。
   想彻底免弹，把该浏览器的 auth token 写进 `env.PLAYWRIGHT_MCP_EXTENSION_TOKEN`（见 `docs/DETAIL.md`）。

   如果连接页报 `Invalid token provided.`，说明 patch 里写死了**别的机器**的 token：
   本 bundle 默认不带 token，删掉 `env.PLAYWRIGHT_MCP_EXTENSION_TOKEN` 那行即可（见 `docs/DETAIL.md`）。

2. **拿到包**（三种来源，挑一种）

   - **公开镜像直链**（最快，不用登录 GitHub）：
     `https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-20/local-pwbrowser-browsers-1.2.2.tgz`
     —— 浏览器打开就下载，25 KB。
   - **自己打包**：在本仓库目录跑 `npm pack`，得到 `local-pwbrowser-browsers-<版本>.tgz`。
   - **源码目录**：把 `pwbrowser-bundle/` 整个拷过去（**要改代码就用这个**，装完改完重载即生效）。

3. **安装（点界面就行，不必敲命令）**

   **Plugins** 页 → 右上 **添加插件** → 在「包名或地址」框里粘贴下面任一种：

   | 粘贴什么 | 例子 | 适用 |
   | --- | --- | --- |
   | Release 直链 | `https://github.com/KINGs74/dsh-vendor/releases/download/plugins-2026-11-20/local-pwbrowser-browsers-1.2.2.tgz` | 那台机器能访问 github.com |
   | 本地文件绝对路径 | `C:\Users\你\Downloads\local-pwbrowser-browsers-1.2.2.tgz` | 已经下到本机 / 网络不行 |
   | 源码目录绝对路径 | `D:\dsh-bundles\pwbrowser-bundle` | 想改代码 |

   ⚠️ **两个最常见的错**：

   - 把 tgz 地址填进「**安装源**」——那是 npm registry，pnpm 会拼出 `…/xxx.tgz/包名` 这种地址，然后把 GitHub 的 404 HTML 页面当 JSON 解析，报 `ERR_PNPM_BROKEN_METADATA_JSON`。tgz 属于「包名或地址」框。
   - 粘贴 Release **页面**地址（`…/releases/tag/plugins-2026-11-20`）而不是**文件直链**（`…/releases/download/plugins-2026-11-20/文件名.tgz`）。

   「安装源」怎么选（这一步最容易出错，按表来）：

   | 你的情况 | 选这个 | 为什么 |
   | --- | --- | --- |
   | 装**包名**（市场里的插件），网络正常 | **npm 官方源**（默认） | 最全、最新 |
   | 装**包名**，国内慢/超时 | **中国大陆镜像源** | npmmirror 同步，通常几 MB/s |
   | 装 **tgz / 直链 / 本地目录**（本 bundle 就是这种） | **中国大陆镜像源**（官方源也行） | tgz 本体不经过源；但它的**依赖**要从源拉 |
   | 有公司内网私有 registry | **自定义地址** | 只在真填了内网源时用。⚠️ 别把 tgz 地址塞这里 |

   本 bundle **没有依赖**，所以选官方源或镜像源都一样；但**别留一个无效的自定义地址**，否则以后装别的插件会卡在依赖解析。

   命令行等价（适合写脚本/批量）：`plugin_manager` `install_bundle`，`target` 填同样的直链或绝对路径。

4. **改 Brave 路径（如果不在默认位置）**

   编辑 `cordis.patch.yml` 里 `mcp-pwbrowser-brave` 的 `--executable-path`，
   常见位置见 `docs/DETAIL.md`。

5. **不用重启**：bundle 的行会热加载，装完刷新页面，插件页就能看到 4 个新组件（1 个开关 + 3 个浏览器服务器）。然后让模型跑一句"用 Edge 打开 baidu 并截图"验证。

## 图形化设置 Token（v1.2 新增）

不用再手改 YAML：插件页里点本 bundle 那一行（`pwbrowser-browser-mode`）右侧的**配置**，
就能看到三个只写输入框（Chrome / Edge / Brave），粘贴 token 后「保存并应用」。

- 输入框**不回显**已保存的值（密钥类字段由宿主剥离，只告诉界面"已设置/未设置"）；
  存好之后该浏览器的徽标会变成绿色的**已设置**，一眼就能看出写没写进去；
  留空表示不改动该浏览器；「清除全部」会把三个 `env` 一起撤掉，回到每次点 Allow 的状态。
- **保存成功后输入框会清空，这是正常的**（token 不会显示第二遍），旁边出现"已保存"绿字即成功；
  被拒绝时草稿会留在框里。粘贴时带 `PLAYWRIGHT_MCP_EXTENSION_TOKEN=` 前缀或成对引号也能自动剥掉。
- 保存后约 2 秒内，宿主把 token 写进对应 MCP 行的 `env.PLAYWRIGHT_MCP_EXTENSION_TOKEN`
  并重启那条连接 —— 之后该浏览器**静默连上，不再弹 Allow**。
- token 从哪来：在该浏览器的扩展页 `chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html`
  打开控制台读 `localStorage["auth-token"]`（43 个字符）。
- 也可以在会话里直接敲 `/browser token`：把已保存的 token 立刻重新应用到三条连接并报告结果。

## 目录结构

```
pwbrowser-bundle/
├── package.json          # dsh.bundle.patch 指向 cordis.patch.yml，dsh.client 指向 client.js
├── cordis.patch.yml      # 三个 dsh-mcp-client 配置项 + 本插件自身的宿主行
├── index.js              # 宿主半边：/browser 命令 + browserMode 投影 + 提示词段落 + Token 配置与下发
├── client.js             # 界面半边：输入框工具行的「浏览器」开关 + 插件页的 Token 表单
├── locale/{en,zh}.json   # 插件在 Plugins 页面的标题/描述
├── docs/DETAIL.md        # 给用户看的完整说明（含排错）
├── docs/preview.svg
└── icon.svg
```

## 「浏览器」开关（v1.1 新增）

输入框左下角工具栏会多出一个地球图标的 **浏览器** 开关，和「计划」「目标」同一排：

- **点亮** = 本会话进入浏览器模式：模型拿到一段 `browser:policy` 提示词，
  优先用 `mcp__pwbrowser__google__*` / `__edge__*` / `__brave__*` 打开并操作真实网页；
- **熄灭** = 回到普通的 `web_search` / `web_fetch`。

开关状态是**每会话**的、写进会话日志的，所以重启 DSH、resume、fork 之后都还在。
键盘党也可以直接敲 `/browser on`、`/browser off`、或不带参数的 `/browser`（切换）。

## 需要改什么

| 场景 | 改哪里 |
| --- | --- |
| Brave 装在别的路径 | `cordis.patch.yml` → `mcp-pwbrowser-brave` → `--executable-path` |
| 那台机器没有某个浏览器 | 删掉对应整块 `- id:` |
| 想加第四个 Chromium 浏览器（Vivaldi/Arc…） | 复制 `mcp-pwbrowser-brave` 那块，改 `id`、`serverName`、`--executable-path` |
| 换 node/npx 路径 | `command` 改成绝对路径，如 `D:\nodejs\npx.cmd` |

`serverName` 只能用 `[A-Za-z0-9_-]`、不超过 32 字符，且**不能与连接器面板里已有的同名连接重复**。

## 已知限制

- extension 模式要求浏览器已装扩展且至少授权过一次；纯命令行环境（无 GUI）不适用。
- 本 bundle 的 Brave 分支依赖 `--executable-path` 的透传行为，已在 v0.0.86 的源码确认；
  未来 Playwright MCP 若改成按 channel 白名单校验，需要重新验证。
- 版本**锁定**在 `@playwright/mcp@0.0.86`：首次启动会走 npx 下载缓存，之后复用。升级扩展时三条行一起改版本号。