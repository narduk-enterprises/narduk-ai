<script setup lang="ts">
import type { PromptTagCategory } from '~/types/promptTag'

const isOpen = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  tagCategories: PromptTagCategory[]
  selectedTagsList: { id: string; label: string }[]
  filteredTags: { id: string; label: string }[]
  tagSearchQuery: string
}>()

const emit = defineEmits<{
  'toggle-tag': [id: string]
  'update:tagSearchQuery': [val: string]
}>()

const activeModifierCategory = ref<PromptTagCategory | null>(null)

watch(
  () => props.tagCategories,
  (newVal) => {
    if (newVal.length > 0 && !activeModifierCategory.value) {
      activeModifierCategory.value = newVal[0] ?? null
    }
  },
  { immediate: true },
)

function isTagSelected(id: string) {
  return props.selectedTagsList.some((t) => t.id === id)
}
</script>

<template>
  <USlideover v-model:open="isOpen" title="Quick Modifiers">
    <template #body>
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Search Input -->
        <div class="p-3 sm:px-4 sm:py-3 border-b border-default/10 shrink-0">
          <UInput
            :model-value="props.tagSearchQuery"
            icon="i-lucide-search"
            placeholder="Search modifiers..."
            class="w-full"
            @update:model-value="emit('update:tagSearchQuery', $event as string)"
          >
            <template #trailing>
              <UButton
                v-if="props.tagSearchQuery"
                color="neutral"
                variant="link"
                icon="i-lucide-x"
                :padded="false"
                @click="emit('update:tagSearchQuery', '')"
              />
            </template>
          </UInput>
        </div>

        <!-- Slideover Content area -->
        <div
          class="flex-1 overflow-hidden"
          :class="props.tagSearchQuery ? 'p-4 overflow-y-auto' : 'flex'"
        >
          <!-- Search Results -->
          <div v-if="props.tagSearchQuery">
            <div v-if="filteredTags.length" class="flex flex-wrap gap-1.5">
              <UButton
                v-for="tag in filteredTags"
                :key="tag.id"
                size="xs"
                :variant="isTagSelected(tag.id) ? 'solid' : 'outline'"
                :color="isTagSelected(tag.id) ? 'primary' : 'neutral'"
                class="rounded-full transition-shadow duration-200"
                :class="isTagSelected(tag.id) ? 'shadow-sm shadow-primary/20' : ''"
                @click="emit('toggle-tag', tag.id)"
              >
                {{ tag.label }}
              </UButton>
            </div>
            <div v-else class="text-center text-muted py-8 text-sm">
              No modifiers found for "{{ props.tagSearchQuery }}"
            </div>
          </div>

          <!-- Category Tabs (No Search) -->
          <template v-else>
            <!-- Sidebar -->
            <div
              class="w-1/3 sm:w-2/5 border-r border-default/10 overflow-y-auto py-2 flex shrink-0 flex-col"
            >
              <UButton
                v-for="cat in tagCategories"
                :key="cat.attributeKey"
                variant="ghost"
                :color="
                  activeModifierCategory?.attributeKey === cat.attributeKey ? 'primary' : 'neutral'
                "
                class="w-full justify-start rounded-none px-3 py-2 text-left shrink-0"
                :class="
                  activeModifierCategory?.attributeKey === cat.attributeKey
                    ? 'bg-primary/10 font-medium'
                    : 'text-muted'
                "
                @click="activeModifierCategory = cat"
              >
                <span class="truncate text-xs sm:text-sm">{{ cat.label }}</span>
              </UButton>
            </div>
            <!-- Content -->
            <div class="flex-1 p-3 sm:p-4 overflow-y-auto">
              <div v-if="activeModifierCategory" class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="tag in activeModifierCategory.tags"
                  :key="tag.id"
                  size="xs"
                  :variant="isTagSelected(tag.id) ? 'solid' : 'outline'"
                  :color="isTagSelected(tag.id) ? 'primary' : 'neutral'"
                  class="rounded-full transition-shadow duration-200"
                  :class="isTagSelected(tag.id) ? 'shadow-sm shadow-primary/20' : ''"
                  @click="emit('toggle-tag', tag.id)"
                >
                  {{ tag.label }}
                </UButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end p-3 sm:pr-4 sm:pb-4 sm:pt-2">
        <UButton color="primary" @click="isOpen = false"> Done </UButton>
      </div>
    </template>
  </USlideover>
</template>
