<script setup>
/**
 * AppLayout —— 主布局
 * Header + (Navbar + AppMain) + Footer
 */
import AppHeader from '@/components/header/index.vue'
import AppNavbar from '@/components/navbar/index.vue'
import AppFooter from '@/components/footer/index.vue'
import AppMain from '@/components/app-main/index.vue'
</script>

<template>
  <div class="h-full w-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
    <AppHeader/>
    <div class="flex-1 flex min-h-0">
      <AppNavbar/>
      <main class="flex-1 min-w-0 flex flex-col">
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="px-6 pb-6 pt-2 mx-auto w-full max-w-[1600px]">
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