import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTable from '@/components/base/BaseTable.vue'

describe('BaseTable', () => {
  it('width=auto 的列使用弹性轨道，避免主列被固定列挤压', () => {
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
    expect(header.attributes('style')).toContain(
      'grid-template-columns: 56px minmax(0, 1fr) 120px'
    )
  })
})
