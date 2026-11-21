import { describe, expect, it } from 'vitest'
import { useBreakpoint } from '@/composables/useMediaQuery'

describe('useBreakpoint', () => {
  it('Web 端固定为桌面断点，窄视口也不降级为移动布局', () => {
    const { isMobile, isTablet, isDesktop } = useBreakpoint()

    expect(isMobile.value).toBe(false)
    expect(isTablet.value).toBe(false)
    expect(isDesktop.value).toBe(true)
  })
})
