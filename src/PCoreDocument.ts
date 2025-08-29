import { Converter, DataForm, DataPb } from "@preventicus/pcore/"
import * as vscode from "vscode"

export class PCoreDocument implements vscode.CustomDocument {
  private _uri: vscode.Uri
  private _json: string = ""
  static allowedExtensions = [".pcore", ".json", ".pcore2"]

  private constructor(uri: vscode.Uri) {
    this._uri = uri
  }

  static async create(uri: vscode.Uri, backupUri?: vscode.Uri): Promise<PCoreDocument> {
    const uriToLoad = backupUri ?? uri
    const binary = await vscode.workspace.fs.readFile(uriToLoad)

    const ext = uriToLoad.path.slice(uriToLoad.path.lastIndexOf(".")).toLowerCase()

    if (!PCoreDocument.allowedExtensions.includes(ext)) {
      throw new Error(`Failed to open a ${ext} file. Only pcore and json are allowed.`)
    }

    let json = ""

    if (ext === ".json") {
      try {
        json = new TextDecoder().decode(binary)
      } catch {
        // nothing special should happen here. dataPb is undefined und json is presended as is.
        // This could happen if the backup json is not a valid pcore json i.e. VSC crashes in the
        // moment the user has a nonvalid json open in the editor. Or someone try to open a nonvalid
        // json.
        // The dataPb must be set in the moment the user change the json to a valid pcore json.
      }
    }

    if (ext === ".pcore" || ext === ".pcore2") {
      try {
        const dataPb = DataPb.fromBinary(binary)
        json = Converter.convertToJson(dataPb, DataForm.Decompressed, 2)
      } catch (error) {
        throw new Error(`Failed to open the pcore file. File seems to be broken. ${error}`)
      }
    }

    const document = new PCoreDocument(uri)
    document.json = json
    return document
  }

  get json(): string {
    return this._json
  }

  set json(json: string) {
    this._json = json
  }

  get dataPb(): DataPb | undefined {
    try {
      return Converter.convertFromJson(this.json)
    } catch {
      return undefined
    }
  }

  get uri(): vscode.Uri {
    return this._uri
  }

  set uri(uri: vscode.Uri) {
    this._uri = uri
  }

  get extension(): string {
    return this.uri.path.slice(this.uri.path.lastIndexOf(".")).toLowerCase()
  }
  dispose(): void {}
}