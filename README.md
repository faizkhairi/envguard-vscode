# EnvGuard for VS Code

Inline diagnostics for environment variables -- find missing, unused, and undocumented env vars without leaving your editor.

## Features

- **Missing vars** -- env vars referenced in code but not in `.env.example` (error)
- **Unused vars** -- vars in `.env.example` but never referenced in code (warning)
- **Undocumented vars** -- vars in `.env` but not in `.env.example` (info)
- **Empty vars** -- vars defined in `.env` with no value (warning)
- **Quick fixes** -- add missing vars to `.env.example` with one click
- **Multi-language** -- scans `.ts`, `.js`, `.vue`, `.svelte`, `.py`, `.go`, and more

## How It Works

EnvGuard scans your source files for env var patterns (`process.env.X`, `import.meta.env.X`, etc.) and compares them against your `.env` and `.env.example` files. Issues appear as inline diagnostics in your editor.

### Detected Patterns

| Pattern | Runtime |
|---------|---------|
| `process.env.VAR` | Node.js |
| `process.env['VAR']` | Node.js |
| `import.meta.env.VAR` | Vite, Nuxt, Astro |
| `Deno.env.get('VAR')` | Deno |
| `os.environ['VAR']` | Python |
| `os.Getenv("VAR")` | Go |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `envguard.enable` | `true` | Enable/disable diagnostics |
| `envguard.includeBuiltins` | `false` | Include NODE_ENV, PATH, etc. |

## CLI Companion

For CI pipelines, use the [envguard CLI](https://www.npmjs.com/package/@faizkhairi/envguard):

```bash
npm install -g @faizkhairi/envguard
envguard  # exits with code 1 if missing vars found
```

## License

MIT
