import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export interface AuthEntry {
  key?: string
  apiKey?: string
  access?: string
  token?: string
  type?: string
}

export interface AuthStore {
  [providerId: string]: AuthEntry | AuthEntry[] | undefined
}

function candidateAuthPaths(): string[] {
  const home = homedir()
  const platform = process.platform
  const paths: string[] = []

  if (platform === "win32") {
    paths.push(join(home, ".local", "share", "opencode", "auth.json"))
    const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local")
    paths.push(join(localAppData, "opencode", "auth.json"))
    paths.push(join(home, "AppData", "Roaming", "opencode", "auth.json"))
  } else if (platform === "darwin") {
    paths.push(join(home, ".local", "share", "opencode", "auth.json"))
    paths.push(join(home, "Library", "Application Support", "opencode", "auth.json"))
  } else {
    const dataHome = process.env.XDG_DATA_HOME ?? join(home, ".local", "share")
    paths.push(join(dataHome, "opencode", "auth.json"))
  }

  return paths
}

async function readAuthStore(): Promise<AuthStore | undefined> {
  for (const path of candidateAuthPaths()) {
    try {
      if (!existsSync(path)) continue
      const raw = await readFile(path, "utf-8")
      return JSON.parse(raw) as AuthStore
    } catch {
      // Try the next candidate path.
    }
  }
  return undefined
}

function extractKey(entry: AuthEntry | undefined): string | undefined {
  if (!entry) return undefined
  const candidates = [entry.key, entry.apiKey, entry.access, entry.token]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate
    }
  }
  return undefined
}

export async function resolveApiKey(provider: string, explicitKey?: string): Promise<string | undefined> {
  if (explicitKey) {
    return explicitKey
  }

  const envVar = process.env.OPENCODE_GO_API_KEY ?? process.env[`${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`]
  if (envVar) {
    return envVar
  }

  const store = await readAuthStore()
  if (!store) {
    return undefined
  }

  const entry = store[provider]
  if (Array.isArray(entry)) {
    for (const item of entry) {
      const key = extractKey(item)
      if (key) return key
    }
  } else {
    const key = extractKey(entry)
    if (key) return key
  }

  return undefined
}