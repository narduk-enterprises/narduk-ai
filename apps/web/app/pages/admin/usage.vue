<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'API Usage & Billing — Narduk AI',
  description: 'xAI API usage statistics and billing overview.',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'API Usage & Billing — Narduk AI',
  description: 'xAI API usage statistics and billing overview.',
})

const { data, status, refresh } = useAdminXaiStats()

/**
 * Safely extract a nested value from unknown data.
 */
function dig(obj: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Format a cent/micro-dollar amount to USD.
 */
function formatUsd(value: unknown): string {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Format large numbers with commas.
 */
function formatNumber(value: unknown): string {
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Extract usage rows for table display from the usage response.
 * Handles various possible response shapes from the xAI Management API.
 */
const usageRows = computed(() => {
  const usage = data.value?.usage
  if (!usage) return []

  // Try common shapes: { usage: [...] }, { data: [...] }, or the object itself is an array
  const items =
    (usage as Record<string, unknown>).usage ||
    (usage as Record<string, unknown>).data ||
    (usage as Record<string, unknown>).items
  if (Array.isArray(items)) {
    return items as Record<string, unknown>[]
  }

  return []
})

/**
 * Extract balance changes for display.
 */
const balanceChanges = computed(() => {
  const balance = data.value?.balance
  if (!balance) return []

  const changes =
    (balance as Record<string, unknown>).balance_changes ||
    (balance as Record<string, unknown>).changes ||
    (balance as Record<string, unknown>).data
  if (Array.isArray(changes)) {
    return (changes as Record<string, unknown>[]).slice(0, 10)
  }

  return []
})

/**
 * Pre-computed display values for stat cards.
 */
const prepaidBalanceDisplay = computed(() => {
  if (!data.value?.balance) return '—'
  const b = data.value.balance
  const amount = dig(b, 'balance') ?? dig(b, 'remaining_balance') ?? dig(b, 'amount')
  return formatUsd(amount)
})

const monthlyChargesDisplay = computed(() => {
  if (!data.value?.invoicePreview) return '—'
  const inv = data.value.invoicePreview
  const amount = dig(inv, 'total') ?? dig(inv, 'amount_due') ?? dig(inv, 'total_amount')
  return formatUsd(amount)
})

const rawJsonDebug = computed(() => JSON.stringify(data.value, null, 2))

/**
 * Row-level formatters for v-for usage rows.
 */
function rowCostDisplay(row: Record<string, unknown>): string {
  return formatUsd(row.cost || row.amount)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight text-default">
          API Usage & Billing
        </h1>
        <p class="text-sm text-muted mt-1">Live stats from the xAI Management API.</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </div>

    <!-- Loading -->
    <UCard v-if="status === 'pending'" class="shadow-elevated rounded-card">
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-muted" />
        <p class="mt-4 text-sm font-medium text-default">Loading usage data...</p>
      </div>
    </UCard>

    <!-- Not Configured -->
    <UCard v-else-if="data && !data.configured" class="shadow-elevated rounded-card">
      <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
        <UIcon name="i-lucide-alert-triangle" class="h-10 w-10 text-warning" />
        <p class="text-sm font-medium text-default">xAI Management API not configured</p>
        <p class="text-xs text-muted max-w-md">
          Set
          <code class="text-xs font-mono bg-muted px-1 py-0.5 rounded">XAI_MANAGEMENT_KEY</code> and
          <code class="text-xs font-mono bg-muted px-1 py-0.5 rounded">XAI_TEAM_ID</code>
          environment variables to enable usage tracking.
        </p>
      </div>
    </UCard>

    <!-- Data Display -->
    <template v-else-if="data">
      <!-- Top Stats Row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Prepaid Balance -->
        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <p class="text-xs uppercase tracking-wider text-muted mb-1">Prepaid Balance</p>
            <p class="text-2xl font-bold font-display text-default">
              {{ prepaidBalanceDisplay }}
            </p>
          </div>
        </UCard>

        <!-- Invoice Preview (current month) -->
        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <p class="text-xs uppercase tracking-wider text-muted mb-1">Current Month Charges</p>
            <p class="text-2xl font-bold font-display text-default">
              {{ monthlyChargesDisplay }}
            </p>
          </div>
        </UCard>

        <!-- Usage Count -->
        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <p class="text-xs uppercase tracking-wider text-muted mb-1">API Requests</p>
            <p class="text-2xl font-bold font-display text-default">
              {{ usageRows.length > 0 ? formatNumber(usageRows.length) : '—' }}
            </p>
          </div>
        </UCard>
      </div>

      <!-- Usage Details -->
      <UCard class="shadow-elevated rounded-card">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-3" class="text-primary size-5" />
            <h2 class="font-semibold text-default">Usage Details</h2>
          </div>
        </template>

        <div v-if="usageRows.length > 0" class="overflow-x-auto">
          <div class="space-y-3">
            <div
              v-for="(row, idx) in usageRows"
              :key="idx"
              class="flex items-center justify-between px-3 py-2 rounded-lg bg-elevated/50"
            >
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium text-default">
                  {{ row.model || row.product || row.name || `Entry ${idx + 1}` }}
                </span>
                <span v-if="row.date || row.period" class="text-xs text-muted">
                  {{ row.date || row.period }}
                </span>
              </div>
              <div class="text-right flex flex-col gap-0.5">
                <span
                  v-if="row.total_tokens || row.tokens"
                  class="text-sm font-medium text-default"
                >
                  {{ formatNumber(row.total_tokens || row.tokens) }} tokens
                </span>
                <span v-if="row.cost || row.amount" class="text-xs text-muted">
                  {{ rowCostDisplay(row) }}
                </span>
                <span v-if="row.requests || row.count" class="text-xs text-muted">
                  {{ formatNumber(row.requests || row.count) }} requests
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center py-8 text-center">
          <UIcon name="i-lucide-inbox" class="h-8 w-8 text-dimmed" />
          <p class="mt-3 text-sm text-muted">No usage data available yet.</p>
        </div>
      </UCard>

      <!-- Prepaid Balance Changes -->
      <UCard v-if="balanceChanges.length > 0" class="shadow-elevated rounded-card">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-wallet" class="text-primary size-5" />
            <h2 class="font-semibold text-default">Recent Balance Changes</h2>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="(change, idx) in balanceChanges"
            :key="idx"
            class="flex items-center justify-between px-3 py-2 rounded-lg bg-elevated/50"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-default">
                {{ change.description || change.type || change.reason || `Change ${idx + 1}` }}
              </span>
              <span v-if="change.created_at || change.date" class="text-xs text-muted">
                {{ change.created_at || change.date }}
              </span>
            </div>
            <span
              class="text-sm font-semibold"
              :class="Number(change.amount) >= 0 ? 'text-success' : 'text-error'"
            >
              {{ formatUsd(change.amount) }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Raw JSON (debug accordion) -->
      <UAccordion :items="[{ label: 'Raw API Response', icon: 'i-lucide-code', content: '' }]">
        <template #body>
          <pre class="text-xs overflow-auto p-4 bg-elevated rounded-lg max-h-96">{{
            rawJsonDebug
          }}</pre>
        </template>
      </UAccordion>
    </template>
  </div>
</template>
