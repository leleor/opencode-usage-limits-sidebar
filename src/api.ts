import type { LimitsConfig, UsageApiResponse, UsageWindow, WindowKind, WindowUsage } from "./types.js"

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1"

function isUsageWindow(value: unknown): value is UsageWindow {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.status === "string" &&
    typeof v.percent === "number" &&
    (typeof v.resetsAt === "string" || v.resetsAt === null)
  )
}

function isUsageApiResponse(value: unknown): value is UsageApiResponse {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  const usage = v.usage as Record<string, unknown> | undefined
  if (typeof usage !== "object" || usage === null) return false
  return (
    isUsageWindow(usage.rolling) &&
    isUsageWindow(usage.weekly) &&
    isUsageWindow(usage.monthly)
  )
}

function resetsAtMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

function toWindow(kind: WindowKind, label: string, window: UsageWindow, limit: number): WindowUsage {
  return {
    kind,
    label,
    used: (window.percent / 100) * limit,
    limit,
    percent: window.percent,
    resetsAt: resetsAtMs(window.resetsAt),
    limited: window.status === "rate-limited",
  }
}

function apiErrorMessage(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== "object" || parsed === null) return undefined

    const error = (parsed as { error?: unknown }).error
    if (typeof error === "object" && error !== null) {
      const message = (error as { message?: unknown }).message
      if (typeof message === "string" && message.length > 0) return message
    }

    const message = (parsed as { message?: unknown }).message
    if (typeof message === "string" && message.length > 0) return message
  } catch {
    // The body was not JSON.
  }
  return undefined
}

export async function fetchUsage(apiKey: string, config: LimitsConfig): Promise<WindowUsage[]> {
  const baseUrl = config.baseUrl.replace(/\/$/, "")
  const url = `${baseUrl}/usage`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const detail = apiErrorMessage(await response.text())
    if (response.status === 401) {
      throw new Error(detail ?? "Invalid OpenCode Go API key")
    }
    throw new Error(detail ?? `Usage API returned ${response.status}`)
  }

  const data: unknown = await response.json()

  if (!isUsageApiResponse(data)) {
    throw new Error("Usage API returned an unexpected shape")
  }

  return [
    toWindow("hour5", "5 hours", data.usage.rolling, config.limits.hour5),
    toWindow("weekly", "Weekly", data.usage.weekly, config.limits.weekly),
    toWindow("monthly", "Monthly", data.usage.monthly, config.limits.monthly),
  ]
}

export { DEFAULT_BASE_URL }
