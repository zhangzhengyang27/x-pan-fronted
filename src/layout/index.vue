<script setup>
/**
 * AppLayout —— 主布局
 * Header + (Navbar + AppMain) + Footer
 */
import {onMounted, onUnmounted, ref} from 'vue'
import AppHeader from '@/components/header/index.vue'
import AppNavbar from '@/components/navbar/index.vue'
import AppFooter from '@/components/footer/index.vue'
import AppMain from '@/components/app-main/index.vue'

/** P1.15：移动端汉堡 → 打开 Navbar 抽屉 */
const navbarRef = ref(null)
function onOpenMobileNav() {
  navbarRef.value?.openMobile?.()
}
onMounted(() => window.addEventListener('xpan:open-mobile-nav', onOpenMobileNav))
onUnmounted(() => window.removeEventListener('xpan:open-mobile-nav', onOpenMobileNav))
</script>

<template>
  <div class="h-full w-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
    <AppHeader/>
    <div class="flex-1 flex min-h-0">
      <AppNavbar ref="navbarRef"/>
      <main class="flex-1 min-w-0 flex flex-col">
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="px-3 sm:px-4 md:px-6 pb-6 pt-2 mx-auto w-full max-w-[1600px]">
            <RouterView v-slot="{Component, route}">
              <Transition name="route-fade" mode="out-in">
                <component :is="Component" :key="route.path"/>
              </Transition>
            </RouterView>
          </div>
        </div>
        <AppFooter/>
      </main>
    </div>
  </div>
</template>