import * as vscode from "vscode"
import { PCoreEditorProvider } from "./PCoreEditorProvider"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "pcoreEditor.editor",
      new PCoreEditorProvider(context),
      { supportsMultipleEditorsPerDocument: false }
    )
  )

  // Register welcome view button command
  context.subscriptions.push(
    vscode.commands.registerCommand("pcoreEditor.openPcoreFile", async() => {
      const files = await vscode.window.showOpenDialog({
        filters: { "pcore files": ["pcore"] },
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
      vscode.window.showInformationMessage("Action on pcore file executed.")
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
