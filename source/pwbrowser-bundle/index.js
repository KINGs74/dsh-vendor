/**
 * pwbrowser-bundle host half: a per-session "browser mode" switch.
 *
 * The three Playwright MCP connections in `cordis.patch.yml` are always
 * composed, so their tools are always *available*. This half adds the missing
 * piece of the Codex-style contract: a mode the user can tick, which makes the
 * model actually drive those tools for web work instead of reaching for
 * `web_fetch`/`web_search`. It mirrors the official plan-mode plugin:
 *
 * 1. `command/run` + `command/done` of `/browser` fold into the `browserMode`
 *    Session projection, so the state is logged, survives resume/fork, and is
 *    published to the client as a wire value the composer chip renders.
 * 2. While the projection says active, a `browser:policy` prompt section is
 *    included in every model request for that Session.
 *
 * No custom Session event is invented, and no state lives in the plugin: the
 * command log itself is the source of truth.
 *
 * @module @local/pwbrowser-browsers
 */

import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Command name that switches the mode (typed as `/browser on|off`). */
const COMMAND = 'browser'

/** Prompt section name and its placement (right after PLAN_POLICY = 500). */
const SECTION = 'browser:policy'
const SECTION_ORDER = 510

/** Projection key: also the client `useProjection` key the chip reads. */
const PROJECTION = 'browserMode'

/**
 * Guidance included while browser mode is active. The tool prefixes match the
 * three `serverName`s in cordis.patch.yml, so the text stays correct whether
 * one, two, or all three browsers are installed.
 */
const SECTION_TEXT = `## Browser mode

Browser mode is ON for this session: the user ticked the browser switch in the composer.
That click is the standing permission to open pages and act on them.

Use the Playwright browser tools for anything that touches a real page — reading content
that needs a login or JavaScript, filling forms, clicking, scrolling, screenshots,
downloading — instead of \`web_fetch\` or \`web_search\`.

Tool prefixes, one per installed browser:

- \`mcp__pwbrowser__google__*\` — Chrome
- \`mcp__pwbrowser__edge__*\` — Microsoft Edge
- \`mcp__pwbrowser__brave__*\` — Brave (only where it is installed)

How to drive it:

1. Open with \`browser_navigate\`, then read with \`browser_snapshot\`: the
   accessibility tree is cheaper and far more reliable than a screenshot.
2. Act through the element refs of the newest snapshot; re-snapshot after
   anything that changes the page.
3. Pick any browser whose extension is connected. If a tool reports that no
   browser is connected, name the browser that needs its "Allow" click once
   instead of retrying the same call.
4. Do not ask for confirmation before navigating or clicking — say what you are
   about to do and do it.
5. Keep \`web_search\`/\`web_fetch\` for quick facts that need no page
   interaction, and say so when you use them in this mode.
6. The mode is per session: \`/browser off\` (or unticking the chip) ends it
   from the next step on.`

/** Duck-typed validation of the persisted state (the registry only calls `parse`). */
const stateSchema = {
  parse(value) {
    if (value === null || typeof value !== 'object') throw new Error('browserMode state must be an object')
    const { active, running } = value
    if (typeof active !== 'boolean') throw new Error('browserMode state needs a boolean `active`')
    if (running !== null) {
      if (typeof running !== 'object') throw new Error('browserMode state needs `running` to be null or an object')
      if (typeof running.commandId !== 'string') throw new Error('browserMode running needs a string `commandId`')
      if (typeof running.wanted !== 'boolean') throw new Error('browserMode running needs a boolean `wanted`')
    }
    return value
  },
}

/** The read-side value: a bare boolean, so an unchanged fold republishes nothing. */
const viewSchema = {
  parse(value) {
    if (typeof value !== 'boolean') throw new Error('browserMode view must be a boolean')
    return value
  },
}

/**
 * Interpret the command line the same way in the fold and in the handler.
 * @param raw - `/browser` argument text.
 * @param current - the logged state, for the bare `/browser` toggle.
 * @returns the wanted state, or `undefined` for an unsupported argument.
 */
function wantedFrom(raw, current) {
  const text = raw.trim().toLowerCase()
  if (text === 'on') return true
  if (text === 'off') return false
  if (text === '') return !current
  return undefined
}

/** Session projection folding the logged `/browser` executions. */
const projectionDefinition = {
  key: PROJECTION,
  stateVersion: 1,
  stateSchema,
  init: () => ({ active: false, running: null }),
  apply(state, event) {
    if (event.type === 'command/run' && event.data !== undefined && event.data.name === COMMAND) {
      const wanted = wantedFrom(typeof event.data.args === 'string' ? event.data.args : '', state.active)
      if (wanted === undefined) return state
      return { ...state, running: { commandId: String(event.data.commandId), wanted } }
    }
    if (event.type === 'command/done' && state.running !== null) {
      const data = event.data
      if (data === undefined || String(data.commandId) !== state.running.commandId) return state
      return data.kind === 'success' ? { active: state.running.wanted, running: null } : { active: state.active, running: null }
    }
    return state
  },
  wire: {
    viewSchema,
    view: state => state.active,
  },
}

/**
 * The three MCP connections this bundle composes, in the order the plugin page
 * shows them. `server` is the row's `serverName`, which is how the reconciler
 * finds the entry without depending on where the row sits in the tree.
 */
const BROWSERS = [
  { key: 'chromeToken', server: 'pwbrowser__google', rowId: 'mcp-pwbrowser-google', label: 'Chrome' },
  { key: 'edgeToken', server: 'pwbrowser__edge', rowId: 'mcp-pwbrowser-edge', label: 'Microsoft Edge' },
  { key: 'braveToken', server: 'pwbrowser__brave', rowId: 'mcp-pwbrowser-brave', label: 'Brave' },
]

/** Environment variable the Playwright MCP server reads the extension token from. */
const TOKEN_ENV = 'PLAYWRIGHT_MCP_EXTENSION_TOKEN'

/** Where the user copies a token from, quoted in the input help. */
const TOKEN_HINT = 'chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html → localStorage["auth-token"]'

/**
 * One write-only token field: `volatile` so saving it does not restart this
 * plugin, `secret` so the value is never sent back to the browser (the form
 * renders it as a blank input and the host only reports whether it is set).
 *
 * @param description - label shown by the configuration page.
 * @returns a schemastery-compatible field descriptor.
 */
function secretField(description) {
  const meta = { volatile: true, role: 'secret', description }
  return {
    type: 'string',
    meta: { ...meta },
    // The host projects a form by calling `toJSON()` on every node it walks,
    // so a field descriptor needs one even though it is not the root schema.
    toJSON() {
      return { type: 'string', meta: { ...meta } }
    },
  }
}

/**
 * Build the `Config` export without importing anything.
 *
 * The host recognizes configuration by the schemastery *graph protocol*: the
 * `Symbol.for("schemastery")` marker, a `type` string, a `meta` object, plus
 * `toJSON()` for projection and a Standard-Schema `validate`. It also treats a
 * schema as callable, so this one is a function over its own validator. Every
 * `toJSON()` hands back a detached copy, because the host strips metadata from
 * the tree it receives.
 *
 * @param dict - field name to field descriptor.
 * @returns the config schema this row is validated against.
 */
/**
 * Reduce whatever was pasted to the bare token.
 *
 * People copy the token out of a `KEY=value` line as often as out of the bare
 * field, so an assignment prefix, wrapping quotes and stray whitespace are
 * stripped instead of being stored as part of the secret.
 *
 * @param raw - pasted value.
 * @returns the token inside it, or an empty string.
 */
function cleanToken(raw) {
  if (typeof raw !== 'string') return ''
  let value = raw.trim()
  const assigned = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*([\s\S]*)$/.exec(value)
  if (assigned !== null) value = assigned[1].trim()
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1).trim()
  }
  return value
}

function configDescriptor(dict) {
  const normalize = (value) => {
    if (value === undefined || value === null) return {}
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('browser token configuration must be an object')
    }
    const next = {}
    for (const key of Object.keys(dict)) {
      const raw = value[key]
      if (raw === undefined || raw === null) continue
      if (typeof raw !== 'string') throw new Error(`config.${key} must be a string`)
      const token = cleanToken(raw)
      if (token === '') continue
      next[key] = token
    }
    return next
  }

  const schema = (value) => normalize(value)

  Object.assign(schema, {
    type: 'object',
    meta: {},
    dict,
    toJSON() {
      return JSON.parse(JSON.stringify({ type: 'object', meta: {}, dict }))
    },
    extra(name, value) {
      return Object.assign(configDescriptor(dict), { meta: { ...schema.meta, [name]: value } })
    },
    '~standard': {
      version: 1,
      vendor: 'pwbrowser-browsers',
      validate(value) {
        try {
          return { value: normalize(value) }
        } catch (error) {
          return { issues: [{ message: error instanceof Error ? error.message : String(error) }] }
        }
      },
    },
  })
  schema[Symbol.for('schemastery')] = true
  return schema
}

/** The row configuration exposed on the plugin page: one token per browser. */
export const Config = configDescriptor({
  chromeToken: secretField(`Chrome extension token — copy it from ${TOKEN_HINT}`),
  edgeToken: secretField(`Microsoft Edge extension token — copy it from ${TOKEN_HINT}`),
  braveToken: secretField(`Brave extension token — copy it from ${TOKEN_HINT}`),
})

/**
 * Read the token values a row currently persists.
 *
 * Values arrive either as plain strings or as volatile views (`.get()`), and the
 * persisted document is the authority: the settings page writes it through
 * `configEditor`, so reading it back is what makes a save actually land.
 *
 * @param config - a raw or volatile row configuration.
 * @returns field name to token, with absent fields omitted.
 */
function readTokens(config) {
  const tokens = {}
  if (config === undefined || config === null || typeof config !== 'object') return tokens
  for (const { key } of BROWSERS) {
    let value = config[key]
    if (value !== null && typeof value === 'object' && typeof value.get === 'function') value = value.get()
    tokens[key] = cleanToken(value)
  }
  return tokens
}

/**
 * Find this plugin's own row, whose configuration holds the tokens.
 * @param rows - `configEditor.entries()`.
 * @returns the row, or undefined when the tree does not contain it.
 */
function ownRow(rows) {
  return rows.find(row => {
    const options = row?.options
    if (options === undefined) return false
    if (options.name === '@local/pwbrowser-browsers') return true
    return typeof options.id === 'string' && options.id.endsWith('pwbrowser-browser-mode')
  })
}

/**
 * Write (or remove) `PLAYWRIGHT_MCP_EXTENSION_TOKEN` on each MCP row so the
 * extension connects silently instead of asking for "Allow".
 *
 * Editing another entry's configuration goes through the documented
 * `configEditor.edit` path — the profile file itself is never touched, so
 * comments and the user's other rows survive. A changed row restarts, which is
 * exactly what makes the new token take effect.
 *
 * @param ctx - host context.
 * @param tokens - field name to token; an empty string clears the variable.
 * @returns one human-readable line per browser.
 */
async function reconcileTokens(ctx, tokens) {
  const editor = ctx.get('configEditor')
  if (editor === undefined) throw new Error('Configuration cannot be saved in this profile')
  const rows = editor.configuration()
  const report = []

  for (const browser of BROWSERS) {
    const wanted = typeof tokens[browser.key] === 'string' ? tokens[browser.key].trim() : ''
    // Rows injected by this bundle's patch are matched by id: their `config` may
    // arrive through a different layer than `options.config`, so `serverName` is
    // only a fallback for profiles that renamed the rows.
    const match =
      rows.find(row => row?.entry?.options?.id === browser.rowId) ??
      rows.find(row => row?.entry?.options?.config?.serverName === browser.server)
    if (match === undefined) {
      report.push(`${browser.label}: connection row not found`)
      continue
    }
    const current = match.entry.options.config ?? {}
    const installed = typeof current.env?.[TOKEN_ENV] === 'string' ? current.env[TOKEN_ENV] : ''
    if (installed === wanted) {
      report.push(`${browser.label}: ${wanted === '' ? 'no token' : 'token already applied'}`)
      continue
    }
    await editor.edit(match.entry, (raw) => {
      const env = { ...(raw?.env ?? {}) }
      if (wanted === '') delete env[TOKEN_ENV]
      else env[TOKEN_ENV] = wanted
      const next = { ...(raw ?? {}) }
      if (Object.keys(env).length === 0) delete next.env
      else next.env = env
      return next
    })
    report.push(`${browser.label}: ${wanted === '' ? 'token cleared' : 'token applied, reconnecting'}`)
  }

  return report
}

/**
 * Push the tokens the row persists into the MCP rows, unless they already
 * match. Never throws: this runs off a timer, where a rejection would be
 * invisible.
 *
 * @param ctx - host context.
 * @param reason - what triggered the pass, for the log line.
 */
async function syncPersistedTokens(ctx, reason) {
  return runOutsideReload(ctx, async () => {
    let editor
    try {
      editor = ctx.get('configEditor')
    } catch (error) {
      traceSync('editor-threw', error)
      return
    }
    if (editor === undefined) {
      traceSync('no-editor')
      return
    }
    try {
      const row = ownRow(editor.entries())
      if (row === undefined) {
        traceSync('no-own-row', undefined, { rows: editor.entries().length })
        return
      }
      const report = await reconcileTokens(ctx, readTokens(row.options.config))
      traceSync('applied', undefined, { report })
    } catch (error) {
      traceSync('failed', error)
      warn(ctx, `applying the stored browser tokens failed (${reason})`, error)
    }
  })
}

/**
 * Run a configuration write outside the reload transaction that activated this
 * plugin.
 *
 * `configEditor.edit` serializes itself through the host's reload lock, and that
 * lock refuses to nest. A timer callback inherits the async context of whoever
 * created it — here, the transaction that applied this bundle — so the write has
 * to leave that context first or it fails forever with "HMR transactions cannot
 * be nested". The lock exposes `exit` for exactly this, and a host without it
 * simply runs the write directly.
 *
 * @param ctx - host context, providing the `hmr` service.
 * @param operation - the write to perform outside the current transaction.
 * @returns the operation's result.
 */
function runOutsideReload(ctx, operation) {
  let hmr
  try {
    hmr = ctx.get('hmr')
  } catch {
    hmr = undefined
  }
  const executing = hmr?.executing
  if (executing !== undefined && typeof executing.exit === 'function') {
    try {
      return Promise.resolve(executing.exit(operation))
    } catch {
      /* Fall through to a direct call. */
    }
  }
  return operation()
}

/**
 * Record the last token-sync pass, so a silent timer cannot fail unobserved.
 * Contains counts and messages only — never a token.
 *
 * @param stage - which branch of the pass ran.
 * @param error - the caught failure, if any.
 * @param extra - additional report fields.
 */
function traceSync(stage, error, extra) {
  try {
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? String(error.stack).split('\n').slice(0, 4) : undefined }),
      ...extra,
    }
    const body = `${JSON.stringify(payload, undefined, 2)}\n`
    // The watcher runs every two seconds; only a pass that did something (or
    // failed) is worth a write.
    if (body.length > 0 && lastTrace === body.replace(/"at": "[^"]*",\n/, '')) return
    lastTrace = body.replace(/"at": "[^"]*",\n/, '')
    writeFileSync(join(homedir(), '.dsh', 'pwbrowser-bundle.status.json'), body)
  } catch {
    /* Diagnostics must never break the plugin. */
  }
}

/** Last breadcrumb written, so an idle watcher does not rewrite the file. */
let lastTrace

/** Services owned by the desktop roster's base composition. */
export const inject = ['systemPrompt', 'sessionProjections']

/**
 * Register the projection, the prompt section, and the `/browser` command.
 *
 * A failure here must not take the boot down with it: the MCP connections are
 * independent entries, so the browsers keep working and only the chip is
 * missing.
 *
 * @param ctx - host root context.
 * @param config - this row's configuration (the browser tokens), if any.
 */
export async function apply(ctx, config) {
  let handle
  try {
    handle = await ctx.sessionProjections.register(projectionDefinition)
  } catch (error) {
    warn(ctx, 'session projection registration failed; browser mode is unavailable', error)
    return
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION,
    order: SECTION_ORDER,
    text: (context) => {
      const agent = context?.agent
      if (agent === undefined) return ''
      try {
        return handle.stateOf(agent.session).active ? SECTION_TEXT : ''
      } catch (error) {
        warn(ctx, 'reading browser mode failed; the section is omitted this step', error)
        return ''
      }
    },
  }), 'pwbrowser-bundle: browser policy section')

  // The command registry is composed independently; without it the mode is
  // still readable (and a resumed session keeps its old state), it just cannot
  // be switched from this build.
  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      definitionId: '@local/pwbrowser-browsers',
      name: COMMAND,
      description: 'Turn the browser tools on or off for this session, or apply stored extension tokens',
      input: { hint: '[on|off|token]' },
      handler: async ({ agent, rawInput }) => {
        const first = rawInput.trim().toLowerCase().split(/\s+/)[0]
        if (first === 'token') {
          const editor = ctx.get('configEditor')
          const row = editor === undefined ? undefined : ownRow(editor.entries())
          if (row === undefined) {
            return { kind: 'error', text: 'Browser tokens cannot be edited in this profile.' }
          }
          const stored = readTokens(row.options.config)
          const report = await reconcileTokens(ctx, stored)
          return { kind: 'success', text: report.join('\n') }
        }
        const current = handle.stateOf(agent.session).active
        const wanted = wantedFrom(rawInput, current)
        if (wanted === undefined) {
          return { kind: 'error', text: 'Use /browser on, /browser off, or /browser token.' }
        }
        if (wanted === current) {
          return { kind: 'success', text: `Browser mode is already ${current ? 'on' : 'off'}.` }
        }
        return {
          kind: 'success',
          text: wanted
            ? 'Browser mode on. Pages will be opened and driven with the browser tools.'
            : 'Browser mode off. Web work falls back to the usual fetch and search tools.',
        }
      },
    })
  })

  // Tokens saved on the plugin page land in this row's configuration; this
  // watcher moves them onto the MCP rows. `configEditor` is the same path the
  // settings page writes, so a save is visible here without any client call.
  // The first pass waits for the tree to finish booting; every pass after it is
  // a no-op unless a stored token and an installed one disagree.
  ctx.effect(() => {
    let live = true
    const pass = () => {
      if (live) void syncPersistedTokens(ctx, 'scheduled')
    }
    const first = setTimeout(pass, 250)
    const timer = setInterval(pass, 2000)
    first.unref?.()
    timer.unref?.()
    return () => {
      live = false
      clearTimeout(first)
      clearInterval(timer)
    }
  }, 'pwbrowser-bundle: extension token watcher')
}

/**
 * Report one contained failure through the host logger.
 * @param ctx - host context providing `logger`.
 * @param message - what failed.
 * @param error - the cause.
 */
function warn(ctx, message, error) {
  try {
    ctx.logger?.warn?.(`[pwbrowser-bundle] ${message}: %o`, error)
  } catch {
    /* A logging failure must never surface as a plugin failure. */
  }
}

// Host loaders in this ecosystem take either the module namespace (named
// exports, like dsh-quote-followup) or its default export (like
// dsh-codex-effort-slider); both point at the same object here.
export default { Config, inject, apply }