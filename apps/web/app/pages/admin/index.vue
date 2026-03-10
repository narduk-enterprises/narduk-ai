<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Admin Hub — Narduk AI',
  description: 'Administrative tools and diagnostics.',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'Admin Hub — Narduk AI',
  description: 'Administrative tools and diagnostics.',
})

const { user } = useAuth()
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <UBadge color="error" variant="subtle" label="Admin" />
        <h1 class="font-display text-3xl font-bold">Admin Hub</h1>
      </div>
      <p class="text-muted">Welcome back, {{ user?.email }}</p>
    </div>

    <!-- Admin Tools Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NuxtLink
        to="/admin/generations"
        class="glass-card p-6 rounded-2xl flex flex-col items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 group neon-border"
      >
        <div class="p-3 bg-elevated/80 rounded-xl group-hover:bg-primary/10 transition-colors">
          <UIcon
            name="i-lucide-activity"
            class="size-6 text-dimmed group-hover:text-primary transition-colors"
          />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-default mb-1">Generation Diagnostics</h2>
          <p class="text-sm text-muted">
            View all pending and failed AI generation jobs. Manually force check status or fail
            stuck jobs.
          </p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/admin/spending"
        class="glass-card p-6 rounded-2xl flex flex-col items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 group neon-border"
      >
        <div class="p-3 bg-elevated/80 rounded-xl group-hover:bg-primary/10 transition-colors">
          <UIcon
            name="i-lucide-wallet"
            class="size-6 text-dimmed group-hover:text-primary transition-colors"
          />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-default mb-1">Spending Overview</h2>
          <p class="text-sm text-muted">
            Monitor API usage and estimated costs. View breakdowns by mode, daily usage, and top
            users.
          </p>
        </div>
      </NuxtLink>

      <NuxtLink
        to="/admin/indexing"
        class="glass-card p-6 rounded-2xl flex flex-col items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 group"
      >
        <div class="p-3 bg-elevated/80 rounded-xl group-hover:bg-primary/10 transition-colors">
          <UIcon
            name="i-lucide-search-check"
            class="size-6 text-dimmed group-hover:text-primary transition-colors"
          />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-default mb-1">SEO & Indexing</h2>
          <p class="text-sm text-muted">
            Manage IndexNow API submissions to search engines and view indexing status.
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
