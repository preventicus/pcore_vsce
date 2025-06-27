import * as vscode from "vscode"
import { Converter, DataForm } from "@preventicus/pcore/"
import { PCoreDocument } from "./PCoreDocument"

export class PCoreEditorProvider implements vscode.CustomEditorProvider<PCoreDocument> {
  public static readonly viewType = "pcoreEditor.editor"
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<PCoreDocument>>()

  constructor(private readonly context: vscode.ExtensionContext) {
    console.log("PCoreEditorProvider initialized")
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<PCoreDocument> {
    return PCoreDocument.create(uri)
  }

  async resolveCustomEditor(
    document: PCoreDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const jsonContent = Converter.convertToJson(document.dataPb, DataForm.Decompressed, 2)

    webviewPanel.webview.options = {
      enableScripts: true
    }

    webviewPanel.webview.html = this.getHtml(jsonContent)

    webviewPanel.webview.onDidReceiveMessage(async message => {
      if (message.type === "update") {
        document.updateJson(message.text)
      }
    })
  }

  async saveCustomDocument(document: PCoreDocument): Promise<void> {

    const dataPb = Converter.convertFromJson()



    await vscode.workspace.fs.writeFile(document.uri, document.getBinary())
  }

  async saveCustomDocumentAs(document: PCoreDocument, targetResource: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.writeFile(targetResource, document.getBinary())
  }

  async revertCustomDocument(document: PCoreDocument): Promise<void> {
    console.log(document)
    // const binary = await vscode.workspace.fs.readFile(document.uri)
    // document.updateBinary(binary)
  }

  async backupCustomDocument(document: PCoreDocument, context: vscode.CustomDocumentBackupContext): Promise<vscode.CustomDocumentBackup> {
    await vscode.workspace.fs.writeFile(context.destination, document.getBinary())
    return {
      id: context.destination.toString(),
      delete: async() => { await vscode.workspace.fs.delete(context.destination) }
    }
  }

  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event

  private getHtml(json: string): string {
    const escapedJson = json.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `
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
            require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
            require(['vs/editor/editor.main'], function() {
              const editor = monaco.editor.create(document.getElementById('container'), {
                value: \`${escapedJson}\`,
                language: 'json',
                theme: 'vs-dark',
                automaticLayout: true
              });

              window.save = function () {
                const text = editor.getValue();
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ type: 'save', text });
              };
            });
          </script>
          <button onclick="save()">Speichern</button>
        </body>
      </html>
    `
  }
}