import * as vscode from "vscode"
import { Converter } from "@preventicus/pcore/"
import { DataForm } from "@preventicus/pcore/"

export class PCoreEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "pcoreViewer.editor"

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Convert binary to JSON text
    //const fileContentBuffer = await vscode.workspace.fs.readFile(document.uri)
    //const jsonContent = Converter.convertToJson(fileContentBuffer, DataForm.Decompressed)
    const jsonContent = ""
    // Setup editor
    webviewPanel.webview.options = {
      enableScripts: true
    }

    webviewPanel.webview.html = this.getHtml(jsonContent)

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async message => {
      if (message.type === "save") {
        //const updatedJson = message.text
        const updatedBinary = await serializeJsonToPCore()

        const edit = new vscode.WorkspaceEdit()
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        )
        edit.replace(document.uri, fullRange, updatedBinary)
        await vscode.workspace.applyEdit(edit)
        await document.save()
      }
    })
  }

  private getHtml(json: string): string {
    const escaped = json.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return `
      <html>
      <body>
        <textarea id="editor" style="width:100%; height:90%">${escaped}</textarea>
        <button onclick="save()">Speichern</button>
        <script>
          const vscode = acquireVsCodeApi();
          function save() {
            const text = document.getElementById('editor').value;
            vscode.postMessage({ type: 'save', text });
          }
        </script>
      </body>
      </html>
    `
  }
}



async function serializeJsonToPCore(): Promise<string> {
  // TODO: Serialize to binary string (dummy example)
  return "binary-pcore-data"
}
