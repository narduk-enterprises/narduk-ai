<script setup lang="ts">
import { PRESET_ATTRIBUTES } from '~/utils/presetSchemas'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Presets — Narduk AI',
  description: 'Browse and manage your prompt presets for AI generation.',
})
useWebPageSchema({
  name: 'Presets — Narduk AI',
  description: 'Browse and manage your prompt presets for AI generation.',
})

const { elements, groupedByType, loading, error, ensureLoaded, createElement, deleteElement } =
  usePromptElements()

onMounted(ensureLoaded)

// ── Filters ────────────────────────────────────────────────
const activeFilter = ref('all')

const filters = [
  { value: 'all', label: 'All', icon: 'i-lucide-layout-grid' },
  { value: 'person', label: 'Persons', icon: 'i-lucide-user' },
  { value: 'scene', label: 'Scenes', icon: 'i-lucide-image' },
  { value: 'framing', label: 'Framing', icon: 'i-lucide-camera' },
  { value: 'action', label: 'Actions', icon: 'i-lucide-activity' },
  { value: 'style', label: 'Styles', icon: 'i-lucide-palette' },
  { value: 'prompt', label: 'Prompts', icon: 'i-lucide-file-text' },
]

const filteredElements = computed(() => {
  if (activeFilter.value === 'all') return elements.value
  return elements.value.filter((el) => el.type === activeFilter.value)
})

const filterCounts = computed(() => {
  const counts: Record<string, number> = { all: elements.value.length }
  for (const el of elements.value) {
    counts[el.type] = (counts[el.type] || 0) + 1
  }
  return counts
})

// Build ordered category sections for the "All" view
const categorySections = computed(() => {
  const order = ['person', 'scene', 'clothing', 'framing', 'action', 'style', 'prompt']
  const labelMap: Record<string, string> = {
    person: 'Persons',
    scene: 'Scenes',
    clothing: 'Clothing',
    framing: 'Framing',
    action: 'Actions',
    style: 'Styles',
    prompt: 'Prompts',
  }
  const iconMap: Record<string, string> = {
    person: 'i-lucide-user',
    scene: 'i-lucide-image',
    clothing: 'i-lucide-shirt',
    framing: 'i-lucide-camera',
    action: 'i-lucide-activity',
    style: 'i-lucide-palette',
    prompt: 'i-lucide-file-text',
  }
  return order
    .map((type) => ({
      type,
      label: labelMap[type] || type,
      icon: iconMap[type] || 'i-lucide-file-text',
      items: groupedByType.value[type] || [],
    }))
    .filter((s) => s.items.length > 0)
})

// ── Actions ────────────────────────────────────────────────
const submitting = ref(false)

const presetTypes = [
  { label: 'Person', value: 'person', icon: 'i-lucide-user' },
  { label: 'Scene', value: 'scene', icon: 'i-lucide-image' },
  { label: 'Framing', value: 'framing', icon: 'i-lucide-camera' },
  { label: 'Action', value: 'action', icon: 'i-lucide-activity' },
  { label: 'Style', value: 'style', icon: 'i-lucide-palette' },
]

const dropdownItems = computed(() =>
  presetTypes.map((t) => ({
    label: t.label,
    icon: t.icon,
    onSelect: () => handleCreate(t.value),
  })),
)

async function handleCreate(type: string) {
  submitting.value = true
  try {
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    const name = `New ${label}`

    // Seed schema-keyed attributes so new presets are never attributes-null
    const schema = PRESET_ATTRIBUTES[type] ?? []
    const initialAttrs: Record<string, string | null> = { name }
    for (const key of schema) {
      if (key !== 'name') initialAttrs[key] = null
    }
    const attributesJson = JSON.stringify(initialAttrs)
    const content = `Name: ${name}`

    const created = await createElement(type, name, content, null, attributesJson)
    if (created?.id) {
      navigateTo(`/presets/${created.id}`)
    }
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this preset?')) {
    await deleteElement(id)
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-safe">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="font-display text-3xl sm:text-4xl font-bold mb-2">Presets</h1>
        <p class="text-muted">Browse your prompt library and build faster</p>
      </div>
      <UDropdownMenu :items="dropdownItems">
        <UButton
          icon="i-lucide-plus"
          label="New Preset"
          class="rounded-full self-start shadow-lg hover:shadow-primary/20 transition-shadow"
          :loading="submitting"
        />
      </UDropdownMenu>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap gap-2 mb-8">
      <UButton
        v-for="f in filters"
        :key="f.value"
        :icon="f.icon"
        :variant="activeFilter === f.value ? 'solid' : 'outline'"
        :color="activeFilter === f.value ? 'primary' : 'neutral'"
        size="sm"
        class="rounded-full"
        :class="activeFilter === f.value ? 'shadow-lg shadow-primary/20' : ''"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
        <UBadge
          v-if="filterCounts[f.value]"
          :color="activeFilter === f.value ? 'neutral' : 'primary'"
          variant="subtle"
          size="xs"
          class="ml-1"
        >
          {{ filterCounts[f.value] }}
        </UBadge>
      </UButton>
    </div>

    <!-- Error state -->
    <UAlert v-if="error" color="error" icon="i-lucide-alert-triangle" :title="error" class="mb-6" />

    <!-- Loading Skeleton -->
    <div v-if="loading && !elements.length" class="preset-grid">
      <div v-for="i in 8" :key="i" class="card-base overflow-hidden">
        <USkeleton class="aspect-4/5 w-full" />
        <div class="p-4 space-y-2">
          <USkeleton class="h-4 w-2/3" />
          <USkeleton class="h-3 w-full" />
          <USkeleton class="h-3 w-4/5" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!filteredElements.length && !loading"
      class="flex flex-col items-center gap-5 py-24 text-center"
    >
      <div class="size-20 rounded-2xl bg-primary/5 flex items-center justify-center">
        <UIcon name="i-lucide-bookmark-plus" class="size-10 text-dimmed" />
      </div>
      <div>
        <p class="text-lg font-medium mb-1">
          {{ activeFilter === 'all' ? 'No presets yet' : `No ${activeFilter} presets` }}
        </p>
        <p class="text-sm text-muted max-w-sm mx-auto">
          Create reusable text snippets like characters, scenes, and camera angles to speed up your
          generation workflow.
        </p>
      </div>
      <UDropdownMenu :items="dropdownItems">
        <UButton
          icon="i-lucide-plus"
          label="Create your first preset"
          class="rounded-full"
          :loading="submitting"
        />
      </UDropdownMenu>
    </div>

    <!-- Preset Grid: grouped by category when viewing all, flat grid otherwise -->
    <template v-else>
      <!-- Grouped by category -->
      <div v-if="activeFilter === 'all'" class="space-y-10">
        <section v-for="section in categorySections" :key="section.type">
          <div class="flex items-center gap-2 mb-4">
            <UIcon :name="section.icon" class="size-5 text-muted" />
            <h2 class="font-display text-lg font-semibold">{{ section.label }}</h2>
            <UBadge variant="subtle" size="xs" class="ml-1">{{ section.items.length }}</UBadge>
          </div>
          <div class="preset-grid stagger-children">
            <PresetCard
              v-for="el in section.items"
              :key="el.id"
              :preset="el"
              @delete="handleDelete"
            />
          </div>
        </section>
      </div>

      <!-- Flat grid for specific filter -->
      <div v-else class="preset-grid stagger-children">
        <PresetCard
          v-for="el in filteredElements"
          :key="el.id"
          :preset="el"
          @delete="handleDelete"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.preset-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.25rem;
}

@media (min-width: 480px) {
  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .preset-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .preset-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
