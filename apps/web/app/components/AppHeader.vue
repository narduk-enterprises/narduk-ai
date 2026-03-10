<script setup lang="ts">
/**
 * Custom AI-branded header — replaces LayerAppHeader.
 * Glass backdrop, violet-tinted border, pill navigation.
 */
const route = useRoute()
const { loggedIn, user } = useAuth()
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Color Mode types depend on build-time module resolution
const colorMode = useColorMode() as any

const colorModeIcon = computed(() => {
  if (colorMode.preference === 'system') return 'i-lucide-monitor'
  return colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'
})

function cycleColorMode() {
  const modes = ['system', 'light', 'dark'] as const
  const idx = modes.indexOf(colorMode.preference as (typeof modes)[number])
  colorMode.preference = modes[(idx + 1) % modes.length]!
}

const mobileMenuOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false
  },
)

interface NavItem {
  label: string
  to: string
  icon: string
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { label: 'Create', to: '/generate', icon: 'i-lucide-sparkles' },
    { label: 'Gallery', to: '/gallery', icon: 'i-lucide-grid-3x3' },
    { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user shape varies by build-time module resolution
  if ((user.value as any)?.isAdmin) {
    items.push({ label: 'Admin', to: '/admin', icon: 'i-lucide-shield-alert' })
  }

  return items
})
</script>

<template>
  <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
  <header class="sticky top-0 z-50 glass border-b border-default/50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Logo -->
      <AppLogo />

      <!-- Desktop Navigation -->
      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <nav class="hidden md:flex items-center gap-1" aria-label="Main navigation">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2"
          :class="
            route.path === item.to || route.path.startsWith(item.to + '/')
              ? 'bg-primary/15 text-primary'
              : 'text-muted hover:text-default hover:bg-elevated/80'
          "
        >
          <UIcon :name="item.icon" class="size-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Actions -->
      <div class="flex items-center gap-1.5">
        <UButton
          :icon="colorModeIcon"
          variant="ghost"
          color="neutral"
          class="rounded-full"
          aria-label="Toggle color mode"
          @click="cycleColorMode"
        />

        <UButton
          v-if="loggedIn"
          to="/generate"
          size="sm"
          icon="i-lucide-plus"
          label="New"
          class="hidden sm:flex rounded-full"
        />

        <UButton
          v-if="!loggedIn"
          to="/login"
          size="sm"
          icon="i-lucide-log-in"
          label="Sign In"
          class="rounded-full"
        />

        <!-- Mobile hamburger -->
        <UButton
          color="neutral"
          variant="ghost"
          class="md:hidden rounded-full"
          aria-label="Toggle navigation menu"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <UIcon :name="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-5" />
        </UButton>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    <Transition name="slide-down">
      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <nav
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-default/50 glass"
        aria-label="Mobile navigation"
      >
        <div class="max-w-7xl mx-auto px-4 py-3 space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors"
            :class="
              route.path === item.to
                ? 'text-primary bg-primary/10'
                : 'text-muted hover:text-default hover:bg-elevated/80'
            "
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>

          <div v-if="!loggedIn" class="pt-2 border-t border-default/50">
            <NuxtLink
              to="/login"
              class="flex items-center gap-3 px-4 py-3 text-sm font-medium text-primary rounded-xl hover:bg-primary/10 transition-colors"
            >
              <UIcon name="i-lucide-log-in" class="size-4" />
              Sign In
            </NuxtLink>
          </div>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<style>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
