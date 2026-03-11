<script setup lang="ts">
/**
 * Custom Application Shell — overrides the layer's app.vue.
 * Uses UApp directly with custom header/footer components.
 */
const route = useRoute()
const showFooter = computed(() => route.path !== '/chat')
</script>

<template>
  <UApp>
    <ULink
      to="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg"
    >
      Skip to content
    </ULink>

    <div class="min-h-screen flex flex-col">
      <AppHeader />

      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <main id="main-content" class="flex-1">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </main>

      <AppFooter v-if="showFooter" />
    </div>
  </UApp>
</template>
