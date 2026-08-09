<template>
    <div id="app">
        <router-view v-slot="{ Component, route }">
            <Transition name="fade">
                <component :is="Component" :key="route.path"/>
            </Transition>
        </router-view>
    </div>
    <ConfirmHost/>
    <ShortcutsPanel/>
</template>

<script setup>
import {RouterView} from 'vue-router'
import ConfirmHost from '@/components/confirm-host/index.vue'
import ShortcutsPanel from '@/components/base/ShortcutsPanel.vue'
</script>

<style scoped>
</style>