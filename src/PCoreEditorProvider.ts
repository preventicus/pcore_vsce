import * as vscode from "vscode"
import { Converter, DataForm, DataPb } from "@preventicus/pcore/"
import { PCoreDocument } from "./PCoreDocument"
import { Inspector } from "@preventicus/pcore"

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
        this.sendInspectorDataToWebview(document.dataPb)
        this._onDidChangeCustomDocument.fire({
          document,
          undo: () => {},
          redo: () => {},
          label: "JSON updated"
        })
      }
      else if (message.type === "editorWebviewReady") {
        if (this.currentDocument?.dataPb) {
          this.sendInspectorDataToWebview(this.currentDocument.dataPb)
        }
      }
    })
  }

  async saveCustomDocument(document: PCoreDocument): Promise<void> {
    const ext = document.extension
    if (ext === ".json") {
      await this.saveAsJson(document)
    }
    if (ext === ".pcore" || ext === ".pcore2") {
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
    if (extTarged === ".pcore" || extTarged === ".pcore2") {
      await this.saveAsPcore(document, uri)
    }
  }

  async revertCustomDocument(document: PCoreDocument): Promise<void> {
    try {
      const binary = await vscode.workspace.fs.readFile(document.uri)
      const dataPb = DataPb.fromBinary(binary)
      document.json = Converter.convertToJson(dataPb, DataForm.Decompressed, 2)
      this.setHtml(document.json)
      this.sendInspectorDataToWebview(document.dataPb)
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
        vscode.window.showErrorMessage(`JSON not valid: ${error}`)
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

  private sendInspectorDataToWebview(dataPb?: DataPb) {
    if (!this.webviewPanel) {
      return
    }

    if (dataPb === undefined) {
      this.webviewPanel.webview.postMessage({
        command: "updateInspectorData",
        data: null
      })
      return
    }

    const firstTimeStamp = Inspector.getFirstUnixTimestamp(dataPb)
    const lastTimeStamp = Inspector.getLastUnixTimestamp(dataPb)
    const numberOfElements = Inspector.getNumberOfElements(dataPb)
    const numberOfSections = Inspector.getNumberOfSections(dataPb)

    let meanSampleRate = 0
    const timeDiffMs = lastTimeStamp - firstTimeStamp
    if (timeDiffMs > 0) {
      meanSampleRate = numberOfElements / (timeDiffMs / 1000)
    }

    this.webviewPanel.webview.postMessage({ command: "updateInspectorData", data: {
      firstTimeStamp: firstTimeStamp,
      lastTimeStamp: lastTimeStamp,
      numberOfElements: numberOfElements,
      numberOfSections: numberOfSections,
      meanSampleRate: meanSampleRate.toFixed(2)
    } })
  }

  private setHtml(json: string) {
    const escapedJson = json.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    this.webviewPanel!.webview.html = `
      <html>
      <head>
        <style>
          html, body, #editor-container {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
          }

          .monaco-editor .my-overlay-widget {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 30px;
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            padding: 0 10px;
            font-family: sans-serif;
            font-size: 13px;
            border-bottom: 1px solid var(--vscode-editorGroup-border);
            z-index: 10;
          }

          .monaco-editor .my-overlay-widget span {
              margin-right: 15px;
              white-space: nowrap;
              font-size: 11px;
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
      </head>
      <body>
        <div id="editor-container"></div>

        <script>
          const vscode = acquireVsCodeApi();
          let editor;
          let infoWidget;

          require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
          require(['vs/editor/editor.main'], function() {
            editor = monaco.editor.create(document.getElementById('editor-container'), {
              value: \`${escapedJson}\`,
              language: 'json',
              theme: 'vs-dark', // oder 'vs', 'hc-black'
              automaticLayout: true,
              padding: { top: 30 }
            });

            const widgetDomNode = document.createElement('div');
            widgetDomNode.className = 'my-overlay-widget';
            widgetDomNode.innerHTML = \`
                <span id="firstTimestamp">First TS: N/A</span>
                <span id="lastTimestamp">Last TS: N/A</span>
                <span id="numberOfElements">Elements: N/A</span>
                <span id="numberOfSections">Sections: N/A</span>
                <span id="meanSampleRate">Sample Rate: N/A Hz</span>
            \`;

            infoWidget = {
              getId: function() { return 'my.pcore.inspector.widget'; },
              getDomNode: function() { return widgetDomNode; },
              getPosition: function() {
                return {
                  preference: monaco.editor.OverlayWidgetPositionPreference.TOP_RIGHT_CORNER
                };
              }
            };

            editor.addOverlayWidget(infoWidget);

            editor.onDidChangeModelContent(() => {
              const text = editor.getValue();
              vscode.postMessage({ type: 'update', text });
            });

            vscode.postMessage({ type: 'editorWebviewReady' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateInspectorData') {
              const data = message.data;
              if (!data) {
                document.getElementById('firstTimestamp').textContent = 'Not a valid PCore file';
                document.getElementById('lastTimestamp').textContent = '';
                document.getElementById('numberOfElements').textContent = '';
                document.getElementById('numberOfSections').textContent = '';
                document.getElementById('meanSampleRate').textContent = '';
                return;
              }

              const formatDateTime = (unixMs) => {
                const date = new Date(unixMs);
                const pad = n => n.toString().padStart(2, '0');
                const padMs = ms => ms.toString().padStart(3, '0');
                return \`\${date.getFullYear()}-\${pad(date.getMonth() + 1)}-\${pad(date.getDate())} \`
                    + \`\${pad(date.getHours())}:\${pad(date.getMinutes())}:\${pad(date.getSeconds())}.\${padMs(date.getMilliseconds())}\`;
              };

              document.getElementById('firstTimestamp').textContent =
                \`Start Date: \${formatDateTime(data.firstTimeStamp)}\`;
              document.getElementById('lastTimestamp').textContent =
                \`End Date: \${formatDateTime(data.lastTimeStamp)}\`;
              document.getElementById('numberOfElements').textContent =
                \`Elements: \${data.numberOfElements}\`;
              document.getElementById('numberOfSections').textContent =
                \`Sections: \${data.numberOfSections}\`;
              document.getElementById('meanSampleRate').textContent =
                \`Mean Sample Rate: \${data.meanSampleRate} Hz\`;
            }
          });
        </script>
      </body>
    </html>
    `
  }
}