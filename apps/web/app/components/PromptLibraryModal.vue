<script setup lang="ts">
import { usePromptLibrary, type UserPrompt } from '../composables/usePromptLibrary'

const isModalOpen = defineModel<boolean>('open', { default: false })
const searchQuery = ref('')

const emit = defineEmits<{
  (e: 'use-prompt', promptText: string, presets: Record<string, string>, promptId?: string): void
}>()

const { prompts, loading, fetchPrompts, deletePrompt } = usePromptLibrary()

const filteredPrompts = computed(() => {
  if (!searchQuery.value.trim()) return prompts.value
  const q = searchQuery.value.toLowerCase()
  return prompts.value.filter(
    (p) => p.title?.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q),
  )
})

watch(isModalOpen, (open) => {
  if (open && prompts.value.length === 0) {
    fetchPrompts()
  }
})

function extractPresets(initialPresets?: string | null): Record<string, string> {
  if (!initialPresets) return {}
  try {
    return JSON.parse(initialPresets)
  } catch {
    return {}
  }
}

function handleUsePrompt(p: UserPrompt) {
  emit('use-prompt', p.prompt, extractPresets(p.initialPresets), p.id)
  isModalOpen.value = false
}

async function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this prompt?')) {
    await deletePrompt(id)
  }
}
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    :ui="{
      content: 'sm:max-w-3xl flex flex-col h-[75vh] sm:h-[600px] overflow-hidden bg-default',
      header: 'shrink-0',
      body: 'flex-1 overflow-hidden p-0 bg-muted/10',
      footer: 'shrink-0',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-display font-semibold text-lg flex items-center gap-2">
          <UIcon name="i-lucide-library" class="size-5 text-primary" />
          Prompt Library
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="isModalOpen = false"
        />
      </div>
    </template>

    <template #body>
      <div class="h-full overflow-y-auto p-4 md:p-6 flex flex-col">
        <div v-if="loading" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        </div>

        <div
          v-else-if="prompts.length === 0"
          class="flex flex-col items-center justify-center h-full text-center py-12"
        >
          <UIcon name="i-lucide-bookmark" class="size-12 text-muted mb-4 opacity-50" />
          <h4 class="text-lg font-medium text-default mb-2">No Saved Prompts</h4>
          <p class="text-sm text-dimmed max-w-sm">
            Use the Prompt Builder to compose and refine prompts, then save them here to use again
            later.
          </p>
          <UButton color="primary" variant="outline" class="mt-6" @click="isModalOpen = false">
            Close
          </UButton>
        </div>

        <template v-else>
          <div class="mb-4 shrink-0">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search saved prompts..."
              class="w-full"
              size="sm"
            />
          </div>

          <div
            v-if="filteredPrompts.length === 0"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <UIcon name="i-lucide-search-x" class="size-12 text-muted mb-4 opacity-50" />
            <p class="text-sm text-dimmed">No prompts match your search.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="p in filteredPrompts"
              :key="p.id"
              class="glass-card p-4 flex flex-col group transition-all duration-200 hover:shadow-md hover:border-primary/30"
            >
              <div class="flex items-start justify-between mb-2">
                <h4 class="font-semibold text-sm line-clamp-1 flex-1 pr-2" :title="p.title">
                  {{ p.title || 'Untitled Prompt' }}
                </h4>
                <div
                  class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    class="-my-1 -mr-2"
                    @click="handleDelete(p.id)"
                  />
                </div>
              </div>

              <div
                class="flex-1 bg-default/50 rounded-lg p-3 text-muted line-clamp-4 relative mb-4 font-mono text-xs"
              >
                {{ p.prompt }}
              </div>

              <div
                class="mt-auto flex items-center justify-between pt-2 border-t border-default/10"
              >
                <span class="text-[10px] text-dimmed uppercase tracking-wider font-semibold">
                  {{ new Date(p.createdAt).toLocaleDateString() }}
                </span>
                <UButton
                  size="sm"
                  color="primary"
                  icon="i-lucide-arrow-right"
                  @click="handleUsePrompt(p)"
                >
                  Use
                </UButton>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
