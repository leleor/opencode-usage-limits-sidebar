import type { RGBA } from "@opentui/core"

export type ColorValue = RGBA

export const USED_COLUMN_WIDTH = 5
export const RESET_COLUMN_WIDTH = 7
export const REFRESH_INTERVAL_MS = 30_000

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const TWO_DAYS_MS = 2 * 24 * HOUR_MS

export interface ThemeTokens {
  text: {
    base: RGBA
    muted: RGBA
    action: {
      primary: {
        base: RGBA
      }
    }
    feedback: {
      warning: {
        base: RGBA
      }
      error: {
        base: RGBA
      }
    }
  }
  border: {
    base: RGBA
  }
}

export interface Palette {
  subtle: ColorValue
  text: ColorValue
  muted: ColorValue
  accent: ColorValue
  warning: ColorValue
  error: ColorValue
}

export const getPalette = (theme: ThemeTokens): Palette => {
  return {
    subtle: theme.border.base,
    text: theme.text.base,
    muted: theme.text.muted,
    accent: theme.text.action.primary.base,
    warning: theme.text.feedback.warning.base,
    error: theme.text.feedback.error.base,
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
