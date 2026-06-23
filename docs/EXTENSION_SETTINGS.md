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
