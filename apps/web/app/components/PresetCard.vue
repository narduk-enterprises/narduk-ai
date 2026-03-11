<script setup lang="ts">
import type { PromptElement, PresetMetadata } from '~/composables/usePromptElements'

const props = defineProps<{
  preset: PromptElement
}>()

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  delete: [id: string]
}>()

const parsedMeta = computed<PresetMetadata>(() => {
  if (!props.preset.metadata) return {}
  try {
    return JSON.parse(props.preset.metadata) as PresetMetadata
  } catch {
    return {}
  }
})

const previewUrl = computed(
  () => parsedMeta.value.headshotUrl || parsedMeta.value.fullBodyUrl || null,
)

const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  person: { icon: 'i-lucide-user', label: 'Person', color: 'primary' },
  scene: { icon: 'i-lucide-image', label: 'Scene', color: 'info' },
  framing: { icon: 'i-lucide-camera', label: 'Framing', color: 'warning' },
  action: { icon: 'i-lucide-activity', label: 'Action', color: 'success' },
  prompt: { icon: 'i-lucide-file-text', label: 'Prompt', color: 'neutral' },
}

const config = computed(() => typeConfig[props.preset.type] || typeConfig.prompt)

const cardDescription = computed(() => {
  // Try to extract description from content lines
  const lines = props.preset.content.split('\n')
  for (const line of lines) {
    const lower = line.toLowerCase().trim()
    if (lower.startsWith('description:')) {
      return line.slice(line.indexOf(':') + 1).trim()
    }
  }
  // Fallback: show first non-name line or truncated content
  const meaningful = lines
    .filter((l) => l.trim() && !l.toLowerCase().startsWith('name:'))
    .slice(0, 2)
    .map((l) => l.trim())
    .join(' · ')
  return meaningful || props.preset.content
})

const isModalOpen = ref(false)

const parsedCharacteristics = computed(() => {
  const meta = parsedMeta.value
  // Exclude url-related keys and other generic fields
  const exclude = ['headshotUrl', 'fullBodyUrl', 'other', 'id', 'name']
  const chars: { label: string; value: string }[] = []
  for (const [key, val] of Object.entries(meta)) {
    if (!exclude.includes(key) && val && typeof val === 'string' && val.trim() !== '') {
      chars.push({
        label: key.charAt(0).toUpperCase() + key.slice(1).replaceAll(/([A-Z])/g, ' $1'),
        value: val,
      })
    }
  }
  return chars
})

function handleEdit() {
  navigateTo(`/presets/${props.preset.id}`)
}

function handleDelete() {
  emit('delete', props.preset.id)
}

function openModal() {
  isModalOpen.value = true
}
</script>

<template>
  <div
    class="preset-card group card-base overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer flex flex-col h-full"
    @click="openModal"
  >
    <!-- Image / Placeholder -->
    <div
      class="aspect-3/4 w-full bg-black/5 dark:bg-black/40 flex items-center justify-center relative overflow-hidden text-center z-10 transition-transform duration-300"
    >
      <NuxtImg
        v-if="previewUrl"
        :src="previewUrl"
        :alt="preset.name"
        class="size-full object-contain transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      <!-- Gradient icon placeholder when no image -->
      <div
        v-else
        class="size-full flex items-center justify-center preset-placeholder"
        :class="`preset-placeholder--${preset.type}`"
      >
        <UIcon
          :name="config!.icon"
          class="size-12 text-default/20 transition-transform duration-300 group-hover:scale-110"
        />
      </div>
    </div>

    <!-- Type badge overlay -->
    <div class="absolute top-3 left-3">
      <UBadge :color="config!.color as any" variant="subtle" size="sm" class="backdrop-blur-sm">
        <UIcon :name="config!.icon" class="size-3 mr-1" />
        {{ config!.label }}
      </UBadge>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-2 flex-1 flex flex-col">
      <div>
        <h3 class="font-display font-semibold text-default truncate text-sm">
          {{ preset.name }}
        </h3>
        <p class="text-xs text-muted line-clamp-2 leading-relaxed">
          {{ cardDescription }}
        </p>
      </div>

      <!-- Characteristics Preview Snippet -->
      <div v-if="parsedCharacteristics.length > 0" class="flex flex-wrap gap-1 mt-auto pt-2">
        <UBadge
          v-for="c in parsedCharacteristics.slice(0, 3)"
          :key="c.label"
          variant="subtle"
          size="sm"
          class="text-[10px] px-1.5 py-0.5 shadow-none"
          color="neutral"
        >
          {{ c.label }}: {{ c.value }}
        </UBadge>
        <UBadge
          v-if="parsedCharacteristics.length > 3"
          variant="subtle"
          size="sm"
          class="text-[10px] px-1.5 py-0.5 shadow-none"
          color="neutral"
        >
          +{{ parsedCharacteristics.length - 3 }}
        </UBadge>
      </div>
    </div>

    <!-- Actions -->
    <div
      class="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20 flex gap-1 bg-black/40 p-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm"
    >
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-pencil"
        size="xs"
        class="rounded-full text-white hover:text-white hover:bg-white/20 transition-colors"
        @click.stop="handleEdit"
      />
      <UButton
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        size="xs"
        class="rounded-full hover:bg-white/20 transition-colors"
        @click.stop="handleDelete"
      />
    </div>
  </div>

  <!-- Detail Modal -->
  <UModal
    v-model:open="isModalOpen"
    :ui="{
      content: 'overflow-hidden flex flex-col max-h-[90vh]',
      body: 'p-0 sm:p-0 flex-1 overflow-hidden flex flex-col',
    }"
  >
    <template #body>
      <!-- Image Header Area -->
      <div
        class="bg-black/5 dark:bg-black/40 relative aspect-video sm:aspect-21/9 shrink-0 flex items-center justify-center p-0 overflow-hidden"
      >
        <NuxtImg
          v-if="previewUrl"
          :src="previewUrl"
          :alt="preset.name"
          class="w-full h-full object-cover transition-transform duration-[2s] hover:scale-110 opacity-70 blur-xl absolute inset-0 z-0"
          loading="lazy"
        />
        <NuxtImg
          v-if="previewUrl"
          :src="previewUrl"
          :alt="preset.name"
          class="w-full h-full object-contain max-h-[35vh] z-10 relative drop-shadow-xl"
          loading="lazy"
        />
        <div
          v-else
          class="size-full flex items-center justify-center preset-placeholder absolute inset-0 z-0"
          :class="`preset-placeholder--${preset.type}`"
        >
          <UIcon :name="config!.icon" class="size-16 text-default/20" />
        </div>

        <div class="absolute top-4 right-4 z-20 flex gap-2">
          <UButton
            color="neutral"
            variant="solid"
            icon="i-lucide-x"
            class="rounded-full shadow-md hover:scale-105 transition-transform"
            @click="isModalOpen = false"
          />
        </div>
      </div>

      <!-- Scrollable Details -->
      <div class="p-6 md:p-8 overflow-y-auto flex-1">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <UBadge :color="config!.color as any" variant="subtle" size="sm">
                <UIcon :name="config!.icon" class="size-3 mr-1" />
                {{ config!.label }}
              </UBadge>
            </div>
            <h2 class="font-display text-2xl font-bold text-default tracking-tight">
              {{ preset.name }}
            </h2>
          </div>

          <UButton
            variant="solid"
            color="primary"
            icon="i-lucide-pencil"
            size="md"
            class="rounded-full shadow-sm"
            label="Edit Preset"
            @click="handleEdit"
          />
        </div>

        <div class="prose prose-sm dark:prose-invert text-dimmed mb-8 max-w-none text-base">
          <p>{{ cardDescription }}</p>
        </div>

        <!-- All Characteristics -->
        <div v-if="parsedCharacteristics.length > 0" class="space-y-4">
          <h3
            class="text-xs font-semibold text-default uppercase tracking-widest border-b border-default pb-2"
          >
            Characteristics
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div
              v-for="c in parsedCharacteristics"
              :key="c.label"
              class="bg-elevated p-3 rounded-xl border border-default hover:border-primary/30 transition-colors duration-200"
            >
              <span
                class="text-[10px] text-muted block mb-0.5 uppercase tracking-wider font-medium"
                >{{ c.label }}</span
              >
              <span class="text-sm text-default font-medium leading-tight">{{ c.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.preset-placeholder {
  background: linear-gradient(135deg, var(--ui-bg-elevated) 0%, var(--ui-bg-muted) 100%);
}

.preset-placeholder--person {
  background: linear-gradient(
    135deg,
    color-mix(in oklch, var(--ui-primary), transparent 85%) 0%,
    var(--ui-bg-elevated) 100%
  );
}

.preset-placeholder--scene {
  background: linear-gradient(
    135deg,
    color-mix(in oklch, var(--ui-info), transparent 85%) 0%,
    var(--ui-bg-elevated) 100%
  );
}

.preset-placeholder--framing {
  background: linear-gradient(
    135deg,
    color-mix(in oklch, var(--ui-warning), transparent 85%) 0%,
    var(--ui-bg-elevated) 100%
  );
}

.preset-placeholder--action {
  background: linear-gradient(
    135deg,
    color-mix(in oklch, var(--ui-success), transparent 85%) 0%,
    var(--ui-bg-elevated) 100%
  );
}
</style>
