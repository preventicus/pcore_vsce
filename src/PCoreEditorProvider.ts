import * as vscode from "vscode"
import { Converter, DataForm, DataPb } from "@preventicus/pcore/"
import { PCoreDocument } from "./PCoreDocument"

export class PCoreEditorProvider implements vscode.CustomEditorProvider<PCoreDocument> {
  public static readonly viewType = "pcoreEditor.editor"
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<PCoreDocument>>()
  private webviewPanel?: vscode.WebviewPanel
  private currentDocument?: PCoreDocument
  private currentForm: DataForm = DataForm.Decompressed

  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri, _openContext: { backupId?: string }, _token: vscode.CancellationToken): Promise<PCoreDocument> {
    try {
      return PCoreDocument.create(uri)
    } catch (error) {
      vscode.window.showErrorMessage(`${error}`)
      throw error
    }
  }

  async resolveCustomEditor(document: PCoreDocument, webviewPanel: vscode.WebviewPanel, _: vscode.CancellationToken): Promise<void> {
    this.webviewPanel = webviewPanel
    this.currentDocument = document
    this.setHtml(document.json)

    webviewPanel.webview.options = { enableScripts: true }

    webviewPanel.webview.onDidReceiveMessage(message => {
      if (message.type === "update") {
        document.json = message.text
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => {},
          redo: () => {},
          label: "JSON updated"
        })
      }
    })
  }

  toggleCompressionView(): void {
    if (!this.webviewPanel) {
      vscode.window.showErrorMessage("No webview available to toggle view.")
      return
    }

    const document = this.currentDocument as PCoreDocument
    const dataPb = document.dataPb
    if (!dataPb) {
      vscode.window.showErrorMessage("No valid DataPb loaded.")
      return
    }

    this.currentForm = this.currentForm === DataForm.Compressed ? DataForm.Decompressed : DataForm.Compressed
    const json = Converter.convertToJson(dataPb, this.currentForm, 2)
    document.json = json
    this.setHtml(json)
  }

  async saveCustomDocument(document: PCoreDocument): Promise<void> {
    const ext = document.extension
    if (ext === ".json") {
      await this.saveAsJson(document)
    }
    if (ext === ".pcore") {
      await this.saveAsPcore(document)
    }
  }

  async saveCustomDocumentAs(document: PCoreDocument, uri: vscode.Uri): Promise<void> {
    const extTarged = uri.path.slice(uri.path.lastIndexOf(".")).toLowerCase()

    if (!PCoreDocument.allowedExtensions.includes(extTarged)) {
      vscode.window.showErrorMessage("Saving is only allowed as .pcore or .json files.")
      return
    }

    if (extTarged === ".json") {
      await this.saveAsJson(document, uri)
    }
    if (extTarged === ".pcore") {
      await this.saveAsPcore(document, uri)
    }
  }

  async revertCustomDocument(document: PCoreDocument): Promise<void> {
    try {
      const binary = await vscode.workspace.fs.readFile(document.uri)
      document.dataPb = DataPb.fromBinary(binary)
      document.json = Converter.convertToJson(document.dataPb, DataForm.Decompressed, 2)
      vscode.window.showInformationMessage("Changes reverted to file content.")
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to revert document: ${error}`)
    }
  }

  async backupCustomDocument(document: PCoreDocument, documentcontext: vscode.CustomDocumentBackupContext): Promise<vscode.CustomDocumentBackup> {
    await this.saveAsJson(document, documentcontext.destination, true)
    return {
      id: documentcontext.destination.toString(),
      delete: async() => { await vscode.workspace.fs.delete(documentcontext.destination) }
    }
  }

  private async saveAsJson(document: PCoreDocument, uri: vscode.Uri = document.uri, isBackup: boolean = false): Promise<void> {
    try {
      const encoded = new TextEncoder().encode(document.json)
      await vscode.workspace.fs.writeFile(uri, encoded)
      if (document.uri !== uri && !isBackup) {
        document.uri = uri
      }
      if (!isBackup) {
        vscode.window.showInformationMessage("File was saved successfully as JSON.")
      }
    } catch (error) {
      if (!isBackup) {
        vscode.window.showErrorMessage(`JSON not valide: ${error}`)
      }
      throw error
    }
  }

  private async saveAsPcore(document: PCoreDocument, uri: vscode.Uri = document.uri): Promise<void> {
    try {
      const dataPb = Converter.convertFromJson(document.json)
      const binary = DataPb.toBinary(dataPb)
      await vscode.workspace.fs.writeFile(uri, binary)
      if (document.uri !== uri) {
        document.uri = uri
      }
      vscode.window.showInformationMessage("File was saved successfully as pcore.")
    } catch (error) {
      vscode.window.showErrorMessage(`JSON not valide: ${error}`)
      throw error
    }
  }

  private setHtml(json: string) {
    const escapedJson = json.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    this.webviewPanel!.webview.html = `
      <html>
      <head>
        <style>
          html, body, #container {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
      </head>
      <body>
        <div id="container"></div>
        <script>
          const vscode = acquireVsCodeApi();

          require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
          require(['vs/editor/editor.main'], function() {
            const editor = monaco.editor.create(document.getElementById('container'), {
              value: \`${escapedJson}\`,
              language: 'json',
              theme: 'vs-dark',
              automaticLayout: true
            });

            editor.onDidChangeModelContent(() => {
              const text = editor.getValue();
              vscode.postMessage({ type: 'update', text });
            });
          });
        </script>
      </body>
    </html>
    `
  }
}