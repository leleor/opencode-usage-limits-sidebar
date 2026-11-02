/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import {
  REFRESH_INTERVAL_MS,
  RESET_COLUMN_WIDTH,
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
}) {
  const pct = clampedPercent(props.line.percent)
  return (
    <box flexDirection="column" marginBottom={1}>
      <box flexDirection="row" width="100%">
        <box flexGrow={1}>
          <text fg={props.palette.text}>{props.line.label}</text>
        </box>
        <box width={USED_COLUMN_WIDTH} justifyContent="flex-end">
          <text fg={props.line.limited ? props.palette.warning : props.palette.text}>
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
          fg={props.line.limited ? props.palette.warning : props.palette.accent}
          bg={props.palette.subtle}
        />
      </box>
      <box marginTop={1} flexDirection="row" width="100%">
        <text fg={props.palette.muted}>
          {formatUsd(props.line.used)} / {formatUsd(props.line.limit)}
        </text>
        <Show when={props.line.limited}>
          <text fg={props.palette.warning} marginLeft={1}>
            <b>LIMIT</b>
          </text>
        </Show>
      </box>
    </box>
  )
}

function SidebarLimits(props: {
  context: Context
  config: LimitsConfig
}) {
  const palette = createMemo(() => getPalette(props.context.theme))
  const [windows, setWindows] = createSignal<WindowUsage[]>([])
  const [loading, setLoading] = createSignal(true)
  const [errorMsg, setErrorMsg] = createSignal("")
  let refreshing = false

  const refresh = async () => {
    if (refreshing) return
    refreshing = true
    try {
      const key = await resolveApiKey(props.config.provider, props.config.apiKey)
      if (!key) {
        setErrorMsg("OpenCode Go API key not found")
        return
      }

      setWindows(await fetchUsage(key, props.config))
      setErrorMsg("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error"
      setErrorMsg(message)
    } finally {
      refreshing = false
      setLoading(false)
    }
  }

  const refreshOnRateLimit = (error: { status?: number }) => {
    if (error.status === 429) void refresh()
  }

  onMount(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), props.config.refreshMs)
    const offFailed = props.context.data.on("session.execution.failed", (event) => {
      refreshOnRateLimit(event.data.error)
    })
    const offRetry = props.context.data.on("session.retry.scheduled", (event) => {
      refreshOnRateLimit(event.data.error)
    })

    onCleanup(() => {
      clearInterval(timer)
      offFailed()
      offRetry()
    })
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
        <text fg={palette().error} wrapMode="word">
          {errorMsg()}
        </text>
      </Show>
      <Show when={windows().length > 0}>
        <For each={windows()}>
          {(line) => <LimitRow palette={palette()} line={line} />}
        </For>
      </Show>
      <Show when={loading() && windows().length === 0}>
        <text fg={palette().muted}>...</text>
      </Show>
    </box>
  )
}

const DEFAULT_LIMITS: Record<WindowKind, number> = {
  hour5: 12,
  weekly: 30,
  monthly: 60,
}

const DEFAULT_CONFIG: LimitsConfig = {
  provider: "opencode-go",
  baseUrl: DEFAULT_BASE_URL,
  refreshMs: REFRESH_INTERVAL_MS,
  timeoutMs: 10000,
  limits: DEFAULT_LIMITS,
}

export default Plugin.define({
  id: "opencode-usage-limits-sidebar",
  setup(context) {
    const options = (context.options ?? {}) as Partial<LimitsConfig>
    const refreshMs =
      typeof options.refreshMs === "number" &&
      Number.isFinite(options.refreshMs) &&
      options.refreshMs >= 1000
        ? options.refreshMs
        : DEFAULT_CONFIG.refreshMs

    const config: LimitsConfig = {
      ...DEFAULT_CONFIG,
      ...options,
      refreshMs,
      limits: { ...DEFAULT_LIMITS, ...(options.limits ?? {}) },
    }

    return context.ui.slot({
      append: "sidebar.content",
      render: () => <SidebarLimits context={context} config={config} />,
    })
  },
})
