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

// ─── Helpers ────────────────────────────────────────────────

/**
 * Convert cents string to USD. Negative = credit remaining.
 */
function centsToUsd(val: string | undefined): string {
  if (!val) return '—'
  const cents = Math.abs(Number(val))
  if (Number.isNaN(cents)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatNumber(val: string | number | undefined): string {
  if (val == null) return '—'
  const num = Number(val)
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat('en-US').format(num)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Model Categorization ───────────────────────────────────

type ModelCategory = 'all' | 'chat' | 'image' | 'video'

function categorizeModel(description: string): ModelCategory {
  const d = description.toLowerCase()
  if (d.includes('video')) return 'video'
  if (d.includes('image')) return 'image'
  if (
    d.startsWith('chat ') ||
    d.includes('grok-3') ||
    d.includes('grok-4') ||
    d.includes('grok-code')
  )
    return 'chat'
  return 'chat'
}

/**
 * Clean up model name: strip "Chat " prefix, humanize.
 */
function cleanModelName(description: string): string {
  return description.replace(/^Chat\s+/i, '')
}

/**
 * Humanize unit type labels.
 */
function humanizeUnitType(unitType: string): string {
  const map: Record<string, string> = {
    'Prompt text tokens': 'Input tokens',
    'Cached prompt text tokens': 'Cached input tokens',
    'Completion text tokens': 'Output tokens',
    'Reasoning text tokens': 'Reasoning tokens',
    'Generated image': 'Images generated',
    'Image edit input images': 'Image edits',
    'Generated video': 'Videos generated',
    'Generated video (moderated)': 'Videos (moderated)',
    'Video generation input images': 'Video from image',
  }
  return map[unitType] || unitType
}

// ─── Filter State ───────────────────────────────────────────

const activeFilter = ref<ModelCategory>('all')

const filterOptions = [
  { label: 'All', value: 'all' as ModelCategory, icon: 'i-lucide-layers' },
  { label: 'Chat', value: 'chat' as ModelCategory, icon: 'i-lucide-message-square' },
  { label: 'Image', value: 'image' as ModelCategory, icon: 'i-lucide-image' },
  { label: 'Video', value: 'video' as ModelCategory, icon: 'i-lucide-video' },
]

// ─── Computed Data ──────────────────────────────────────────

const prepaidBalance = computed(() => centsToUsd(data.value?.balance?.total?.val))

const monthlySpend = computed(() =>
  centsToUsd(data.value?.invoicePreview?.coreInvoice?.totalWithCorr?.val),
)

const creditsUsed = computed(() =>
  centsToUsd(data.value?.invoicePreview?.coreInvoice?.prepaidCreditsUsed?.val),
)

const billingCycleLabel = computed(() => {
  const bc = data.value?.invoicePreview?.billingCycle
  if (!bc) return null
  const date = new Date(bc.year, bc.month - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

/**
 * Group invoice lines by model, aggregate costs, apply filter.
 */
interface ModelGroup {
  model: string
  category: ModelCategory
  totalCents: number
  lines: Array<{
    unitType: string
    numUnits: number
    costCents: number
  }>
}

const modelGroups = computed((): ModelGroup[] => {
  const lines = data.value?.invoicePreview?.coreInvoice?.lines
  if (!lines) return []

  const grouped = new Map<string, ModelGroup>()

  for (const line of lines) {
    const model = cleanModelName(line.description)
    const category = categorizeModel(line.description)

    if (!grouped.has(model)) {
      grouped.set(model, { model, category, totalCents: 0, lines: [] })
    }

    const group = grouped.get(model)!
    const costCents = Number(line.amount)
    const numUnits = Number(line.numUnits)

    // Merge same unitType within same model
    const existing = group.lines.find((l) => l.unitType === line.unitType)
    if (existing) {
      existing.numUnits += numUnits
      existing.costCents += costCents
    } else {
      group.lines.push({
        unitType: humanizeUnitType(line.unitType),
        numUnits,
        costCents,
      })
    }

    group.totalCents += costCents
  }

  return [...grouped.values()].sort((a, b) => b.totalCents - a.totalCents)
})

const filteredGroups = computed(() => {
  if (activeFilter.value === 'all') return modelGroups.value
  return modelGroups.value.filter((g) => g.category === activeFilter.value)
})

const filteredTotalCents = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.totalCents, 0),
)

const filteredTotalDisplay = computed(() => centsToUsd(String(filteredTotalCents.value)))

/**
 * Balance change history.
 */
const balanceChanges = computed(() => data.value?.balance?.changes ?? [])

function changeLabel(change: {
  changeOrigin: string
  spendBpKeyYear?: number
  spendBpKeyMonth?: number
}): string {
  if (change.changeOrigin === 'PURCHASE') return 'Credit Top-up'
  if (change.changeOrigin === 'SPEND' && change.spendBpKeyYear && change.spendBpKeyMonth) {
    const date = new Date(change.spendBpKeyYear, change.spendBpKeyMonth - 1)
    return `Spend — ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  }
  return change.changeOrigin
}

/** Format model group cost. */
function groupCost(group: ModelGroup): string {
  return centsToUsd(String(group.totalCents))
}

/** Format line cost within a group. */
function subLineCost(costCents: number): string {
  return centsToUsd(String(costCents))
}

/** Category icon for a model group. */
function categoryIcon(cat: ModelCategory): string {
  if (cat === 'video') return 'i-lucide-video'
  if (cat === 'image') return 'i-lucide-image'
  return 'i-lucide-message-square'
}

const rawJsonDebug = computed(() => JSON.stringify(data.value, null, 2))
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl font-bold tracking-tight text-default">
          API Usage & Billing
        </h1>
        <p class="text-sm text-muted mt-1">
          xAI API costs for
          <span v-if="billingCycleLabel" class="font-medium text-default">{{
            billingCycleLabel
          }}</span>
          <span v-else>this billing cycle</span>
        </p>
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

    <!-- Data -->
    <template v-else-if="data">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <div class="flex items-center justify-center gap-1.5 mb-1">
              <UIcon name="i-lucide-wallet" class="size-3.5 text-dimmed" />
              <p class="text-xs uppercase tracking-wider text-muted">Credit Balance</p>
            </div>
            <p class="text-2xl font-bold font-display text-default">
              {{ prepaidBalance }}
            </p>
          </div>
        </UCard>

        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <div class="flex items-center justify-center gap-1.5 mb-1">
              <UIcon name="i-lucide-trending-up" class="size-3.5 text-dimmed" />
              <p class="text-xs uppercase tracking-wider text-muted">This Month</p>
            </div>
            <p class="text-2xl font-bold font-display text-default">
              {{ monthlySpend }}
            </p>
          </div>
        </UCard>

        <UCard class="shadow-card rounded-card">
          <div class="text-center">
            <div class="flex items-center justify-center gap-1.5 mb-1">
              <UIcon name="i-lucide-coins" class="size-3.5 text-dimmed" />
              <p class="text-xs uppercase tracking-wider text-muted">Credits Used</p>
            </div>
            <p class="text-2xl font-bold font-display text-default">
              {{ creditsUsed }}
            </p>
          </div>
        </UCard>
      </div>

      <!-- Usage by Model -->
      <UCard v-if="modelGroups.length > 0" class="shadow-elevated rounded-card">
        <template #header>
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-bar-chart-3" class="text-primary size-5" />
              <h2 class="font-semibold text-default">Cost by Model</h2>
            </div>

            <!-- Filter Buttons -->
            <div class="flex gap-1">
              <UButton
                v-for="opt in filterOptions"
                :key="opt.value"
                size="xs"
                :variant="activeFilter === opt.value ? 'solid' : 'ghost'"
                :color="activeFilter === opt.value ? 'primary' : 'neutral'"
                :icon="opt.icon"
                :label="opt.label"
                @click="activeFilter = opt.value"
              />
            </div>
          </div>
        </template>

        <!-- Filtered total -->
        <div v-if="activeFilter !== 'all'" class="mb-4 px-1">
          <p class="text-xs text-muted">
            Filtered total:
            <span class="font-semibold text-default">{{ filteredTotalDisplay }}</span>
          </p>
        </div>

        <div class="space-y-3">
          <div
            v-for="group in filteredGroups"
            :key="group.model"
            class="rounded-xl bg-elevated/50 overflow-hidden"
          >
            <!-- Model header -->
            <div class="flex items-center justify-between px-4 py-3">
              <div class="flex items-center gap-2.5">
                <UIcon :name="categoryIcon(group.category)" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-default">{{ group.model }}</span>
              </div>
              <span class="text-sm font-bold text-default">
                {{ groupCost(group) }}
              </span>
            </div>

            <!-- Sub-items -->
            <div class="border-t border-default/10">
              <div
                v-for="(line, idx) in group.lines"
                :key="idx"
                class="flex items-center justify-between px-4 py-1.5 text-xs"
                :class="idx > 0 ? 'border-t border-default/5' : ''"
              >
                <span class="text-muted">
                  {{ line.unitType }}
                  <span class="text-dimmed">× {{ formatNumber(line.numUnits) }}</span>
                </span>
                <span class="text-muted font-medium">
                  {{ subLineCost(line.costCents) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredGroups.length === 0" class="py-8 text-center">
          <p class="text-sm text-muted">No usage for this category.</p>
        </div>
      </UCard>

      <!-- Balance History -->
      <UCard v-if="balanceChanges.length > 0" class="shadow-elevated rounded-card">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-history" class="text-primary size-5" />
            <h2 class="font-semibold text-default">Credit History</h2>
          </div>
        </template>

        <div class="space-y-2">
          <div
            v-for="(change, idx) in balanceChanges"
            :key="idx"
            class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-elevated/50"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium text-default">
                {{ changeLabel(change) }}
              </span>
              <div class="flex items-center gap-2 text-xs text-dimmed">
                <span v-if="change.createTime">{{ formatDate(change.createTime) }}</span>
                <span v-if="change.invoiceNumber">· #{{ change.invoiceNumber }}</span>
              </div>
            </div>
            <span
              class="text-sm font-semibold shrink-0 ml-4"
              :class="change.changeOrigin === 'PURCHASE' ? 'text-success' : 'text-error'"
            >
              {{ change.changeOrigin === 'PURCHASE' ? '+' : '-'
              }}{{ centsToUsd(change.amount.val) }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Raw JSON Debug -->
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
