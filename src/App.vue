<template>
    <div id="app">
        <router-view v-slot="{ Component, route }">
            <Transition name="fade">
                <component :is="Component" :key="route.path"/>
            </Transition>
        </router-view>
    </div>
    <ConfirmHost/>
</template>

<script setup>
import {RouterView} from 'vue-router'
import ConfirmHost from '@/components/confirm-host/index.vue'
</script>

<style scoped>
</style>