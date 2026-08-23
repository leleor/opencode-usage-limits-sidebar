/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { TuiEventBus, TuiPlugin } from "@opencode-ai/plugin/tui"
import {
  REFRESH_INTERVAL_MS,
  RESET_COLUMN_WIDTH,
  SIDEBAR_ORDER,
  USED_COLUMN_WIDTH,
  formatUsd,
  getPalette,
  clampedPercent,
  resetText,
  rightAlign,
  type ColorValue,
  type Palette,
} from "./format.js"
import { DEFAULT_BASE_URL, fetchUsage } from "./api.js"
import { resolveApiKey } from "./auth.js"
import type { LimitsConfig, WindowKind, WindowUsage } from "./types.js"

function ProgressBar(props: { percent: number; fg: ColorValue; bg: ColorValue }) {
  const pct = Math.max(0, Math.min(100, props.percent))
  return (
    <box width="100%" flexDirection="row" height={1}>
      <box flexGrow={pct} backgroundColor={props.fg} />
      <box flexGrow={100 - pct} backgroundColor={props.bg} />
    </box>
  )
}

function LimitRow(props: {
  palette: Palette
  line: WindowUsage
  limitReached: boolean
}) {
  const pct = clampedPercent(props.line.percent)
  return (
    <box flexDirection="column" marginBottom={1}>
      <box flexDirection="row" width="100%">
        <box flexGrow={1}>
          <text fg={props.palette.text}>{props.line.label}</text>
        </box>
        <box width={USED_COLUMN_WIDTH} justifyContent="flex-end">
          <text fg={props.limitReached ? props.palette.warning : props.palette.text}>
            {rightAlign(`${pct}%`, USED_COLUMN_WIDTH)}
          </text>
        </box>
        <box width={RESET_COLUMN_WIDTH} justifyContent="flex-end" marginLeft={1}>
          <text fg={props.palette.muted}>
            {rightAlign(resetText(props.line.resetsAt), RESET_COLUMN_WIDTH)}
          </text>
        </box>
      </box>
      <box marginTop={1}>
        <ProgressBar
          percent={pct}
          fg={props.limitReached ? props.palette.warning : props.palette.accent}
          bg={props.palette.subtle}
        />
      </box>
      <box marginTop={1} flexDirection="row" width="100%">
        <text fg={props.palette.muted}>
          {formatUsd(props.line.used)} / {formatUsd(props.line.limit)}
        </text>
        <Show when={props.limitReached}>
          <text fg={props.palette.warning} marginLeft={1}>
            <b>LIMIT</b>
          </text>
        </Show>
      </box>
    </box>
  )
}

function SidebarLimits(props: {
  theme: Record<string, unknown>
  config: LimitsConfig
  event: TuiEventBus
}) {
  const palette = createMemo(() => getPalette(props.theme))
  const [windows, setWindows] = createSignal<WindowUsage[]>([])
  const [loading, setLoading] = createSignal(true)
  const [errorMsg, setErrorMsg] = createSignal("")
  const [limitReached, setLimitReached] = createSignal<Record<WindowKind, boolean>>({
    hour5: false,
    weekly: false,
    monthly: false,
  })

  const refresh = async () => {
    try {
      const key = await resolveApiKey(props.config.provider, props.config.apiKey)
      if (!key) {
        setErrorMsg("OpenCode Go API key not found")
        setLoading(false)
        return
      }

      setWindows(await fetchUsage(key, props.config))
      setErrorMsg("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error"
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), props.config.refreshMs)
    onCleanup(() => clearInterval(timer))
  })

  onMount(() => {
    const off = props.event.on("session.error", (ev) => {
      const errorData = (ev.properties?.error as
        | { data?: { statusCode?: number; metadata?: Record<string, string> } }
        | undefined)?.data
      if (errorData?.statusCode === 429 && errorData.metadata?.limitName) {
        const name = errorData.metadata.limitName.toLowerCase()
        let kind: WindowKind | undefined
        if (name.includes("hour") || name.includes("5h")) kind = "hour5"
        else if (name.includes("week")) kind = "weekly"
        else if (name.includes("month")) kind = "monthly"
        if (kind) setLimitReached((prev) => ({ ...prev, [kind]: true }))
      }
    })
    onCleanup(off)
  })

  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={palette().accent}>
          <b>OPENCODE GO</b>
        </text>
        <Show when={loading()}>
          <text fg={palette().muted}>...</text>
        </Show>
      </box>
      <Show when={errorMsg()}>
        <text fg={palette().warning}>{errorMsg()}</text>
      </Show>
      <Show when={windows().length > 0}>
        <For each={windows()}>
          {(line) => (
            <LimitRow
              palette={palette()}
              line={line}
              limitReached={!!limitReached()[line.kind]}
            />
          )}
        </For>
      </Show>
      <Show when={loading() && windows().length === 0}>
        <text fg={palette().muted}>...</text>
      </Show>
    </box>
  )
}

const DEFAULT_CONFIG: LimitsConfig = {
  provider: "opencode-go",
  baseUrl: DEFAULT_BASE_URL,
  refreshMs: REFRESH_INTERVAL_MS,
  timeoutMs: 10000,
  limits: { hour5: 12, weekly: 30, monthly: 60 },
}

const tui: TuiPlugin = (api, options) => {
  const config: LimitsConfig = {
    ...DEFAULT_CONFIG,
    ...((options ?? {}) as Partial<LimitsConfig>),
  }

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(ctx) {
        return (
          <SidebarLimits
            theme={ctx.theme.current as unknown as Record<string, unknown>}
            config={config}
            event={api.event}
          />
        )
      },
    },
  })

  return Promise.resolve()
}

export default { id: "opencode-usage-limits-sidebar", tui }
