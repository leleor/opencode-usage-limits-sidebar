import { describe, expect, it } from "vitest"
import { fetchUsage } from "./api.js"
import type { LimitsConfig } from "./types.js"

const config: LimitsConfig = {
  provider: "opencode-go",
  baseUrl: "https://opencode.ai/zen/go/v1",
  refreshMs: 30000,
  timeoutMs: 10000,
  limits: { hour5: 12, weekly: 30, monthly: 60 },
}

describe("fetchUsage response parsing", () => {
  it("parses a valid usage response into three windows", async () => {
    const resetsAt = new Date(Date.now() + 7200 * 1000).toISOString()
    const body = {
      usage: {
        rolling: { status: "ok", percent: 19.5, resetsAt },
        weekly: { status: "ok", percent: 29.7, resetsAt },
        monthly: { status: "rate-limited", percent: 100, resetsAt },
      },
    }

    globalThis.fetch = (async () =>
      Response.json(body, { status: 200 })) as unknown as typeof fetch

    const windows = await fetchUsage("sk-test", config)

    expect(windows).toHaveLength(3)
    expect(windows[0].kind).toBe("hour5")
    expect(windows[0].percent).toBe(19.5)
    expect(windows[0].used).toBeCloseTo(2.34)
    expect(windows[0].limit).toBe(12)
    expect(windows[0].resetsAt).toBeGreaterThan(Date.now())
    expect(windows[0].limited).toBe(false)

    expect(windows[1].kind).toBe("weekly")
    expect(windows[1].used).toBeCloseTo(8.91)
    expect(windows[2].kind).toBe("monthly")
    expect(windows[2].used).toBeCloseTo(60.0)
    expect(windows[2].limited).toBe(true)
  })

  it("throws when the response shape is unexpected", async () => {
    globalThis.fetch = (async () =>
      Response.json({ invalid: true }, { status: 200 })) as unknown as typeof fetch

    await expect(fetchUsage("sk-test", config)).rejects.toThrow("unexpected shape")
  })

  it("throws the API error message on 401", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        {
          error: {
            type: "authentication_error",
            code: "api_key_expired",
            message: "This API key has expired.",
          },
        },
        { status: 401 },
      )) as unknown as typeof fetch

    await expect(fetchUsage("sk-test", config)).rejects.toThrow("This API key has expired.")
  })

  it("throws a generic error when a 401 has no JSON body", async () => {
    globalThis.fetch = (async () =>
      new Response("Unauthorized", { status: 401 })) as unknown as typeof fetch

    await expect(fetchUsage("sk-test", config)).rejects.toThrow("Invalid OpenCode Go API key")
  })
})
