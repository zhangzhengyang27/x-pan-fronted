declare module 'pdfjs-dist/build/pdf.mjs' {
  export interface PDFDocumentProxy {
    numPages: number
    getPage(pageNumber: number): Promise<PDFPageProxy>
  }
  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>
  }
  export interface TextContent {
    items: Array<{ str: string; [key: string]: unknown }>
  }
  export interface DocumentInitParameters {
    url: string
    data?: ArrayBuffer | Uint8Array
    [key: string]: unknown
  }
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(params: DocumentInitParameters): {
    promise: Promise<PDFDocumentProxy>
  }
}
