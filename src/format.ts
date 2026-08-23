import type { RGBA } from "@opentui/core"

export type ColorValue = RGBA | string

export const USED_COLUMN_WIDTH = 5
export const RESET_COLUMN_WIDTH = 7
export const REFRESH_INTERVAL_MS = 30_000
export const SIDEBAR_ORDER = 50

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const TWO_DAYS_MS = 2 * 24 * HOUR_MS

export interface Palette {
  subtle: ColorValue
  text: ColorValue
  muted: ColorValue
  accent: ColorValue
  warning: ColorValue
}

export const getPalette = (theme: Record<string, unknown>): Palette => {
  const get = (name: string, fallback: string): ColorValue => {
    const value = theme[name]
    if (typeof value === "string") return value
    if (value && typeof value === "object") return value as RGBA
    return fallback
  }
  return {
    subtle: get("borderSubtle", "#2a2a2a"),
    text: get("text", "#f0f0f0"),
    muted: get("textMuted", "#a5a5a5"),
    accent: get("primary", "#5f87ff"),
    warning: get("warning", "#d7a94b"),
  }
}

export const formatUsd = (value: number): string => `$${value.toFixed(2)}`

export const clampedPercent = (value: number): number => {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export const resetText = (resetsAt: number | null): string => {
  if (resetsAt == null) return "--"
  const remainingMs = resetsAt - Date.now()
  if (remainingMs <= 0) return "now"
  if (remainingMs < HOUR_MS) return `${Math.max(1, Math.floor(remainingMs / MINUTE_MS))}m`
  if (remainingMs < TWO_DAYS_MS) return `${Math.floor(remainingMs / HOUR_MS)}h`
  return `${Math.floor(remainingMs / (24 * HOUR_MS))}d`
}

export const rightAlign = (value: string, width: number): string => value.padStart(width)
