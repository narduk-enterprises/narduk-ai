<script setup lang="ts">
/**
 * Custom Application Shell — overrides the layer's app.vue.
 * Uses UApp directly with custom header/footer components.
 */
const route = useRoute()
const showFooter = computed(() => route.path !== '/chat' && !route.path.startsWith('/presets/'))

// Full-height pages manage their own scroll — prevent outer container from scrolling
const isFullHeightPage = computed(
  () => route.path === '/chat' || route.path.startsWith('/presets/'),
)
</script>

<template>
  <UApp>
    <ULink
      to="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg"
    >
      Skip to content
    </ULink>

    <div class="flex flex-col" :class="isFullHeightPage ? 'h-dvh overflow-hidden' : 'min-h-screen'">
      <AppHeader />

      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <main
        id="main-content"
        class="flex-1"
        :class="isFullHeightPage ? 'overflow-hidden min-h-0' : ''"
      >
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </main>

      <AppFooter v-if="showFooter" />
    </div>
  </UApp>
</template>
