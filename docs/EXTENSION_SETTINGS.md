# Adding a Settings Panel to your Pi Desktop extension

Pi Desktop can render a **settings form** for your extension/skill package — no UI code required. You declare your settings *declaratively* in `package.json`, and the app renders the form, shows your README, and saves values to the user's `~/.pi/agent/settings.json` under a key you choose (the same key your extension already reads).

This is the `pi.settings` convention. It's optional and additive — extensions without it still show their README in the panel.

## Where it shows up

In Pi Desktop → **Extensions** tab → hover an installed package → **Settings**. That opens a detail view with your **documentation** (README, or a custom docs file) and an auto-generated **settings form**.

## Declare it in `package.json`

Add a `settings` block under the existing `pi` field:

```jsonc
{
  "name": "my-extension",
  "pi": {
    "extensions": ["./src/index.ts"],
    "settings": {
      "key": "my-extension",        // the settings.json key your extension reads
      "docs": "SETTINGS.md",         // optional; defaults to README.md
      "fields": [
        {
          "key": "apiKey",
          "label": "API key",
          "type": "secret",
          "description": "Your provider API key."
        },
        {
          "key": "maxResults",
          "label": "Max results",
          "type": "number",
          "default": 5
        },
        {
          "key": "mode",
          "label": "Mode",
          "type": "select",
          "options": ["fast", "balanced", "thorough"],
          "default": "balanced"
        },
        {
          "key": "verbose",
          "label": "Verbose logging",
          "type": "boolean",
          "default": false,
          "description": "Log extra detail to the diagnostics panel."
        }
      ]
    }
  }
}
```

## How values are stored

The app writes the form values into `~/.pi/agent/settings.json` under your `key`:

```json
{
  "my-extension": {
    "apiKey": "sk-…",
    "maxResults": 5,
    "mode": "balanced",
    "verbose": false
  }
}
```

Your extension reads them the way it already does (parse `settings.json`, look up your key). Nothing changes about how you consume config — Pi Desktop just gives users a friendly form to fill it in.

## Field reference

| `type`     | Renders as            | Stored value |
|------------|-----------------------|--------------|
| `string`   | Text input            | `string`     |
| `secret`   | Password input        | `string`     |
| `number`   | Number input          | `number`     |
| `boolean`  | Checkbox              | `boolean`    |
| `select`   | Dropdown (`options`)  | `string`     |

Per-field keys: `key` (required), `label`, `type`, `default`, `description`, and `options` (for `select`).

## Documentation

The panel renders Markdown from `pi.settings.docs` if set, otherwise your package `README.md`. Use a dedicated `SETTINGS.md` if you want a focused configuration reference separate from your main README.

## No `pi.settings`? Still useful

If your package doesn't declare `pi.settings`, the panel still shows your README and tells the user to edit `settings.json` directly per your docs. A few popular packages also ship with a built-in fallback schema in Pi Desktop so they get a form immediately — declaring your own `pi.settings` always takes precedence.

---

# Contributing custom UI: panels & status items

Beyond settings, your package can contribute its own **panel** (a sidebar entry that opens a custom view) and **status-bar items** — declaratively, still with no UI code. Add `pi.panels` / `pi.statusItems` to `package.json`.

```jsonc
"pi": {
  "extensions": ["./src/index.ts"],
  "panels": [{
    "id": "dashboard",                 // unique within your package
    "title": "My Dashboard",
    "icon": "📊",                       // emoji
    "sections": [
      { "type": "markdown", "content": "## Welcome\nStatus and controls below." },
      { "type": "fields", "key": "my-extension", "fields": [ /* same shape as pi.settings.fields */ ] },
      { "type": "actions", "actions": [
        { "label": "Run sync",  "command": "/my-sync" },   // runs as a chat command
        { "label": "Summarize", "prompt": "Summarize the project" }, // sends a chat prompt
        { "label": "Open docs", "url": "https://example.com" }       // opens in the OS browser
      ]},
      { "type": "list", "title": "Tips", "items": ["First tip", "Second tip"] }
    ]
  }],
  "statusItems": [
    { "id": "dash", "label": "Dashboard", "icon": "📊", "panelId": "dashboard" }
  ]
}
```

**Section types:**
- `markdown` — rendered Markdown (`content`).
- `fields` — a settings form (same field shape as `pi.settings`); `key` is the `settings.json` key it saves to. Reuses the settings form + Save.
- `actions` — buttons. Each action has a `label` and one of: `command` (runs as a chat `/command`), `prompt` (sends a chat prompt), or `url` (opens externally).
- `list` — a simple bulleted list (`items`, optional `title`).

**Status items** appear in the status bar; clicking one opens its `panelId` panel.

**Safety:** panels and status items are fully declarative — no code from your manifest executes in the app. Actions can only run a chat command/prompt, open a URL, or save config under your settings key.

Panels appear in the sidebar (and status items in the status bar) as soon as your package is installed, and disappear when it's removed.
