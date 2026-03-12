<script setup lang="ts">
/**
 * Custom AI-branded header — replaces LayerAppHeader.
 * Glass backdrop, violet-tinted border, pill navigation.
 */
const route = useRoute()
const { loggedIn, user, logout } = useAuth()
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

async function handleLogout() {
  await logout()
  navigateTo('/')
}

interface NavItem {
  label: string
  to: string
  icon: string
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { label: 'Create', to: '/generate', icon: 'i-lucide-sparkles' },
    { label: 'Chat', to: '/chat', icon: 'i-lucide-message-square' },
    { label: 'Gallery', to: '/gallery', icon: 'i-lucide-grid-3x3' },
    { label: 'Compare', to: '/compare', icon: 'i-lucide-scale' },
    { label: 'Prompts', to: '/compose', icon: 'i-lucide-wand-2' },
    { label: 'Presets', to: '/presets', icon: 'i-lucide-bookmark' },
    { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- user shape varies by build-time module resolution
  if ((user.value as any)?.isAdmin) {
    items.push({ label: 'Admin', to: '/admin', icon: 'i-lucide-shield-alert' })
  }

  return items
})

const userMenuItems = computed(() => [
  [
    {
      label: 'Signed in as',
      slot: 'account',
      disabled: true,
    },
  ],
  [
    {
      label: 'Sign out',
      icon: 'i-lucide-log-out',
      onSelect: handleLogout,
    },
  ],
])
</script>

<template>
  <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
  <header class="sticky top-0 z-50 glass border-b border-default/50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Logo -->
      <AppLogo />

      <!-- Desktop Navigation -->
      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <nav class="hidden md:flex items-center gap-2" aria-label="Main navigation">
        <template v-if="loggedIn">
          <NuxtLink
            v-for="(item, index) in navItems"
            :key="index"
            :to="item.to"
            class="px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2"
            :class="
              route.path.startsWith(item.to)
                ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                : 'text-muted hover:text-default hover:bg-elevated'
            "
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>
        </template>
      </nav>

      <!-- Actions Area -->
      <div class="flex items-center gap-2">
        <UButton
          :icon="colorModeIcon"
          variant="ghost"
          color="neutral"
          aria-label="Toggle color mode"
          class="rounded-full"
          @click="cycleColorMode"
        />

        <template v-if="loggedIn">
          <UDropdownMenu
            v-if="user"
            :items="userMenuItems"
            :content="{ align: 'end', sideOffset: 8 }"
            class="hidden md:flex"
          >
            <UButton variant="ghost" color="neutral" class="rounded-full p-1.5! hover:bg-elevated">
              <UAvatar
                :alt="user.name || user.email || 'User'"
                size="sm"
                class="ring-1 ring-default/10"
              />
            </UButton>
            <template #account="{ item }">
              <div class="text-left">
                <p class="text-xs text-muted">{{ item.label }}</p>
                <p class="text-sm font-medium truncate max-w-[150px]">
                  {{ user.email }}
                </p>
              </div>
            </template>
          </UDropdownMenu>
        </template>
        <template v-else>
          <UButton
            to="/login"
            variant="solid"
            color="primary"
            class="hidden md:flex rounded-full px-5"
          >
            Sign In
          </UButton>
        </template>

        <!-- Mobile hamburger -->
        <UButton
          color="neutral"
          variant="ghost"
          class="md:hidden p-2 rounded-full hover:bg-elevated touch-target flex items-center justify-center"
          aria-label="Toggle navigation menu"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <UIcon :name="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-5" />
        </UButton>
      </div>
    </div>

    <!-- Mobile nav drawer -->
    <Transition name="slide-down">
      <!-- eslint-disable-next-line narduk/no-native-layout -- app-level scaffold: semantic landmark element -->
      <nav
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-default/50 bg-default/95 backdrop-blur-xl shadow-elevated absolute w-full left-0 top-16"
        aria-label="Mobile navigation"
      >
        <div class="px-4 py-4 flex flex-col gap-2">
          <template v-if="loggedIn">
            <NuxtLink
              v-for="(item, index) in navItems"
              :key="index"
              :to="item.to"
              class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-2xl transition-all min-h-11"
              :class="
                route.path.startsWith(item.to)
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-muted hover:text-default hover:bg-elevated'
              "
            >
              <UIcon :name="item.icon" class="size-5" />
              {{ item.label }}
            </NuxtLink>

            <div class="h-px bg-default/50 my-2"></div>

            <!-- Mobile User / Logout -->
            <div class="flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-3">
                <UAvatar :alt="user?.name || user?.email || 'User'" size="sm" />
                <div class="text-left">
                  <p class="text-sm font-medium truncate max-w-[150px]">
                    {{ user?.email }}
                  </p>
                </div>
              </div>
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-log-out"
                size="sm"
                class="rounded-full"
                @click="handleLogout"
              >
                Sign out
              </UButton>
            </div>
          </template>
          <template v-else>
            <UButton to="/login" variant="solid" color="primary" block class="rounded-2xl py-3">
              Sign In
            </UButton>
          </template>
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
