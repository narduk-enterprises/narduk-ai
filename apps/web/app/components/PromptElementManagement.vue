<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

const { elements, loading, error, fetchElements, createElement, updateElement, deleteElement } =
  usePromptElements()

onMounted(fetchElements)

const isModalOpen = ref(false)
const submitting = ref(false)

const schema = z.object({
  type: z.enum(['person', 'scene', 'framing', 'action']),
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string().min(1, 'Content is required').max(2000),
})

type Schema = z.infer<typeof schema>

const state = reactive<Schema>({
  type: 'person',
  name: '',
  content: '',
})

const options = [
  { label: 'Person / Character', value: 'person' },
  { label: 'Scene / Environment', value: 'scene' },
  { label: 'Framing / Camera', value: 'framing' },
  { label: 'Action / Pose', value: 'action' },
  { label: 'Assembled Prompt', value: 'prompt' },
]

const editingId = ref<string | null>(null)
const isEditing = computed(() => editingId.value !== null)

function openEdit(el: { id: string; type: string; name: string; content: string }) {
  editingId.value = el.id
  state.type = el.type as Schema['type']
  state.name = el.name
  state.content = el.content
  isModalOpen.value = true
}

function openCreate() {
  editingId.value = null
  state.type = 'person'
  state.name = ''
  state.content = ''
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

// Group for Accordion
const groupedElements = computed(() => {
  type Group = { label: string; type: string; icon: string; items: typeof elements.value }
  const groups: Group[] = [
    { label: 'Persons', type: 'person', icon: 'i-lucide-user', items: [] },
    { label: 'Scenes', type: 'scene', icon: 'i-lucide-image', items: [] },
    { label: 'Framings', type: 'framing', icon: 'i-lucide-camera', items: [] },
    { label: 'Actions', type: 'action', icon: 'i-lucide-activity', items: [] },
    { label: 'Prompts', type: 'prompt', icon: 'i-lucide-file-text', items: [] },
  ]

  for (const el of elements.value) {
    const group = groups.find((g) => g.type === el.type)
    if (group) group.items.push(el)
  }

  return groups.filter((g) => g.items.length > 0)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-display font-semibold">Prompt Library</h2>
        <p class="text-sm text-muted">
          Manage your saved presets to quickly build generation prompts.
        </p>
      </div>
      <UButton icon="i-lucide-plus" @click="openCreate">Add Preset</UButton>
    </div>

    <!-- Error state -->
    <UAlert v-if="error" color="error" icon="i-lucide-alert-triangle" :title="error" />

    <!-- Loading skeleton -->
    <div v-if="loading && !elements.length" class="space-y-3">
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!elements.length"
      class="text-center py-12 border border-dashed border-default rounded-2xl"
    >
      <UIcon name="i-lucide-bookmark-plus" class="size-12 mx-auto text-dimmed mb-4" />
      <h3 class="text-lg font-medium">No presets yet</h3>
      <p class="text-sm text-muted mt-1 max-w-sm mx-auto mb-6">
        Create reusable snippets like "Cyberpunk cityscape" or "Cinematic wide angle" to speed up
        your workflow.
      </p>
      <UButton variant="outline" icon="i-lucide-plus" @click="openCreate"
        >Create your first preset</UButton
      >
    </div>

    <!-- Accordion List -->
    <UAccordion
      v-else
      :items="groupedElements"
      type="multiple"
      :default-value="groupedElements.map((g) => g.label)"
    >
      <template #content="{ item }">
        <div class="space-y-3 p-1">
          <div
            v-for="el in item.items"
            :key="el.id"
            class="flex items-start justify-between gap-4 p-4 rounded-xl border border-default bg-elevated/50 hover:bg-elevated transition-colors"
          >
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-default truncate">{{ el.name }}</h4>
              <p class="text-sm text-muted mt-1 wrap-break-word font-mono opacity-80">
                {{ el.content }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0 -mr-2">
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                size="xs"
                @click="openEdit(el)"
              />
              <UButton
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                size="xs"
                @click="handleDelete(el.id)"
              />
            </div>
          </div>
        </div>
      </template>
    </UAccordion>

    <!-- Create Modal -->
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
              <USelect v-model="state.type" :items="options" class="w-full" />
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
