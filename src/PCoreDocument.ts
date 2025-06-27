import { DataPb } from "@preventicus/pcore/"
import * as vscode from "vscode"

export class PCoreDocument implements vscode.CustomDocument {
  readonly uri: vscode.Uri
  readonly dataPb: DataPb
  private currentJson: string = ""

  private constructor(uri: vscode.Uri, dataPb: DataPb) {
    this.uri = uri
    this.dataPb = dataPb
  }

  static async create(uri: vscode.Uri): Promise<PCoreDocument> {
    const binary = await vscode.workspace.fs.readFile(uri)
    return new PCoreDocument(uri, DataPb.fromBinary(binary))
  }

  getBinary(): Uint8Array {
    return (this.dataPb as unknown) as Uint8Array
  }

  updateBinary(dataPb: DataPb) {
    this.dataPb = dataPb
  }

  getCurrentJson(): string {
    return this.currentJson
  }

  updateJson(json: string) {
    this.currentJson = json
  }

  dispose(): void {}
}