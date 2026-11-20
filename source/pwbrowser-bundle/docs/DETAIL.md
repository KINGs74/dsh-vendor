# 浏览器控制（Chrome / Edge / Brave）

这个 bundle 用 [Playwright MCP](https://github.com/microsoft/playwright-mcp) 的 **extension 模式**，
把三款 Chromium 浏览器接到 DSH 上。extension 模式的要点是：它**不启动一个干净的自动化
浏览器**，而是接管你已经开着、已经登录的窗口 —— 所以 cookie、登录态、扩展、书签全都在。

三条连接彼此独立，各有自己的工具前缀：

| 浏览器 | 工具前缀 | 启动参数 |
| --- | --- | --- |
| Chrome | `mcp__pwbrowser__google__*` | `--extension` |
| Microsoft Edge | `mcp__pwbrowser__edge__*` | `--extension --browser=msedge` |
| Brave | `mcp__pwbrowser__brave__*` | `--extension --executable-path <brave.exe>` |

工具本身是同一套（`browser_navigate`、`browser_snapshot`、`browser_click`、`browser_take_screenshot` …），
模型按前缀选浏览器，于是"用 Chrome 查这个"和"用 Edge 查那个"可以同时进行，互不干扰。

## 一次性准备：给每个浏览器装扩展

三款浏览器都要从 Chrome 应用商店装同一个扩展（Chromium 内核通用）：

<https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm>

装完在工具栏里能看到 Playwright 图标。**每个浏览器各装一次**。

### 什么时候会弹 Allow（真实规则）

扩展**不持久化授权**：`lib/background.mjs` 里的会话表是内存里的 `_sessions` Map，浏览器关掉/
插件重载/客户端重连都会重新走一遍连接流程。连接页 `lib/ui/connect.js` 的判断只有两种结果：

```js
const token = params.get("token");
if (!token) { setCandidates(...); return; }        // 没有 token → 显示选标签 + Allow 按钮
if (token === getOrCreateAuthToken()) await connect({});  // token 正确 → 静默连上
else setStatus({ type: "error", message: "Invalid token provided." });  // token 错误 → 直接拒绝
```

所以**不带 token 时，做不到“一次授权终身免问”**，具体表现：

| 动作 | 会弹 Allow 吗 |
| --- | --- |
| 同一次 DSH 运行中反复调用浏览器工具 | 不会（同一条连接） |
| 关标签页、切页面、导航 | 不会 |
| 重载插件 / 重启 DSH（MCP 服务器重启） | **看运气**：扩展那边会话还在就静默重连，丢了就弹一次 |
| 重启浏览器 | **会** |
| 换一台机器 | **会**（新机器的扩展没这个连接） |

还有一个既不是弹窗也不是成功的第三种状态：**工具调用一直超时**（`Request timed out`），
浏览器那边却什么也没弹。这说明那条连接挂了（旧会话没清干净），跟授权无关：
把那一行单独重启就好（`plugin_manager set_plugin include:mcp-pwbrowser-edge`
关再开），重连通常不再问。

扩展页上那句 *Once approved, the client may also be able to reconnect later without
showing this dialog again, unless you rotate the token* 说的是**带 token 的客户端**：token 对得上
就静默重连，所以 rotate 之后才会重新问。

### 用插件页设置 token（推荐，v1.2 起）

扩展管理页 `chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html` 会显示一个
43 字符的 auth token。把某个浏览器的 token 交给对应的 MCP 服务器，
连接就完全静默，**永远不会再弹 Allow**（除非 rotate）。

**不用手改 YAML。** 打开 **Plugins** → 本 bundle 那一行（`pwbrowser-browser-mode`）右侧的配置图标，
页面上会出现三个只写输入框：

| 输入框 | 写入哪一行 |
| --- | --- |
| Chrome | `mcp-pwbrowser-google` 的 `env.PLAYWRIGHT_MCP_EXTENSION_TOKEN` |
| Microsoft Edge | `mcp-pwbrowser-edge` |
| Brave | `mcp-pwbrowser-brave` |

填一个、点「保存并应用」：宿主把值写进那行 MCP 的 `env`（持久化在 profile 的
`cordis.patch.yml` 里，跟手写等价），随即重启那条连接 —— 大约 2 秒后生效，之后静默。
输入框**不回显**已保存的值（密钥由宿主剥离，界面只知道"已设置/未设置"）；
这个"已设置"就是字段旁的徽标，存好之后会变成**绿色**，所以不用去翻 YAML 也能确认写进去了。
留空表示不改该浏览器；「清除全部」把三个 `env` 一起撤掉，回到要弹 Allow 的老样子。

两点容易误会的：

- **保存成功后输入框会清空**，这是刻意的（token 不会再显示第二遍）。旁边那行绿字
  "已保存……约 2 秒内应用"就是成功的标志；如果是"保存被拒绝"，草稿会留在框里。
- **粘贴时多带了 `PLAYWRIGHT_MCP_EXTENSION_TOKEN=` 之类的前缀、或者带成对引号/空格都没关系**，
  插件会先把它剥成裸 token 再下发。

会话里也可以敲 `/browser token`：把**已保存**的 token 立刻重新下发到三条连接并打印结果
（适合"patch 里已经有值但想强制重连一次"的场景）。

取 token 的办法（在该浏览器里打开 manage.html，然后执行）：

```js
localStorage.getItem('auth-token')
```

token 是**每台机器、每个浏览器各自生成**的，所以本 bundle 出厂不写死：
把 A 机器的 token 带到 B 机器，连接页只会回 `Invalid token provided.` 并拒绝连接
（此时连 Allow 按钮都不给）——在新机器上按上面那套重新设置一次即可。

排查用的一条线索：每次下发都会把结果写进 `~/.dsh/pwbrowser-bundle.status.json`
（只有阶段和文字报告，不含 token），内容形如

```json
{ "at": "2026-11-20T08:04:15.065Z", "stage": "applied",
  "report": ["Chrome: token already applied", "Microsoft Edge: token already applied", "Brave: no token"] }
```

`stage` 不是 `applied` 时，`error` 字段会给出原因。

> 实现备注：`configEditor.edit` 必须跑在宿主的重载事务**外面**。本插件的定时器是在
> "应用本 bundle 的那次事务"里创建的，回调会继承那个 async 上下文，直接调 `edit` 会一直报
> `HMR transactions cannot be nested`；所以下发前先用 `ctx.get('hmr').executing.exit(...)`
> 离开该上下文（宿主没有这个能力时直接调用）。

### 手写 env 也行（与上面等价）

如果偏好文本编辑，直接在 `cordis.patch.yml` 对应 MCP 行加：

```yaml
config:
  env:
    PLAYWRIGHT_MCP_EXTENSION_TOKEN: <43 字符 token>
```

注意 `dsh-mcp-client` 会把父进程环境里形如 `KEY|PASSWORD|SECRET|TOKEN` 的变量过滤掉
（`dsh-subprocess` 的 `SENSITIVE_ENV_PATTERN`），所以把 token 设成 Windows 用户环境变量**没用**，
必须写在 MCP 行自己的 `env` 里。插件页那条路写的正是同一处，只是省了手改。

## Brave 为什么需要特殊写法

Playwright 的 `--browser` 只认 `chrome` / `firefox` / `webkit` / `msedge`，官方没有 Brave 通道。
但 extension 模式下，连接页是用 `--executable-path` 指向的可执行文件直接拉起来的，
沿途不校验品牌 —— 只要那个二进制是 Chromium 且装了上面的扩展就能用。

所以 Brave 走 `--executable-path`。默认写的是：

```
C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe
```

如果 Brave 装在别处（32 位安装、或用户目录安装），改成实际路径即可：

- `C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe`
- `C:\Users\<你>\AppData\Local\BraveSoftware\Brave-Browser\Application\brave.exe`

改完在 **Plugins** 页面把本插件关掉再打开（或重启 DSH）生效。

## 只想要其中一两个浏览器

编辑 `cordis.patch.yml`，把不要的那几段 `- id: ...` 整块删掉或注释掉，然后重启 DSH。
`failOnStartupError` 故意设为 `false`：某台机器上没装某个浏览器时，插件照样能加载，
只是那个前缀下没有工具，不影响另外两个。

## 验证

装好后让模型做一件最小的事即可，例如：

- "用 Chrome 打开 baidu 并截图"
- "用 Edge 打开 deepseek"
- "三个浏览器各自打开 about:blank，说说各自的 UA"

模型侧的工具名形如 `mcp__pwbrowser__edge__browser_navigate`。

## 「浏览器」开关：什么时候模型才真的去开网页

三条连接装好之后，工具一直在工具表里 —— 但模型未必知道**这次**该不该动浏览器：
默认它更愿意用 `web_fetch`（快、便宜），而 extension 模式会接管你的真实窗口，
开之前问一句"要不要问一下用户"反而更烦。所以这个 bundle 还带一个开关，
把「这次要不要开浏览器」变成一次点击：

| 位置 | 输入框左下角工具行，地球图标 + **浏览器**（和「计划」「目标」同一排） |
| 点亮后 | 本会话每步请求都带 `browser:policy` 提示词段落，模型优先用 `mcp__pwbrowser__*` 工具 |
| 熄灭后 | 回到普通 `web_search` / `web_fetch`，工具仍然可用，只是不再被点名优先 |
| 键盘 | `/browser on`、`/browser off`、裸 `/browser` 切换 |
| token | `/browser token`：把插件页里存好的 token 重新下发到三条连接 |

实现上它和官方的「计划」模式同构：

- 宿主半边（`index.js`）注册 `/browser` 命令，命令的 `command/run`、`command/done`
  事件被折叠成 `browserMode` 会话投影 —— 状态**只**存在会话日志里，
  所以重启、resume、fork 之后开关状态不丢；
- 界面半边（`client.js`）在 `conversation.input.left` 注册开关，
  读宿主投影渲染亮/灭，点击时只发一条 `/browser on|off`，不自己记状态；
- 提示词用 `ctx.systemPrompt.section()` 的 `browser:policy`（order 510，紧跟
  `plan:policy` 的 500），按会话状态逐次请求决定是否出现。

这条开关是**每会话**的：不同会话可以一个开着浏览器、一个关着。

## 和「连接器」面板的关系

这个插件和 DSH 的 **MCP 连接器**面板写的是同一种东西（一个 `dsh-mcp-client` 配置项），
区别只在存放位置：插件是 profile 里的一个可分发 bundle，换机器时整目录拷过去装一次就好；
连接器面板是本地即时配置，不随 profile 走。

**同一个 `serverName` 不要同时存在于插件和连接器两边**，否则会撞名导致其中一边加载失败。
从连接器迁移到插件时，先把面板里同名连接停用，再启用插件。