<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Quick Modifiers — Admin',
  description: 'Manage quick modifier snippets for prompt generation',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'Quick Modifiers',
  description: 'Admin interface for managing quick modifier snippets.',
})

const { modifiers, status, saving, createModifier, updateModifier, deleteModifier } =
  useAdminQuickModifiers()

const isCreateOpen = ref(false)
const editingId = ref<string | null>(null)

// Create form state
const createForm = reactive({
  id: '',
  category: 'lighting',
  label: '',
  snippet: '',
  sortOrder: 0,
  enabled: 1,
})

// Edit form state
const editForm = reactive({
  category: '',
  label: '',
  snippet: '',
  sortOrder: 0,
  enabled: 1,
})

const categoryOptions = [
  { label: 'Lighting', value: 'lighting' },
  { label: 'Mood', value: 'mood' },
  { label: 'Camera', value: 'camera' },
  { label: 'Detail', value: 'detail' },
  { label: 'Quality', value: 'quality' },
]

const categoryIcons: Record<string, string> = {
  lighting: 'i-lucide-sun',
  mood: 'i-lucide-drama',
  camera: 'i-lucide-camera',
  detail: 'i-lucide-sparkles',
  quality: 'i-lucide-award',
}

function autoId() {
  createForm.id = createForm.label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

function startEdit(mod: {
  id: string
  category: string
  label: string
  snippet: string
  sortOrder: number
  enabled: number
}) {
  editingId.value = mod.id
  editForm.category = mod.category
  editForm.label = mod.label
  editForm.snippet = mod.snippet
  editForm.sortOrder = mod.sortOrder
  editForm.enabled = mod.enabled
}

function cancelEdit() {
  editingId.value = null
}

async function handleCreate() {
  if (!createForm.id || !createForm.label || !createForm.snippet) return
  try {
    await createModifier({ ...createForm })
    isCreateOpen.value = false
    createForm.id = ''
    createForm.label = ''
    createForm.snippet = ''
    createForm.sortOrder = 0
  } catch {
    // handled by composable
  }
}

async function handleUpdate(id: string) {
  try {
    await updateModifier(id, { ...editForm })
    editingId.value = null
  } catch {
    // handled by composable
  }
}

async function handleDelete(id: string) {
  if (!confirm(`Delete modifier "${id}"?`)) return
  await deleteModifier(id)
}

async function handleToggle(mod: { id: string; enabled: number }) {
  await updateModifier(mod.id, { enabled: mod.enabled ? 0 : 1 })
}

// Group by category for display
const groupedModifiers = computed(() => {
  if (!modifiers.value) return []
  const groups: Record<string, typeof modifiers.value> = {}
  for (const mod of modifiers.value) {
    if (!groups[mod.category]) groups[mod.category] = []
    groups[mod.category]!.push(mod)
  }
  const order = ['lighting', 'mood', 'camera', 'detail', 'quality']
  return order
    .filter((cat) => groups[cat]?.length)
    .map((cat) => ({
      category: cat,
      label: categoryOptions.find((o) => o.value === cat)?.label || cat,
      icon: categoryIcons[cat] || 'i-lucide-tag',
      items: groups[cat]!.sort((a, b) => a.sortOrder - b.sortOrder),
    }))
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        class="mb-4 -ml-2"
      >
        Back to Admin
      </UButton>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="font-display text-3xl font-bold">Quick Modifiers</h1>
          <p class="text-muted mt-2">
            Lightweight prompt snippets that users can toggle on the generate page.
          </p>
        </div>
        <UButton icon="i-lucide-plus" @click="isCreateOpen = true">Add Modifier</UButton>
      </div>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center p-12">
      <UIcon name="i-lucide-loader-2" class="size-8 text-primary animate-spin" />
    </div>

    <div v-else class="space-y-8">
      <div v-for="group in groupedModifiers" :key="group.category" class="space-y-3">
        <h2
          class="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2"
        >
          <UIcon :name="group.icon" class="size-4" />
          {{ group.label }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="mod in group.items"
            :key="mod.id"
            class="glass-card p-4 rounded-xl"
            :class="{ 'opacity-50': !mod.enabled }"
          >
            <!-- Edit Mode -->
            <div v-if="editingId === mod.id" class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UFormField label="Category">
                  <USelect v-model="editForm.category" :items="categoryOptions" class="w-full" />
                </UFormField>
                <UFormField label="Label">
                  <UInput v-model="editForm.label" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="Snippet">
                <UTextarea v-model="editForm.snippet" :rows="2" autoresize class="w-full" />
              </UFormField>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Sort Order">
                  <UInput v-model.number="editForm.sortOrder" type="number" class="w-full" />
                </UFormField>
                <UFormField label="Enabled">
                  <USelect
                    v-model="editForm.enabled"
                    :items="[
                      { label: 'Enabled', value: 1 },
                      { label: 'Disabled', value: 0 },
                    ]"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="ghost" @click="cancelEdit">Cancel</UButton>
                <UButton color="primary" :loading="saving" @click="handleUpdate(mod.id)">
                  Save
                </UButton>
              </div>
            </div>

            <!-- Read Mode -->
            <div v-else class="flex items-center justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-default">{{ mod.label }}</span>
                  <UBadge variant="subtle" color="neutral" size="xs">{{ mod.id }}</UBadge>
                  <UBadge v-if="!mod.enabled" variant="subtle" color="error" size="xs">
                    Disabled
                  </UBadge>
                </div>
                <p class="text-sm text-muted mt-0.5 font-mono">{{ mod.snippet }}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UButton
                  variant="ghost"
                  color="neutral"
                  :icon="mod.enabled ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  size="sm"
                  @click="handleToggle(mod)"
                />
                <UButton
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  size="sm"
                  @click="startEdit(mod)"
                />
                <UButton
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  size="sm"
                  @click="handleDelete(mod.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!groupedModifiers.length"
        class="text-center py-12 border border-dashed border-default rounded-2xl"
      >
        <UIcon name="i-lucide-sparkles" class="size-12 mx-auto text-dimmed mb-4" />
        <h3 class="text-lg font-medium">No quick modifiers yet</h3>
        <p class="text-sm text-muted mt-1 mb-6">
          Add lighting, mood, camera, and quality snippets for fast prompt building.
        </p>
        <UButton variant="outline" icon="i-lucide-plus" @click="isCreateOpen = true">
          Add First Modifier
        </UButton>
      </div>
    </div>

    <!-- Create Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #header>
        <h3 class="font-display font-semibold text-lg flex items-center gap-2">
          <UIcon name="i-lucide-plus-circle" class="size-5 text-primary" />
          New Quick Modifier
        </h3>
      </template>

      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormField label="Category">
              <USelect v-model="createForm.category" :items="categoryOptions" class="w-full" />
            </UFormField>
            <UFormField label="Label">
              <UInput
                v-model="createForm.label"
                placeholder="e.g. Golden Hour"
                class="w-full"
                @input="autoId"
              />
            </UFormField>
          </div>
          <UFormField label="ID (slug)" description="Auto-generated from label">
            <UInput v-model="createForm.id" placeholder="golden-hour" class="w-full" />
          </UFormField>
          <UFormField label="Snippet" description="Text appended to the prompt">
            <UTextarea
              v-model="createForm.snippet"
              placeholder="golden hour warm sunlight, long shadows"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sort Order">
            <UInput v-model.number="createForm.sortOrder" type="number" class="w-24" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" @click="isCreateOpen = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-save"
            :loading="saving"
            :disabled="!createForm.id || !createForm.label || !createForm.snippet"
            @click="handleCreate"
          >
            Create
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
