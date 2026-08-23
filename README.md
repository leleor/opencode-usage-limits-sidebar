# opencode-usage-limits-sidebar

OpenCode TUI plugin that shows your **OpenCode Go** subscription usage directly in the right sidebar, using the official usage API.

It displays the three plan windows — **5 hours**, **weekly** and **monthly** — with a progress bar, spent/limit amounts in USD and the estimated reset time.

## Features

- **3 usage windows** — 5 hours ($12), Weekly ($30) and Monthly ($60) limits
- **Progress bar** per window with percentage used
- **Spent / limit** amounts in USD
- **Estimated reset** time for each window
- **Auto-refresh** every 30 seconds (configurable)
- **Limit reached detection** — marks the window as `LIMIT` when the gateway returns HTTP 429 with a `limitName` metadata
- **Theme aware** — colors follow the active OpenCode theme

## Requirements

- OpenCode >= 1.3.13
- Active OpenCode Go subscription and API key

## Installation

### From GitHub

Add the repository to your TUI config `~/.config/opencode/tui.json`:

```json
{
  "plugin": ["git+https://github.com/leleor/opencode-usage-limits-sidebar.git"]
}
```

The package builds itself on install (the `prepare` script compiles the plugin automatically). OpenCode must have Git available on your system.

Restart OpenCode. The `OPENCODE GO` block appears in the sidebar.

### From source

```shell
git clone https://github.com/leleor/opencode-usage-limits-sidebar.git
cd opencode-usage-limits-sidebar
npm install
npm run build
opencode plugin "$PWD" -g
```

Restart OpenCode.

## Usage

No configuration is required — the plugin reads your OpenCode Go API key from OpenCode's auth store (`~/.local/share/opencode/auth.json`) and queries the official usage endpoint.

To customize, add options to the plugin entry in your `tui.json`:

```json
{
  "plugin": [
    ["opencode-usage-limits-sidebar", {
      "baseUrl": "https://opencode.ai/zen/go/v1",
      "refreshMs": 30000,
      "timeoutMs": 10000,
      "limits": { "hour5": 12, "weekly": 30, "monthly": 60 }
    }]
  ]
}
```

### Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | `opencode-go` | Provider ID used to look up the API key in OpenCode's auth store |
| `baseUrl` | string | `https://opencode.ai/zen/go/v1` | Base URL of the OpenCode Go usage API |
| `refreshMs` | number | `30000` | Polling interval in milliseconds |
| `timeoutMs` | number | `10000` | Request timeout in milliseconds |
| `limits` | object | `{ hour5: 12, weekly: 30, monthly: 60 }` | Dollar limits per window, used to estimate spent amounts |
| `apiKey` | string | — | Optional explicit API key (overrides auth store and env var) |

### API key resolution order

1. `apiKey` option in the plugin config
2. `OPENCODE_GO_API_KEY` environment variable
3. OpenCode auth store at `~/.local/share/opencode/auth.json` (provider `opencode-go`)

## How it works

The plugin queries the OpenCode Go usage API:

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer <OpenCode Go API key>
```

The API returns the percentage used and reset time for each window:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 8, "resetsAt": "2026-08-23T14:51:11.331Z" },
    "weekly":  { "status": "ok", "percent": 43, "resetsAt": "2026-08-24T00:00:00.331Z" },
    "monthly": { "status": "ok", "percent": 21, "resetsAt": "2026-09-21T15:03:08.331Z" }
  }
}
```

The plugin uses the plan limits ($12 / $30 / $60) to estimate the spent amount from the reported percentage. The limits are configurable via the `limits` option if they change.

## Project structure

```
src/
  index.tsx    TUI entry — sidebar slot, polling, 429 detection
  api.ts       OpenCode Go usage API client
  auth.ts      API key resolver (auth store / env / options)
  format.ts    Theme palette, formatting, percentage and reset helpers
  types.ts     TypeScript interfaces
  server.ts    Server plugin entry
```

## Development

```shell
npm install
npm run typecheck
npm run build
npm test
```

## License

MIT