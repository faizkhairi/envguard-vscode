import * as vscode from 'vscode'
import { createDiagnosticsProvider } from './diagnostics'
import { EnvGuardCodeActionProvider } from './actions'

export function activate(context: vscode.ExtensionContext): void {
  // Register diagnostics provider
  const diagnosticsDisposables = createDiagnosticsProvider(context)
  context.subscriptions.push(...diagnosticsDisposables)

  // Register code action provider for .env files
  const envSelector: vscode.DocumentSelector = [
    { pattern: '**/.env' },
    { pattern: '**/.env.*' },
  ]

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      envSelector,
      new EnvGuardCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  )
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
