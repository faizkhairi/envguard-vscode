import * as vscode from 'vscode'
import { DIAGNOSTIC_SOURCE } from './diagnostics'

/**
 * Code action provider for EnvGuard diagnostics.
 * Provides quick fixes for missing env vars.
 */
export class EnvGuardCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    for (const diag of context.diagnostics) {
      if (diag.source !== DIAGNOSTIC_SOURCE) continue

      if (diag.code === 'missing') {
        // Extract variable names from the message
        const match = diag.message.match(/missing from \.env\.example: (.+)$/)
        if (match) {
          const vars = match[1].split(', ')
          for (const varName of vars) {
            const action = new vscode.CodeAction(
              `Add "${varName}" to .env.example`,
              vscode.CodeActionKind.QuickFix
            )
            action.diagnostics = [diag]
            action.edit = new vscode.WorkspaceEdit()

            // Append to end of the .env.example file
            const lastLine = document.lineAt(document.lineCount - 1)
            const insertPos = lastLine.range.end
            const newLine = lastLine.text.length > 0 ? `\n${varName}=` : `${varName}=`
            action.edit.insert(document.uri, insertPos, newLine)

            actions.push(action)
          }

          // Add all at once
          if (vars.length > 1) {
            const action = new vscode.CodeAction(
              `Add all ${vars.length} missing vars to .env.example`,
              vscode.CodeActionKind.QuickFix
            )
            action.diagnostics = [diag]
            action.edit = new vscode.WorkspaceEdit()

            const lastLine = document.lineAt(document.lineCount - 1)
            const insertPos = lastLine.range.end
            const newLines = vars.map(v => `${v}=`).join('\n')
            const prefix = lastLine.text.length > 0 ? '\n' : ''
            action.edit.insert(document.uri, insertPos, `${prefix}${newLines}`)
            action.isPreferred = true

            actions.push(action)
          }
        }
      }

      if (diag.code === 'unused') {
        const match = diag.message.match(/"([A-Z][A-Z0-9_]*)"/)
        if (match) {
          const action = new vscode.CodeAction(
            `Remove "${match[1]}" from .env.example`,
            vscode.CodeActionKind.QuickFix
          )
          action.diagnostics = [diag]
          action.edit = new vscode.WorkspaceEdit()

          // Delete the entire line
          const lineRange = document.lineAt(diag.range.start.line).rangeIncludingLineBreak
          action.edit.delete(document.uri, lineRange)

          actions.push(action)
        }
      }
    }

    return actions
  }
}
