<script setup lang="ts">
import type { PromptElement } from '~/composables/usePromptElements'
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Presets — Narduk AI',
  description: 'Browse and manage your prompt presets for AI generation.',
})
useWebPageSchema({
  name: 'Presets — Narduk AI',
  description: 'Browse and manage your prompt presets for AI generation.',
})

const { elements, loading, error, fetchElements, createElement, updateElement, deleteElement } =
  usePromptElements()

onMounted(fetchElements)

// ── Filters ────────────────────────────────────────────────
const activeFilter = ref('all')

const filters = [
  { value: 'all', label: 'All', icon: 'i-lucide-layout-grid' },
  { value: 'person', label: 'Persons', icon: 'i-lucide-user' },
  { value: 'scene', label: 'Scenes', icon: 'i-lucide-image' },
  { value: 'framing', label: 'Framing', icon: 'i-lucide-camera' },
  { value: 'action', label: 'Actions', icon: 'i-lucide-activity' },
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

// ── Create / Edit Modal ────────────────────────────────────
const isModalOpen = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const isEditing = computed(() => editingId.value !== null)

const schema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action', 'prompt']),
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string().min(1, 'Content is required').max(2000),
})

type Schema = z.infer<typeof schema>

const state = reactive<Schema>({
  type: 'person',
  name: '',
  content: '',
})

const typeOptions = [
  { label: 'Person / Character', value: 'person' },
  { label: 'Scene / Environment', value: 'scene' },
  { label: 'Framing / Camera', value: 'framing' },
  { label: 'Action / Pose', value: 'action' },
  { label: 'Assembled Prompt', value: 'prompt' },
]

function openCreate() {
  editingId.value = null
  state.type = 'person'
  state.name = ''
  state.content = ''
  isModalOpen.value = true
}

function openEdit(el: PromptElement) {
  editingId.value = el.id
  state.type = el.type as Schema['type']
  state.name = el.name
  state.content = el.content
  isModalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true
  try {
    if (editingId.value) {
      await updateElement(editingId.value, {
        type: event.data.type,
        name: event.data.name,
        content: event.data.content,
      })
    } else {
      await createElement(event.data.type, event.data.name, event.data.content)
    }
    isModalOpen.value = false
    editingId.value = null
    state.name = ''
    state.content = ''
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

function handleUse(preset: PromptElement) {
  navigateTo({ path: '/generate', query: { prompt: preset.content } })
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
      <UButton
        icon="i-lucide-plus"
        label="New Preset"
        class="rounded-full self-start shadow-lg hover:shadow-primary/20 transition-shadow"
        @click="openCreate"
      />
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
      <UButton
        icon="i-lucide-plus"
        label="Create your first preset"
        class="rounded-full"
        @click="openCreate"
      />
    </div>

    <!-- Preset Grid -->
    <div v-else class="preset-grid stagger-children">
      <PresetCard
        v-for="el in filteredElements"
        :key="el.id"
        :preset="el"
        @edit="openEdit"
        @delete="handleDelete"
        @use="handleUse"
      />
    </div>

    <!-- Create / Edit Modal -->
    <UModal v-model:open="isModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-display font-semibold text-lg flex items-center gap-2">
              <UIcon
                :name="isEditing ? 'i-lucide-pencil' : 'i-lucide-plus-circle'"
                class="size-5 text-primary"
              />
              {{ isEditing ? 'Edit Preset' : 'New Preset' }}
            </h3>
          </template>

          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UFormField label="Type" name="type">
              <USelect v-model="state.type" :items="typeOptions" class="w-full" />
            </UFormField>

            <UFormField label="Name" name="name" description="A short, memorable title">
              <UInput v-model="state.name" placeholder="e.g. Elf Ranger" class="w-full" />
            </UFormField>

            <UFormField label="Content" name="content" description="The actual prompt text snippet">
              <UTextarea
                v-model="state.content"
                placeholder="A tall elegant elven ranger wearing a green cloak..."
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-4 border-t border-default/50 mt-6">
              <UButton type="button" color="neutral" variant="ghost" @click="isModalOpen = false">
                Cancel
              </UButton>
              <UButton type="submit" color="primary" icon="i-lucide-save" :loading="submitting">
                {{ isEditing ? 'Update Preset' : 'Save Preset' }}
              </UButton>
            </div>
          </UForm>
        </UCard>
      </template>
    </UModal>
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
