import * as vscode from 'vscode'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'

const SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte', '.astro',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
])

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.output', '.nuxt', '.next',
  'coverage', '.turbo', '.cache', 'vendor', '__pycache__',
])

const ENV_PATTERNS: RegExp[] = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
  /Deno\.env\.get\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
  /os\.environ\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /os\.(?:getenv|environ\.get)\(['"]([A-Z][A-Z0-9_]*)['"]/g,
  /os\.Getenv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
]

const BUILTIN_VARS = new Set([
  'NODE_ENV', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG',
  'PWD', 'HOSTNAME', 'PORT', 'HOST', 'CI', 'TZ',
])

/**
 * Scan workspace source files for env var references.
 */
export function scanWorkspace(workspaceRoot: string, includeBuiltins: boolean): Set<string> {
  const refs = new Set<string>()

  function walk(dir: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue

      const fullPath = join(dir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(entry))) {
        scanFile(fullPath, refs)
      }
    }
  }

  walk(workspaceRoot)

  if (!includeBuiltins) {
    for (const b of BUILTIN_VARS) {
      refs.delete(b)
    }
  }

  return refs
}

function scanFile(filePath: string, refs: Set<string>): void {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return
  }

  for (const pattern of ENV_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) refs.add(match[1])
    }
  }
}

/**
 * Parse a .env file into a map of var names to line numbers.
 */
export function parseEnvDocument(text: string): Map<string, number> {
  const vars = new Map<string, number>()
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue

    const key = line.slice(0, eqIndex).trim()
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
      vars.set(key, i)
    }
  }

  return vars
}

/**
 * Parse a .env file from disk.
 */
export function parseEnvFile(filePath: string): Map<string, string> {
  const vars = new Map<string, string>()
  if (!existsSync(filePath)) return vars

  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return vars
  }

  const lines = content.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (/^[A-Z][A-Z0-9_]*$/.test(key)) {
      vars.set(key, value)
    }
  }

  return vars
}
