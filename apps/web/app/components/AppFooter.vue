<script setup lang="ts">
/**
 * Custom minimal AI-branded footer.
 */
const appName = useRuntimeConfig().public.appName || 'Narduk AI'
</script>

<template>
  <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
  <footer class="border-t border-default/50 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <AppLogo size="sm" :show-text="false" />
          <p class="text-sm text-muted">
            &copy; <NuxtTime :datetime="new Date()" year="numeric" /> {{ appName }}
          </p>
        </div>
        <div class="flex items-center gap-3 text-xs text-dimmed">
          <span>Powered by Grok Imagine</span>
          <span class="text-default/20">&middot;</span>
          <span>Nuxt 4</span>
          <span class="text-default/20">&middot;</span>
          <span>Cloudflare Workers</span>
        </div>
      </div>
    </div>
  </footer>
</template>
