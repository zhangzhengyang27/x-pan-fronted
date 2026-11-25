import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTable from '@/components/base/BaseTable.vue'

describe('BaseTable', () => {
  it('width=auto 的列使用弹性轨道，并给主列保留最小可读宽度', () => {
    const wrapper = mount(BaseTable, {
      props: {
        columns: [
          { key: 'filename', title: '文件名', width: 'auto' },
          { key: 'size', title: '大小', width: 120 }
        ],
        data: [],
        selectable: true
      }
    })

    const header = wrapper.find('.grid')
    expect(header.classes()).toContain('sticky')
    expect(header.attributes('style')).toContain('grid-template-columns: 56px minmax(0, 1fr) 120px')

    // 56 选择列 + 120 固定列 + 180 弹性列最小宽度
    const inner = wrapper.find('[style*="min-width"]')
    expect(inner.attributes('style')).toContain('min-width: 356px')
  })
})
