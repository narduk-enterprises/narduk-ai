<script setup lang="ts">
const config = useRuntimeConfig()
const appName = config.public.appName || 'Narduk AI'
const { loggedIn } = useAuth()

useSeo({
  title: `${appName} — AI Image & Video Generation`,
  description:
    'Create stunning images and videos with AI. Text-to-image, text-to-video, and image-to-video powered by Grok Imagine.',
})
useWebPageSchema({
  name: `${appName} — AI Image & Video Generation`,
  description:
    'Create stunning images and videos with AI. Text-to-image, text-to-video, and image-to-video powered by Grok Imagine.',
})

const features = [
  {
    icon: 'i-lucide-image',
    title: 'Text to Image',
    description:
      'Generate stunning photorealistic images from text descriptions with precise style control.',
  },
  {
    icon: 'i-lucide-video',
    title: 'Text to Video',
    description:
      'Create dynamic 720p videos up to 15 seconds with synchronized audio and cinematic motion.',
  },
  {
    icon: 'i-lucide-wand-2',
    title: 'Image to Video',
    description: 'Animate your generated images into living, breathing video sequences.',
  },
  {
    icon: 'i-lucide-layers',
    title: 'Iterative Refinement',
    description: 'Edit and remix your creations. Use any generation as input for new variations.',
  },
  {
    icon: 'i-lucide-database',
    title: 'Persistent Gallery',
    description:
      'All generations stored securely. Browse, download, and reuse your creative history.',
  },
  {
    icon: 'i-lucide-zap',
    title: 'Edge-Powered',
    description: 'Deployed on Cloudflare Workers for sub-50ms responses worldwide.',
  },
]
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="relative gradient-mesh overflow-hidden">
      <div
        class="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40 text-center"
      >
        <div class="animate-fade-in-up">
          <h1 class="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Create with <span class="text-gradient">AI</span>
          </h1>
          <p class="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Generate stunning images and videos from text. Animate your creations. Powered by Grok
            Imagine.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-4">
            <UButton
              v-if="loggedIn"
              to="/generate"
              size="xl"
              icon="i-lucide-sparkles"
              label="Start Creating"
              class="rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-shadow"
            />
            <UButton
              v-else
              to="/login"
              size="xl"
              icon="i-lucide-log-in"
              label="Sign In to Create"
              class="rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-shadow"
            />
            <UButton
              v-if="loggedIn"
              to="/gallery"
              size="xl"
              color="neutral"
              variant="outline"
              icon="i-lucide-grid-3x3"
              label="My Gallery"
              class="rounded-full px-8"
            />
          </div>
        </div>
      </div>

      <!-- Decorative gradient orbs -->
      <div
        class="absolute top-1/4 -left-32 w-96 h-96 rounded-full animate-float opacity-20 orb-primary"
      />
      <div
        class="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full animate-float opacity-15 orb-secondary [animation-delay:2s]"
      />
    </section>

    <!-- Features Section -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      <div class="text-center mb-14">
        <h2 class="font-display text-3xl sm:text-4xl font-bold mb-4">
          Everything You Need to Create
        </h2>
        <p class="text-muted text-lg max-w-xl mx-auto">
          A complete AI media generation toolkit, from text to stunning visuals.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        <div v-for="feature in features" :key="feature.title" class="glow-card p-6 group">
          <div
            class="size-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-primary/20"
          >
            <UIcon :name="feature.icon" class="size-5 text-primary" />
          </div>
          <h3 class="font-display text-lg font-semibold mb-2">{{ feature.title }}</h3>
          <p class="text-sm text-muted leading-relaxed">{{ feature.description }}</p>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="border-t border-default/50 py-16 sm:py-20 text-center">
      <div class="max-w-xl mx-auto px-4">
        <p class="text-lg text-muted mb-2">Powered by Grok Imagine API</p>
        <div class="flex items-center justify-center gap-3 text-xs text-dimmed">
          <span class="px-3 py-1 rounded-full border border-default/50 bg-elevated/50">Nuxt 4</span>
          <span class="px-3 py-1 rounded-full border border-default/50 bg-elevated/50">
            Cloudflare Workers
          </span>
          <span class="px-3 py-1 rounded-full border border-default/50 bg-elevated/50"
            >R2 Storage</span
          >
        </div>
      </div>
    </section>
  </div>
</template>
