/**
 * usePdfSearch —— PDF 文本搜索（P1.11）
 * 1. 用 pdfjs-dist 加载 PDF 文档
 * 2. 提取每页文本内容到缓存
 * 3. 提供 search(keyword) 接口：返回 [{ page, snippet, matchCount }]
 */
import {ref, shallowRef} from 'vue'

const textCache = new WeakMap() // pdfDoc → Map<pageNum, string>
const MAX_PAGES = 200

export function usePdfSearch() {
  const pdfDoc = shallowRef(null)
  const loading = ref(false)
  const error = ref('')

  async function load(url) {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      const lib = await import('pdfjs-dist/build/pdf.mjs')
      // worker 配置（生产环境需要把 worker 文件放到 public）
      // const workerSrc = (await import('pdfjs-dist/build/pdf.worker.mjs')).default
      // lib.GlobalWorkerOptions.workerSrc = workerSrc
      lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs'
      const doc = await lib.getDocument({url}).promise
      pdfDoc.value = doc
      // 预提取前 50 页文本
      const pagesToCache = Math.min(doc.numPages, 50)
      const cache = new Map()
      for (let i = 1; i <= pagesToCache; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        cache.set(i, content.items.map((it) => it.str).join(' '))
      }
      textCache.set(doc, cache)
      return doc
    } catch (e) {
      error.value = e?.message || 'PDF 加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function search(keyword) {
    if (!pdfDoc.value || !keyword) return []
    const cache = textCache.get(pdfDoc.value)
    if (!cache) return []
    const lower = keyword.toLowerCase()
    const results = []
    for (const [pageNum, text] of cache.entries()) {
      const lowerText = text.toLowerCase()
      let idx = lowerText.indexOf(lower)
      let count = 0
      while (idx !== -1) {
        count++
        const start = Math.max(0, idx - 30)
        const end = Math.min(text.length, idx + keyword.length + 30)
        const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
        results.push({page: pageNum, snippet, matchIndex: idx})
        idx = lowerText.indexOf(lower, idx + keyword.length)
      }
      if (count > 0) {
        results.push({page: pageNum, count, snippet: results[results.length - 1]?.snippet})
      }
    }
    return results
  }

  return {pdfDoc, loading, error, load, search}
}