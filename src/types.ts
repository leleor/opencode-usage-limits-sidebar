export type WindowKind = "hour5" | "weekly" | "monthly"

export interface LimitsConfig {
  /** Provider ID to monitor. Defaults to "opencode-go". */
  provider: string
  /** API endpoint for OpenCode Go usage. */
  baseUrl: string
  /** Polling interval in milliseconds. */
  refreshMs: number
  /** Request timeout in milliseconds. */
  timeoutMs: number
  /** Dollar limits per window, used to estimate spent amounts. */
  limits: Record<WindowKind, number>
  /** Optional explicit API key (overrides auth store and env var). */
  apiKey?: string
}

export interface UsageWindow {
  status: string
  percent: number
  resetsAt: string | null
}

export interface UsageApiResponse {
  usage: {
    rolling: UsageWindow
    weekly: UsageWindow
    monthly: UsageWindow
  }
}

export interface WindowUsage {
  kind: WindowKind
  label: string
  used: number
  limit: number
  percent: number
  resetsAt: number | null
}