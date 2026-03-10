<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Admin — Spending — Narduk AI',
  description: 'API usage and estimated spending overview.',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'Admin — Spending — Narduk AI',
  description: 'API usage and estimated spending overview.',
})

const { fetchSpending } = useAdminSpending()

type SpendingData = Awaited<ReturnType<typeof fetchSpending>>

const spending = ref<SpendingData | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    spending.value = await fetchSpending()
  } catch (err) {
    console.error('Failed to load spending data', err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const modeLabels: Record<string, string> = {
  t2i: 'Text → Image',
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  i2i: 'Image → Image',
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <UBadge color="error" variant="subtle" label="Admin" />
          <h1 class="font-display text-2xl sm:text-3xl font-bold">Spending Overview</h1>
        </div>
        <p class="text-muted text-sm">
          Estimated API costs based on xAI published rates. Costs are approximations.
        </p>
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

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center gap-4 py-24">
      <UIcon name="i-lucide-loader-2" class="size-10 animate-spin text-primary" />
    </div>

    <template v-else-if="spending">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div class="glass-card p-5 text-center">
          <p class="text-3xl font-bold text-primary">
            {{ formatCost(spending.totals.estimatedCostUsd) }}
          </p>
          <p class="text-sm text-muted mt-1">Estimated Total</p>
        </div>
        <div class="glass-card p-5 text-center">
          <p class="text-3xl font-bold">{{ spending.totals.generations }}</p>
          <p class="text-sm text-muted mt-1">Total Generations</p>
        </div>
        <div class="glass-card p-5 text-center">
          <p class="text-3xl font-bold">{{ spending.totals.images }}</p>
          <p class="text-sm text-muted mt-1">Images</p>
        </div>
        <div class="glass-card p-5 text-center">
          <p class="text-3xl font-bold">{{ spending.totals.videos }}</p>
          <p class="text-sm text-muted mt-1">Videos</p>
        </div>
      </div>

      <!-- Status + Mode Breakdown -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- By Status -->
        <div class="glass-card p-5">
          <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">By Status</h3>
          <dl class="space-y-3">
            <div class="flex justify-between items-center">
              <dt class="flex items-center gap-2">
                <UBadge color="success" variant="subtle" label="Done" size="xs" />
              </dt>
              <dd class="text-sm font-medium font-mono">{{ spending.totals.done }}</dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="flex items-center gap-2">
                <UBadge color="warning" variant="subtle" label="Pending" size="xs" />
              </dt>
              <dd class="text-sm font-medium font-mono">{{ spending.totals.pending }}</dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="flex items-center gap-2">
                <UBadge color="error" variant="subtle" label="Failed" size="xs" />
              </dt>
              <dd class="text-sm font-medium font-mono">{{ spending.totals.failed }}</dd>
            </div>
            <div class="flex justify-between items-center">
              <dt class="flex items-center gap-2">
                <UBadge color="neutral" variant="subtle" label="Expired" size="xs" />
              </dt>
              <dd class="text-sm font-medium font-mono">{{ spending.totals.expired }}</dd>
            </div>
          </dl>
        </div>

        <!-- By Mode -->
        <div class="glass-card p-5">
          <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">
            By Mode
          </h3>
          <dl class="space-y-3">
            <div
              v-for="(stats, mode) in spending.byMode"
              :key="mode"
              class="flex justify-between items-center"
            >
              <dt class="text-sm text-dimmed">{{ modeLabels[mode] || mode }}</dt>
              <dd class="text-sm font-medium font-mono">
                {{ stats.count }} · {{ formatCost(stats.costUsd) }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Daily Usage -->
      <div class="glass-card p-5 mb-8">
        <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">
          Daily Usage (Last 30 days)
        </h3>
        <div v-if="spending.daily.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-dimmed">
                <th class="pb-2 pr-4">Date</th>
                <th class="pb-2 pr-4 text-right">Total</th>
                <th class="pb-2 pr-4 text-right">Images</th>
                <th class="pb-2 pr-4 text-right">Videos</th>
                <th class="pb-2 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="day in spending.daily"
                :key="day.date"
                class="border-b border-default/50"
              >
                <td class="py-2 pr-4 font-mono text-muted">{{ day.date }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ day.count }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ day.images }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ day.videos }}</td>
                <td class="py-2 text-right font-mono font-medium">{{ formatCost(day.costUsd) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-center py-8 text-muted">No usage data yet.</p>
      </div>

      <!-- Top Users -->
      <div class="glass-card p-5">
        <h3 class="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">
          Top Users by Spending
        </h3>
        <div v-if="spending.topUsers.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-dimmed">
                <th class="pb-2 pr-4">User ID</th>
                <th class="pb-2 pr-4 text-right">Generations</th>
                <th class="pb-2 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in spending.topUsers"
                :key="user.userId"
                class="border-b border-default/50"
              >
                <td class="py-2 pr-4 font-mono text-muted">{{ user.userId }}</td>
                <td class="py-2 pr-4 text-right font-mono">{{ user.count }}</td>
                <td class="py-2 text-right font-mono font-medium">
                  {{ formatCost(user.costUsd) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-center py-8 text-muted">No user data yet.</p>
      </div>
    </template>
  </div>
</template>
