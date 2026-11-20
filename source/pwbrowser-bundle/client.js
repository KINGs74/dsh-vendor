/**
 * pwbrowser-bundle browser half: the composer's "browser mode" switch.
 *
 * A chip on the left of the composer tool row, next to the other toolbar
 * controls: ticked means "use the browser for this Session". It renders the
 * host-projected `browserMode` value and flips it by executing
 * `/browser on` / `/browser off` through the official remote command endpoint —
 * the same path the shipped plan chip uses. There is no hidden client state:
 * the host logs the switch, folds it into the projection, and the chip renders
 * what came back.
 *
 * Loaded by the web client through the package's `dsh.client` declaration
 * (`platform: "web"`, mounted at boot) and kept alive by the host row this
 * package inserts in `cordis.patch.yml`.
 *
 * @module @local/pwbrowser-browsers/client
 */
window.__ModuleLoader__.load({
  id: '@local/pwbrowser-browsers',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    /** Seat: the compact left side of the composer tool row. */
    const SLOT = 'conversation.input.left'
    const ENTRY_ID = 'pwbrowser-browser-mode'
    const ORDER = 30

    /** Must match the host projection key in `index.js`. */
    const PROJECTION = 'browserMode'

    /** Dictionary namespace owned by this plugin. */
    const NS = 'pwbrowser'
    const DICT = {
      zh: {
        'chip.label': '浏览器',
        'chip.on.title': '浏览器模式已开启：模型会用浏览器打开并操作真实网页，点击关闭',
        'chip.off.title': '开启浏览器模式：模型会用浏览器打开并操作真实网页',
        'chip.busy': '正在切换浏览器模式…',
        'chip.failed': '切换浏览器模式失败',
        'token.title': '浏览器扩展 Token',
        'token.desc': '把每个浏览器扩展里的 auth-token 填在这里（只写不回显）。连接会静默建立，不再弹 Allow。输入框留空表示不修改该浏览器。',
        'token.where': '取值位置：浏览器打开 chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html，复制 localStorage["auth-token"] 的值（43 个字符）。',
        'token.chrome': 'Chrome',
        'token.edge': 'Microsoft Edge',
        'token.brave': 'Brave',
        'token.placeholder': '粘贴 token',
        'token.set': '已设置',
        'token.unset': '未设置',
        'token.save': '保存并应用',
        'token.clear': '清除全部',
        'token.saved': '已保存（输入框清空是正常的，token 不会再显示），约 2 秒内应用到该浏览器的连接',
        'token.nothing': '没有要保存的内容：先在输入框里粘贴一个 token',
        'token.rejected': '保存被拒绝：配置已在别处改动，请重试',
        'token.failed': '保存失败',
        'token.unavailable': '这里拿不到可写的配置表单，请在插件列表里点该行进入配置页。',
        'token.loading': '正在读取配置…',
        'token.apply': '应用已保存的 token',
        'token.applied': '已应用到浏览器连接',
        'token.summary': '三个浏览器的扩展 Token 在这一行的配置页里设置，设置后不再弹 Allow。',
      },
      en: {
        'chip.label': 'Browser',
        'chip.on.title': 'Browser mode is on — the model drives real pages; click to turn it off',
        'chip.off.title': 'Turn browser mode on: the model drives real pages with the browser',
        'chip.busy': 'Switching browser mode…',
        'chip.failed': 'Could not switch browser mode',
        'token.title': 'Browser extension tokens',
        'token.desc': 'Paste each browser extension\'s auth-token here (write-only). Connections then attach silently instead of asking for "Allow". An empty box leaves that browser unchanged.',
        'token.where': 'Where to find it: open chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html and copy localStorage["auth-token"] (43 characters).',
        'token.chrome': 'Chrome',
        'token.edge': 'Microsoft Edge',
        'token.brave': 'Brave',
        'token.placeholder': 'Paste token',
        'token.set': 'set',
        'token.unset': 'not set',
        'token.save': 'Save and apply',
        'token.clear': 'Clear all',
        'token.saved': 'Saved — the box clears on purpose and the token is never shown again; it reaches that connection within about two seconds',
        'token.nothing': 'Nothing to save: paste a token into at least one box',
        'token.rejected': 'Save rejected: the configuration changed elsewhere, try again',
        'token.failed': 'Save failed',
        'token.unavailable': 'No writable form here — open this row from the plugin list to configure it.',
        'token.loading': 'Reading configuration…',
        'token.apply': 'Apply stored tokens',
        'token.applied': 'Applied to the browser connections',
        'token.summary': 'The three extension tokens are set on this row\'s configuration page; once set, Allow stops appearing.',
      },
    }

    const STYLE_ID = 'pwbrowser-browser-chip-style'
    const CSS = `
.pwb-chip{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer}
@media (hover:hover){.pwb-chip:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}}
.pwb-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.pwb-chip--on{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
@media (hover:hover){.pwb-chip--on:hover:not(:disabled){color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));background:var(--dsw-alias-state-business-tertiary)}}
.pwb-chip:disabled{opacity:.6;cursor:default}
.pwb-chip--failed:not(.pwb-chip--on){color:var(--dsw-alias-state-error-primary)}
.pwb-chip__glyph{display:inline-flex;flex:0 0 auto;width:14px;height:14px;color:currentColor}
.pwb-chip__label{white-space:nowrap}
.pwb-form{display:flex;flex-direction:column;gap:12px;padding:4px 0}
.pwb-form__title{margin:0;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pwb-form__text{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.pwb-form__where{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.pwb-field{display:flex;flex-direction:column;gap:6px}
.pwb-field__head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.pwb-badge{padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500;line-height:16px}
.pwb-badge--set{background:var(--dsw-alias-state-success-tertiary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}
.pwb-input{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px}
.pwb-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.pwb-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pwb-btn{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer}
.pwb-btn--primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}
.pwb-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.pwb-btn:disabled{opacity:.55;cursor:default}
.pwb-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pwb-note--error{color:var(--dsw-alias-state-error-primary)}
.pwb-note--ok{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
`

    /**
     * A globe: the page-facing tool group, drawn inline so the chip needs no
     * icon package.
     * @returns the glyph element.
     */
    function globeGlyph() {
      return h('svg', {
        className: 'pwb-chip__glyph',
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
        h('circle', { cx: '8', cy: '8', r: '6.1' }),
        h('path', { d: 'M1.9 8h12.2' }),
        h('path', { d: 'M8 1.9c1.7 1.8 2.6 3.9 2.6 6.1S9.7 12.3 8 14.1C6.3 12.3 5.4 10.2 5.4 8S6.3 3.7 8 1.9z' }),
      )
    }

    /**
     * Install the chip styles once per document.
     * @param doc - the owning document, when there is one.
     */
    function installStyles(doc) {
      try {
        if (!doc || typeof doc.createElement !== 'function') return
        if (doc.getElementById(STYLE_ID) !== null) return
        const style = doc.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        const head = doc.head || doc.documentElement
        if (head) head.appendChild(style)
      } catch (error) {
        // Styling is cosmetic: an unstyled chip still works.
      }
    }

    /**
     * The switch itself.
     *
     * Props: the slot's runtime share (`useProjection`, `sessionId`, …), the
     * injected face from `apply`, and the locale seat's `t`.
     *
     * @param props - component props.
     * @returns the chip element.
     */
    function BrowserChip(props) {
      const t = props.t
      const useProjection = props.useProjection
      const setBrowserMode = props.setBrowserMode

      const statePair = React.useState({ busy: false, failure: null })
      const local = statePair[0]
      const setLocal = statePair[1]
      const aliveRef = React.useRef(true)

      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      // The host value is the only source of truth; a projection that has not
      // arrived yet (or a slot without the runtime share) reads as "off".
      const projected = typeof useProjection === 'function' ? useProjection(PROJECTION) : undefined
      const active = projected === true

      const toggle = React.useCallback(() => {
        if (local.busy) return
        setLocal({ busy: true, failure: null })
        void setBrowserMode(!active).then((failure) => {
          if (!aliveRef.current) return
          setLocal({ busy: false, failure })
        }, (reason) => {
          if (!aliveRef.current) return
          setLocal({ busy: false, failure: reason instanceof Error ? reason.message : String(reason) })
        })
      }, [active, local.busy, setBrowserMode])

      const title = local.busy
        ? t('chip.busy')
        : local.failure !== null
          ? `${t('chip.failed')}: ${local.failure}`
          : active ? t('chip.on.title') : t('chip.off.title')

      return h('button', {
        type: 'button',
        className: [
          'pwb-chip',
          active ? 'pwb-chip--on' : '',
          local.failure !== null ? 'pwb-chip--failed' : '',
        ].filter(Boolean).join(' '),
        'aria-pressed': active,
        'aria-label': title,
        'data-pwbrowser-mode': active ? 'on' : 'off',
        title,
        disabled: local.busy,
        onClick: toggle,
      }, globeGlyph(), h('span', { className: 'pwb-chip__label' }, t('chip.label')))
    }

    /** Package name this browser half belongs to; the plugin page keys on it. */
    const PKG = '@local/pwbrowser-browsers'

    /** The three write-only token fields, in page order. */
    const TOKEN_FIELDS = [
      { key: 'chromeToken', labelKey: 'token.chrome' },
      { key: 'edgeToken', labelKey: 'token.edge' },
      { key: 'braveToken', labelKey: 'token.brave' },
    ]

    /**
     * Which secret paths the host reports as set. The values never reach the
     * browser — the host strips them and reports `{ path, set }` instead — so the
     * page can only say "already set" and never show a token back.
     *
     * The flag rides the namespace view, not the form snapshot: the form keeps
     * `value`/`revision`/`writable`, while `secrets` stays on the describe view
     * the mirror holds.
     *
     * @param view - the mirror's current describe view.
     * @param ns - the namespace this card configures.
     * @returns path (dot-joined) to whether a value is stored.
     */
    function secretFlags(view, ns) {
      const flags = {}
      const namespaces = view !== undefined && view !== null && Array.isArray(view.namespaces) ? view.namespaces : []
      const section = namespaces.find(entry => entry !== null && typeof entry === 'object' && entry.ns === ns)
      const secrets = section !== undefined && section !== null && Array.isArray(section.secrets) ? section.secrets : []
      for (const secret of secrets) {
        if (secret === null || typeof secret !== 'object' || !Array.isArray(secret.path)) continue
        flags[secret.path.join('.')] = secret.set === true
      }
      return flags
    }

    /**
     * The namespace a Loader row's configuration lives under: the row's patch id,
     * which is also the id half of a `plugins.row.config` key.
     */
    const FORM_NAMESPACE = ENTRY_ID

    /**
     * Read this row's own configuration form from the client `configForms` service.
     *
     * The bundle page's card (`plugins.bundle.config`) is rendered without a `form`
     * prop — only row pages receive one — so the card subscribes to the namespace
     * itself. The service ships with the settings UI; when it is not reachable the
     * caller falls back to whatever prop was passed.
     *
     * @param hostCtx - this plugin's client context.
     * @returns `{ state, mutate }` shaped like a slot-provided form, or null.
     */
    function useServiceForm(hostCtx) {
      const storeRef = React.useRef(null)
      if (storeRef.current === null) {
        // The settings service is optional: a profile without the settings UI
        // simply keeps the fallback message instead of blanking the slot.
        try {
          const forms = hostCtx !== undefined && hostCtx !== null && typeof hostCtx.get === 'function'
            ? hostCtx.get('configForms')
            : undefined
          if (forms !== undefined && forms !== null && typeof forms.get === 'function') {
            storeRef.current = forms.get(FORM_NAMESPACE)
          }
        } catch (error) {
          reportFailure('read the token form', error)
        }
      }
      const store = storeRef.current
      const pair = React.useState(() => (store === null || store === undefined ? null : store.getSnapshot()))
      const snapshot = pair[0]
      const setSnapshot = pair[1]

      React.useEffect(() => {
        if (store === null || store === undefined) return undefined
        setSnapshot(store.getSnapshot())
        return store.subscribe(() => setSnapshot(store.getSnapshot()))
      }, [store, setSnapshot])

      if (store === null || store === undefined || snapshot === null || snapshot === undefined) return null
      const revision = snapshot.revision
      return {
        state: snapshot,
        mutate: (ops, expected) => store.mutate(ops, expected === undefined ? revision : expected),
      }
    }

    /**
     * Whether each secret slot already holds a value, straight from the settings
     * mirror. This is the same "已设置 / 未设置" signal the host produces for its
     * own secret inputs, so the badge flips as soon as a save is folded back in.
     *
     * @param hostCtx - this plugin's client context.
     * @returns token key to "has a stored value".
     */
    function useSecretFlags(hostCtx) {
      const pair = React.useState({})
      const setFlags = pair[1]
      React.useEffect(() => {
        if (hostCtx === undefined || hostCtx === null || typeof hostCtx.get !== 'function') return undefined
        let face
        try {
          const forms = hostCtx.get('configForms')
          face = forms === undefined || forms === null ? undefined : forms.describe()
        } catch (error) {
          reportFailure('read the token status', error)
          return undefined
        }
        if (face === undefined || face === null || typeof face.subscribe !== 'function') return undefined
        const read = () => {
          let snapshot
          try {
            snapshot = face.getSnapshot()
          } catch (error) {
            reportFailure('read the token status', error)
            return
          }
          const view = snapshot === null || snapshot === undefined ? undefined : snapshot.view
          const next = secretFlags(view, FORM_NAMESPACE)
          setFlags(previous => {
            const same = Object.keys(next).length === Object.keys(previous).length
              && Object.keys(next).every(key => previous[key] === next[key])
            return same ? previous : next
          })
        }
        read()
        try {
          void face.ensure()
        } catch (error) {
          reportFailure('load the token status', error)
        }
        const stop = face.subscribe(read)
        return typeof stop === 'function' ? stop : undefined
      }, [hostCtx, setFlags])
      return pair[0]
    }

    /**
     * The plugin page's token form.
     *
     * Rendered in `plugins.row.config`, which is the one plugin-manager seat that
     * hands a page the row's writable configuration form (`props.form`). Saving
     * writes this row's config; the host half then pushes the tokens onto the
     * three MCP rows, so the extension connects without asking for "Allow".
     *
     * @param props - `PluginConfigViewProps` plus the locale seat's `t`.
     * @returns the form (page) or a one-line note (summary card).
     */
    function TokenConfigView(props) {
      const t = props.t
      const provided = props.form === undefined ? null : props.form
      // Only reach for the settings service when the seat did not hand us a form.
      const fallback = useServiceForm(provided === null ? props.hostCtx : null)
      const flags = useSecretFlags(props.hostCtx)
      const form = provided === null ? fallback : provided
      const state = form === null || form === undefined ? undefined : form.state
      const pair = React.useState({ chromeToken: '', edgeToken: '', braveToken: '' })
      const draft = pair[0]
      const setDraft = pair[1]
      const busyPair = React.useState(false)
      const busy = busyPair[0]
      const setBusy = busyPair[1]
      const notePair = React.useState(null)
      const note = notePair[0]
      const setNote = notePair[1]
      const aliveRef = React.useRef(true)

      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      const status = state === undefined ? 'loading' : state.status
      const writable = state !== undefined && state.writable !== false

      const change = React.useCallback((key) => (event) => {
        const value = typeof event?.target?.value === 'string' ? event.target.value : ''
        setDraft(current => ({ ...current, [key]: value }))
      }, [setDraft])

      const submit = React.useCallback((ops, done) => {
        if (form === null || form === undefined || busy) return Promise.resolve()
        setBusy(true)
        setNote(null)
        return form.mutate(ops, state === undefined ? undefined : state.revision).then((accepted) => {
          if (!aliveRef.current) return
          if (accepted) {
            setDraft({ chromeToken: '', edgeToken: '', braveToken: '' })
            setNote({ kind: 'ok', text: done })
          } else {
            setNote({ kind: 'error', text: t('token.rejected') })
          }
        }, (error) => {
          if (!aliveRef.current) return
          setNote({ kind: 'error', text: `${t('token.failed')}: ${error instanceof Error ? error.message : String(error)}` })
        }).then(() => {
          if (aliveRef.current) setBusy(false)
        })
      }, [busy])

      const save = React.useCallback(() => {
        const ops = TOKEN_FIELDS
          .filter(field => draft[field.key].trim() !== '')
          .map(field => ({ op: 'set', path: [field.key], value: draft[field.key].trim() }))
        if (ops.length === 0) {
          setNote({ kind: 'error', text: t('token.nothing') })
          return
        }
        void submit(ops, t('token.saved'))
      }, [draft, submit])

      const clearAll = React.useCallback(() => {
        void submit(TOKEN_FIELDS.map(field => ({ op: 'unset', path: [field.key] })), t('token.applied'))
      }, [submit])

      if (props.view === 'summary') {
        return h('p', { className: 'pwb-form__text' }, t('token.summary'))
      }
      if (form === null || form === undefined || status === 'unavailable') {
        return h('p', { className: 'pwb-form__text' }, t('token.unavailable'))
      }
      if (status === 'loading') {
        return h('p', { className: 'pwb-form__text' }, t('token.loading'))
      }

      const fields = TOKEN_FIELDS.map(field => h('label', { key: field.key, className: 'pwb-field' },
        h('span', { className: 'pwb-field__head' },
          t(field.labelKey),
          h('span', { className: flags[field.key] === true ? 'pwb-badge pwb-badge--set' : 'pwb-badge' },
            flags[field.key] === true ? t('token.set') : t('token.unset'))),
        h('input', {
          className: 'pwb-input',
          type: 'password',
          autoComplete: 'off',
          spellCheck: false,
          placeholder: t('token.placeholder'),
          value: draft[field.key],
          disabled: busy || !writable,
          onChange: change(field.key),
        })))

      return h('div', { className: 'pwb-form' },
        h('p', { className: 'pwb-form__title' }, t('token.title')),
        h('p', { className: 'pwb-form__text' }, t('token.desc')),
        h('p', { className: 'pwb-form__where' }, t('token.where')),
        fields,
        h('div', { className: 'pwb-actions' },
          h('button', {
            type: 'button',
            className: 'pwb-btn pwb-btn--primary',
            disabled: busy || !writable,
            onClick: save,
          }, t('token.save')),
          h('button', {
            type: 'button',
            className: 'pwb-btn',
            disabled: busy || !writable,
            onClick: clearAll,
          }, t('token.clear'))),
        note === null ? null : h('p', {
          className: note.kind === 'ok' ? 'pwb-note pwb-note--ok' : 'pwb-note pwb-note--error',
          role: 'status',
        }, note.text))
    }

    /**
     * Report one contained slot registration failure.
     * @param what - which seat failed.
     * @param error - the cause.
     */
    function reportFailure(what, error) {
      try {
        console.error(`[pwbrowser] ${what} registration failed:`, error)
      } catch (ignored) {
        /* Ignore. */
      }
    }

    /**
     * Register the chip and its copy.
     *
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICT), 'pwbrowser-bundle: dictionaries')
      const t = ctx.locale.bind(NS)

      try {
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: ENTRY_ID,
          order: ORDER,
          locale: NS,
          label: () => t('chip.label'),
          inject: (sessionId) => ({
            /**
             * Switch the mode through the host command that owns it: the chip
             * only names the wanted state, the host logs and folds it.
             *
             * @param on - the wanted state.
             * @returns null when the command was admitted; a failure line otherwise.
             */
            setBrowserMode: async (on) => {
              const line = on ? '/browser on' : '/browser off'
              const result = await ctx.remote.commands.execute(sessionId, line, [])
              if (!result.ok) return `${result.error.message} (${result.error.code})`
              if (result.value === undefined) return `unknown command: ${line}`
              return null
            },
          }),
        }, BrowserChip))
      } catch (error) {
        // A failed registration costs this one control and nothing else.
        reportFailure('browser chip', error)
      }

      // The token form. `plugins.row.config` is keyed `<package>#<row id>`, and a
      // bundle-inserted row is addressed by its include id, so both spellings are
      // registered: whichever one the manager asks for finds the page.
      for (const key of [`${PKG}#include:${ENTRY_ID}`, `${PKG}#${ENTRY_ID}`]) {
        try {
          ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config',
            key,
            locale: NS,
          }, (props) => h(TokenConfigView, { ...props, hostCtx: props.hostCtx === undefined ? ctx : props.hostCtx })))
        } catch (error) {
          reportFailure(`token row page (${key})`, error)
        }
      }

      // The bundle page's card. It is rendered without a `form` prop, so the view
      // subscribes to this row's namespace through the `configForms` service and
      // edits the same configuration the row page does.
      try {
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: PKG,
          locale: NS,
        }, (props) => h(TokenConfigView, { ...props, hostCtx: props.hostCtx === undefined ? ctx : props.hostCtx })))
      } catch (error) {
        reportFailure('token bundle card', error)
      }
    }

    installStyles(typeof document === 'undefined' ? undefined : document)

    exports.inject = ['slots', 'locale', 'remote', 'remote.commands']
    exports.apply = apply
    return module.exports
  },
})