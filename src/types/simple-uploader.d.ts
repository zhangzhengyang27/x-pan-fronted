/**
 * simple-uploader.js 最小类型声明
 * 仅覆盖本项目实际使用到的 API（Uploader / File / 事件回调）
 */
declare module 'simple-uploader.js' {
  export interface UploaderFile {
    id: string
    name: string
    size: number
    type: string
    relativePath: string
    uniqueIdentifier: string
    averageSpeed: number
    currentSpeed: number
    chunks: UploaderChunk[]
    paused: boolean
    error: boolean
    file: File

    pause(): void
    resume(): void
    cancel(): void
    retry(): void
    bootstrap(): void
    isUploading(): boolean
    isComplete(): boolean
    progress(): number
    sizeUploaded(): number
    timeRemaining(): number

    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler?: (...args: any[]) => void): void
  }

  export interface UploaderChunk {
    offset: number
    size: number
    file: UploaderFile
  }

  export interface UploaderOptions {
    target: string | ((file: UploaderFile, chunk: UploaderChunk) => string)
    singleFile?: boolean
    chunkSize?: number
    forceChunkSize?: boolean
    simultaneousUploads?: number
    fileParameterName?: string
    query?: Record<string, unknown> | (() => Record<string, unknown>)
    headers?: Record<string, string> | (() => Record<string, string>)
    withCredentials?: boolean
    method?: string
    testChunks?: boolean
    generateUniqueIdentifier?: (file: UploaderFile) => string
    checkChunkUploadedByResponse?: (chunk: UploaderChunk, message: string) => boolean
    maxChunkRetries?: number
    chunkRetryInterval?: number | null
    progressCallbacksInterval?: number
    successStatuses?: number[]
    permanentErrors?: number[]
    initialPaused?: boolean
    allowDuplicateUploads?: boolean
    processResponse?: (response: string, file: UploaderFile) => string
  }

  export default class Uploader {
    constructor(options?: UploaderOptions)

    files: UploaderFile[]
    support: boolean
    opts: UploaderOptions

    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler?: (...args: any[]) => void): void

    addFile(file: File): void
    addFiles(files: FileList | File[]): void
    removeFile(file: UploaderFile): void
    cancel(): void
    upload(): void
    pause(): void
    resume(): void

    /** 事件名常量 */
    static STATUS: Record<string, number>
  }
}
