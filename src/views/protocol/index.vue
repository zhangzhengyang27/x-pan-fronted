<script setup lang="ts">
/**
 * Protocol —— 协议页（服务协议 / 隐私政策）
 * 通过路由参数 type 区分：
 *   /agreement  -> 服务协议
 *   /privacy    -> 隐私政策
 * 设计规范与全站令牌化风格保持一致（G6 风格）。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Home } from '@lucide/vue'

const route = useRoute()

const isPrivacy = computed(() => route.meta.type === 'privacy')

const meta = computed(() => {
  if (isPrivacy.value) {
    return {
      title: '隐私政策',
      subtitle: '我们如何收集、使用与保护您的个人信息',
      updated: '最近更新：2024 年 6 月 1 日'
    }
  }
  return {
    title: '服务协议',
    subtitle: '您使用 X Pan 分布式存储服务所须遵守的条款',
    updated: '最近更新：2024 年 6 月 1 日'
  }
})

const goHome = () => (window.location.href = '/')
const goBack = () => window.history.back()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-(--color-bg) p-gutter">
    <!-- 环境光晕 -->
    <div
      class="absolute top-[-20%] left-[-10%] size-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none"
      style="background-color: var(--color-primary-500);"
    />
    <div
      class="absolute bottom-[-20%] right-[-10%] size-[50%] rounded-full blur-[120px] opacity-10 pointer-events-none"
      style="background-color: var(--color-warning);"
    />

    <div class="relative z-10 w-full max-w-2xl">
      <!-- 顶部品牌 -->
      <div class="flex items-center gap-2 mb-6">
        <span class="text-lg font-bold tracking-tight text-(--color-text)">X Pan</span>
        <span class="text-sm text-(--color-text-muted)">· 协议中心</span>
      </div>

      <!-- 协议卡片 -->
      <div
        class="rounded-xl p-8 shadow-2xl"
        style="background: var(--color-surface-container-low); border: 1px solid var(--color-border);"
      >
        <!-- 标题区 -->
        <h1 class="text-2xl font-semibold tracking-tight text-(--color-text)">
          {{ meta.title }}
        </h1>
        <p class="text-sm mt-2 text-(--color-text-muted)">{{ meta.subtitle }}</p>
        <p class="text-xs mt-1 text-(--color-text-muted)">{{ meta.updated }}</p>

        <div class="h-px my-6" style="background-color: var(--color-border);" />

        <!-- 协议正文 -->
        <article class="space-y-5 text-sm leading-relaxed text-(--color-text)">
          <template v-if="!isPrivacy">
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">一、服务说明</h2>
              <p class="text-(--color-text-muted)">
                X Pan 为您提供个人文件的存储、管理与分享服务。您在使用本服务前，应当仔细阅读并充分理解本协议的全部内容，尤其是以加粗形式提示的责任豁免或限制条款。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">二、账户注册与安全</h2>
              <p class="text-(--color-text-muted)">
                您需对账户下的所有活动负责。请妥善保管登录凭证，因密码泄露、设备丢失等原因导致的损失，由您自行承担。我们不会对任何非因平台原因造成的损失承担责任。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">三、用户行为规范</h2>
              <p class="text-(--color-text-muted)">
                您不得利用本服务上传、存储或传播任何违法违规、侵权或危害网络安全的内容。我们有权对违规内容予以删除，并视情节暂停或终止您的账户。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">四、存储与可用性</h2>
              <p class="text-(--color-text-muted)">
                我们致力于保障服务的高可用与数据可靠，但不对不可抗力、网络故障或维护导致的临时不可用承担责任。重要数据请您自行做好备份。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">五、协议的变更</h2>
              <p class="text-(--color-text-muted)">
                我们可能适时修订本协议，修订后的协议将在本页面公示。您继续使用服务即视为接受修订内容。
              </p>
            </section>
          </template>

          <template v-else>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">一、我们收集的信息</h2>
              <p class="text-(--color-text-muted)">
                为提供存储与登录能力，我们仅收集您注册时提供的账户名、邮箱及登录设备的基础信息，不会收集与服务无关的敏感个人信息。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">二、信息的使用</h2>
              <p class="text-(--color-text-muted)">
                您的个人信息仅用于身份验证、安全防护与服务通知。我们不会向第三方出售或提供您的个人信息，法律法规另有规定的除外。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">三、数据存储与安全</h2>
              <p class="text-(--color-text-muted)">
                您的文件内容采用隔离存储，并通过传输加密与访问控制保护。我们采取合理的技术措施防范未授权访问，但无法保证绝对安全。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">四、您的权利</h2>
              <p class="text-(--color-text-muted)">
                您有权随时查询、更正或删除您的个人信息，并可在注销账户后要求我们删除相关数据。如对本政策有疑问，可通过站内反馈联系我们。
              </p>
            </section>
            <section>
              <h2 class="text-base font-semibold mb-2 text-(--color-text)">五、政策的变更</h2>
              <p class="text-(--color-text-muted)">
                本政策更新后将在本页面发布，重大变更将通过公告或邮件告知您。
              </p>
            </section>
          </template>
        </article>
      </div>

      <!-- 返回操作 -->
      <div class="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
        <button
          type="button"
          class="flex items-center justify-center gap-2 py-2.5 px-6 rounded-sm text-sm font-medium transition-colors border border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-2)"
          @click="goBack"
        >
          <ArrowLeft :size="18" :stroke-width="2" />
          返回上一页
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 py-2.5 px-6 rounded-sm text-sm font-medium transition-colors bg-primary-500 text-white hover:opacity-90"
          @click="goHome"
        >
          <Home :size="18" :stroke-width="2" />
          返回首页
        </button>
      </div>

      <p class="mt-8 text-center text-xs font-mono text-(--color-text-muted)">
        X Pan Distributed Storage • Protocol Center
      </p>
    </div>
  </div>
</template>
