import * as vscode from "vscode"
import { PCoreEditorProvider } from "./PCoreEditorProvider"

export function activate(context: vscode.ExtensionContext) {
  const provider = new PCoreEditorProvider(context)

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "pcoreEditor.editor", provider,
      { supportsMultipleEditorsPerDocument: false }
    )
  )

  // Register welcome view button command
  context.subscriptions.push(
    vscode.commands.registerCommand("pcoreEditor.openPcoreFile", async() => {
      const files = await vscode.window.showOpenDialog({
        filters: { "pcore files": ["pcore", "json"] },
        canSelectMany: false
      })
      if (files && files[0]) {
        vscode.commands.executeCommand("vscode.openWith", files[0], "pcoreEditor.editor")
      }
    })
  )

  // Register editor toolbar button command
  context.subscriptions.push(
    vscode.commands.registerCommand("pcoreEditor.doSomethingWithOpenFile", () => {
      provider.toggleCompressionView()
    })
  )

  // Register file context menu command
  context.subscriptions.push(
    vscode.commands.registerCommand("pcoreEditor.contextOpenPcore", (uri: vscode.Uri) => {
      vscode.commands.executeCommand("vscode.openWith", uri, "pcoreEditor.editor")
    })
  )
}

export function deactivate() {}
