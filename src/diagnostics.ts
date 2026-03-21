import * as vscode from 'vscode'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { scanWorkspace, parseEnvDocument, parseEnvFile } from './scanner'

export const DIAGNOSTIC_SOURCE = 'envguard'

export function createDiagnosticsProvider(context: vscode.ExtensionContext): vscode.Disposable[] {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE)
  const disposables: vscode.Disposable[] = [diagnosticCollection]

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleUpdate(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => updateDiagnostics(diagnosticCollection), 500)
  }

  // Trigger on file changes
  disposables.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isEnvFile(doc.fileName) || isSourceFile(doc.fileName)) {
        scheduleUpdate()
      }
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isEnvFile(doc.fileName)) {
        scheduleUpdate()
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isEnvFile(e.document.fileName)) {
        scheduleUpdate()
      }
    }),
    vscode.workspace.onDidDeleteFiles(() => scheduleUpdate()),
    vscode.workspace.onDidCreateFiles(() => scheduleUpdate()),
  )

  // Initial run
  scheduleUpdate()

  return disposables
}

function updateDiagnostics(collection: vscode.DiagnosticCollection): void {
  collection.clear()

  const config = vscode.workspace.getConfiguration('envguard')
  if (!config.get('enable', true)) return

  const includeBuiltins = config.get('includeBuiltins', false)
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) return

  for (const folder of workspaceFolders) {
    const root = folder.uri.fsPath

    // Scan source files for env var references
    const codeRefs = scanWorkspace(root, includeBuiltins)

    // Find env files
    const envExamplePath = findEnvExample(root)
    const envPath = join(root, '.env')

    const envVars = existsSync(envPath) ? parseEnvFile(envPath) : new Map<string, string>()
    const exampleVars = envExamplePath ? parseEnvFile(envExamplePath) : null

    // Diagnose .env.example if it exists
    if (envExamplePath && exampleVars) {
      const uri = vscode.Uri.file(envExamplePath)
      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === envExamplePath)
      const text = doc ? doc.getText() : require('fs').readFileSync(envExamplePath, 'utf-8')
      const parsedLines = parseEnvDocument(text)
      const diagnostics: vscode.Diagnostic[] = []

      // Unused: in .env.example but not in code
      for (const [varName, lineNum] of parsedLines) {
        if (!codeRefs.has(varName)) {
          const line = text.split('\n')[lineNum]
          const range = new vscode.Range(lineNum, 0, lineNum, line.length)
          const diag = new vscode.Diagnostic(
            range,
            `"${varName}" is defined in .env.example but never referenced in code`,
            vscode.DiagnosticSeverity.Warning
          )
          diag.source = DIAGNOSTIC_SOURCE
          diag.code = 'unused'
          diagnostics.push(diag)
        }
      }

      // Missing: in code but not in .env.example (add as info at top of file)
      const missingVars = [...codeRefs].filter(v => !exampleVars.has(v))
      if (missingVars.length > 0) {
        const range = new vscode.Range(0, 0, 0, 0)
        const diag = new vscode.Diagnostic(
          range,
          `${missingVars.length} env var(s) referenced in code but missing from .env.example: ${missingVars.join(', ')}`,
          vscode.DiagnosticSeverity.Error
        )
        diag.source = DIAGNOSTIC_SOURCE
        diag.code = 'missing'
        diagnostics.push(diag)
      }

      if (diagnostics.length > 0) {
        collection.set(uri, diagnostics)
      }
    }

    // Diagnose .env if it exists
    if (existsSync(envPath)) {
      const uri = vscode.Uri.file(envPath)
      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === envPath)
      const text = doc ? doc.getText() : require('fs').readFileSync(envPath, 'utf-8')
      const parsedLines = parseEnvDocument(text)
      const diagnostics: vscode.Diagnostic[] = []

      for (const [varName, lineNum] of parsedLines) {
        const line = text.split('\n')[lineNum]
        const eqIndex = line.indexOf('=')
        const value = eqIndex >= 0 ? line.slice(eqIndex + 1).trim() : ''

        // Empty value
        if (value === '' || value === '""' || value === "''") {
          const range = new vscode.Range(lineNum, 0, lineNum, line.length)
          const diag = new vscode.Diagnostic(
            range,
            `"${varName}" has no value`,
            vscode.DiagnosticSeverity.Warning
          )
          diag.source = DIAGNOSTIC_SOURCE
          diag.code = 'empty'
          diagnostics.push(diag)
        }

        // Undocumented: in .env but not in .env.example
        if (exampleVars && !exampleVars.has(varName)) {
          const range = new vscode.Range(lineNum, 0, lineNum, line.length)
          const diag = new vscode.Diagnostic(
            range,
            `"${varName}" is not documented in .env.example`,
            vscode.DiagnosticSeverity.Information
          )
          diag.source = DIAGNOSTIC_SOURCE
          diag.code = 'undocumented'
          diagnostics.push(diag)
        }
      }

      if (diagnostics.length > 0) {
        collection.set(uri, diagnostics)
      }
    }
  }
}

function findEnvExample(root: string): string | null {
  for (const name of ['.env.example', '.env.sample', '.env.template']) {
    const p = join(root, name)
    if (existsSync(p)) return p
  }
  return null
}

function isEnvFile(fileName: string): boolean {
  const base = basename(fileName)
  return base.startsWith('.env')
}

function isSourceFile(fileName: string): boolean {
  const ext = fileName.split('.').pop() || ''
  return ['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte', 'py', 'go'].includes(ext)
}
