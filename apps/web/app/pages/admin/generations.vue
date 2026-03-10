<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Admin — Generations — Narduk AI',
  description: 'Admin diagnostics for AI generations.',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'Admin — Generations — Narduk AI',
  description: 'Admin diagnostics for AI generations.',
})

const { fetchAll, refreshGeneration, failGeneration } = useAdminGenerations()

type AdminGeneration = Awaited<ReturnType<typeof fetchAll>>[number]

const generations = ref<AdminGeneration[]>([])
const loading = ref(true)
const actionLoading = ref<string | null>(null)
const actionResult = ref<{ id: string; message: string; type: 'success' | 'error' } | null>(null)
const statusFilter = ref<string>('all')

async function load() {
  loading.value = true
  try {
    generations.value = await fetchAll()
  } catch (err) {
    console.error('Failed to load generations', err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filteredGenerations = computed(() => {
  if (statusFilter.value === 'all') return generations.value
  return generations.value.filter((g) => g.status === statusFilter.value)
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: generations.value.length }
  for (const gen of generations.value) {
    counts[gen.status] = (counts[gen.status] || 0) + 1
  }
  return counts
})

async function handleRefresh(id: string) {
  actionLoading.value = id
  actionResult.value = null
  try {
    const result = await refreshGeneration(id)
    actionResult.value = {
      id,
      message: `Refresh: ${result.refreshResult}${result.message ? ` — ${result.message}` : ''}`,
      type: result.refreshResult === 'error' ? 'error' : 'success',
    }
    await load()
  } catch (err) {
    actionResult.value = {
      id,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      type: 'error',
    }
  } finally {
    actionLoading.value = null
  }
}

async function handleFail(id: string) {
  if (!confirm('Mark this generation as failed?')) return
  actionLoading.value = id
  actionResult.value = null
  try {
    await failGeneration(id, 'Manually failed by admin via diagnostics UI')
    actionResult.value = { id, message: 'Marked as failed', type: 'success' }
    await load()
  } catch (err) {
    actionResult.value = {
      id,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      type: 'error',
    }
  } finally {
    actionLoading.value = null
  }
}

const statusBadgeColor = (status: string) => {
  if (status === 'done') return 'success' as const
  if (status === 'pending') return 'warning' as const
  if (status === 'failed') return 'error' as const
  return 'neutral' as const
}

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Done', value: 'done' },
  { label: 'Failed', value: 'failed' },
  { label: 'Expired', value: 'expired' },
]

function truncateId(id: string) {
  return `${id.slice(0, 8)}…`
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <UBadge color="error" variant="subtle" label="Admin" />
          <h1 class="font-display text-2xl sm:text-3xl font-bold">Generation Diagnostics</h1>
        </div>
        <p class="text-muted text-sm">Monitor and manage all AI video/image generations.</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        class="rounded-full"
        :loading="loading"
        @click="load"
      >
        Refresh
      </UButton>
    </div>

    <!-- Action Result Toast -->
    <UAlert
      v-if="actionResult"
      :color="actionResult.type === 'success' ? 'success' : 'error'"
      :icon="actionResult.type === 'success' ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
      :title="actionResult.message"
      class="mb-4"
      :close-icon="'i-lucide-x'"
      @close="actionResult = null"
    />

    <!-- Stats Bar -->
    <div class="flex flex-wrap gap-3 mb-6">
      <!-- eslint-disable-next-line narduk/no-native-button -- custom pill styling -->
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
        :class="
          statusFilter === filter.value
            ? 'bg-primary text-white border-primary'
            : 'border-default text-muted hover:text-default hover:border-primary/40'
        "
        @click="statusFilter = filter.value"
      >
        {{ filter.label }}
        <span
          v-if="statusCounts[filter.value]"
          class="ml-0.5 px-1.5 rounded-full text-[10px]"
          :class="statusFilter === filter.value ? 'bg-white/20' : 'bg-elevated'"
        >
          {{ statusCounts[filter.value] }}
        </span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-24">
      <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredGenerations.length" class="text-center py-24 text-muted">
      No generations found.
    </div>

    <!-- Generations Table -->
    <div v-else class="space-y-3">
      <div
        v-for="gen in filteredGenerations"
        :key="gen.id"
        class="glass-card p-4 space-y-3"
        :class="{ 'ring-2 ring-error/30': gen.isStale }"
      >
        <!-- Row 1: Status + ID + Type + Age -->
        <!-- eslint-disable-next-line narduk/no-native-layout -- admin diagnostic layout -->
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="statusBadgeColor(gen.status)" :label="gen.status" />
          <UBadge
            v-if="gen.isStale"
            color="error"
            variant="subtle"
            label="STALE"
            icon="i-lucide-alert-triangle"
          />
          <span class="font-mono text-xs text-dimmed break-all">{{ gen.id }}</span>
          <span class="text-xs text-dimmed">•</span>
          <span class="text-xs text-muted">{{ gen.mode.toUpperCase() }}</span>
          <span class="text-xs text-dimmed">•</span>
          <span class="text-xs text-muted">{{ gen.ageMinutes }}m ago</span>
          <span class="text-xs text-dimmed">•</span>
          <span class="font-mono text-xs text-dimmed">user: {{ truncateId(gen.userId) }}</span>
        </div>

        <!-- Row 2: Prompt -->
        <p class="text-sm text-muted line-clamp-1">{{ gen.prompt }}</p>

        <!-- Row 3: xAI Request ID + Error -->
        <!-- eslint-disable-next-line narduk/no-native-layout -- admin diagnostic layout -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span v-if="gen.xaiRequestId" class="font-mono text-dimmed">
            xAI: {{ gen.xaiRequestId }}
          </span>
          <span v-if="gen.errorInfo" class="text-error truncate"> Error: {{ gen.errorInfo }} </span>
          <span v-if="gen.duration" class="text-dimmed">{{ gen.duration }}s</span>
          <span v-if="gen.resolution" class="text-dimmed">{{ gen.resolution }}</span>
        </div>

        <!-- Row 4: Actions -->
        <div class="flex gap-2">
          <UButton
            v-if="gen.xaiRequestId && gen.status !== 'done'"
            size="xs"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="actionLoading === gen.id"
            class="rounded-full"
            @click="handleRefresh(gen.id)"
          >
            Check xAI
          </UButton>
          <UButton
            v-if="gen.status === 'pending'"
            size="xs"
            variant="outline"
            color="error"
            icon="i-lucide-x-circle"
            :loading="actionLoading === gen.id"
            class="rounded-full"
            @click="handleFail(gen.id)"
          >
            Force Fail
          </UButton>
          <UButton
            v-if="gen.status === 'done' && gen.mediaUrl"
            size="xs"
            variant="ghost"
            icon="i-lucide-external-link"
            :to="`/gallery/${gen.id}`"
            class="rounded-full"
          >
            View
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
