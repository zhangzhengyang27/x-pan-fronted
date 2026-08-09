import SparkMD5 from 'spark-md5'

/**
 * 计算文件 MD5（分片读取，避免大文件 OOM）
 * @param file 目标文件
 * @param callback 完成时回调，参数为 32 位 MD5 十六进制串；失败时第二个参数为 Error
 */
export function MD5(file: File, callback: (error: Error | null, md5?: string) => void): void {
  const chunkSize = 2 * 1024 * 1024 // 2MB
  const chunks = Math.ceil(file.size / chunkSize)
  let current = 0
  const spark = new SparkMD5.ArrayBuffer()
  const fileReader = new FileReader()

  fileReader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      spark.append((e.target as FileReader).result as ArrayBuffer)
    } catch {
      callback(new Error('读取文件失败'))
      return
    }
    current++
    if (current < chunks) {
      loadNext()
    } else {
      callback(null, spark.end())
    }
  }

  fileReader.onerror = () => {
    callback(new Error('读取文件失败'))
  }

  function loadNext(): void {
    const start = current * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    fileReader.readAsArrayBuffer(file.slice(start, end))
  }

  loadNext()
}

export default MD5
