<script setup lang="ts">
import type { PromptElement, PresetMetadata } from '~/composables/usePromptElements'
import { PRESET_ATTRIBUTES } from '~/utils/presetSchemas'

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
  if (props.preset.attributes) {
    try {
      const attrs = JSON.parse(props.preset.attributes) as Record<string, string>
      if (attrs.description) return attrs.description
    } catch {
      /* invalid JSON — fall through */
    }
  }
  // plain content fallback (safety net for legacy data)
  const line = props.preset.content
    .split('\n')
    .find((l) => l.toLowerCase().startsWith('description:'))
  return line ? line.slice(line.indexOf(':') + 1).trim() : props.preset.content.slice(0, 80)
})

const isModalOpen = ref(false)

/**
 * Parse characteristics from structured attributes JSON.
 * Optionally excluding specified keys.
 */
function parseChars(excludeKeys: string[] = []) {
  if (!props.preset.attributes) return []
  try {
    const attrs = JSON.parse(props.preset.attributes) as Record<string, string>
    const schema = PRESET_ATTRIBUTES[props.preset.type]
    const keys = schema ?? Object.keys(attrs)
    return keys
      .filter((k) => !excludeKeys.includes(k) && attrs[k])
      .map((k) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1).replaceAll('_', ' '),
        value: attrs[k]!,
      }))
  } catch {
    return []
  }
}

/** Card preview: excludes name & description (shown separately) */
const parsedCharacteristics = computed(() => parseChars(['name', 'description']))

/** Modal view: ALL attributes including name & description */
const allCharacteristics = computed(() => parseChars([]))

/** Build a state object from content lines for generatePreview */
function parseContentToState(): Record<string, string | null> {
  const state: Record<string, string | null> = {}
  for (const line of props.preset.content.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase().replaceAll(' ', '_')
      const val = line.slice(idx + 1).trim()
      if (val) state[key] = val
    }
  }
  return state
}

const {
  generatePreview,
  generatingPreview,
  previewImageUrl: generatedFullBodyUrl,
  headshotUrl: generatedHeadshotUrl,
} = usePresetEditor()

/** Reactive display URL: prefer freshly generated, fall back to stored */
const displayPreviewUrl = computed(
  () => generatedFullBodyUrl.value || generatedHeadshotUrl.value || previewUrl.value,
)

async function handleGenerateImage() {
  const state = parseContentToState()
  await generatePreview(state, props.preset.type)
}

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
      content: 'sm:max-w-3xl overflow-hidden flex flex-col max-h-[90vh]',
      body: 'p-0 sm:p-0 flex-1 overflow-hidden flex flex-col',
    }"
  >
    <template #body>
      <!-- Image Header Area -->
      <div
        class="bg-black/5 dark:bg-black/40 relative aspect-video sm:aspect-21/9 shrink-0 flex items-center justify-center p-0 overflow-hidden"
      >
        <NuxtImg
          v-if="displayPreviewUrl"
          :src="displayPreviewUrl"
          :alt="preset.name"
          class="w-full h-full object-cover transition-transform duration-[2s] hover:scale-110 opacity-70 blur-xl absolute inset-0 z-0"
          loading="lazy"
        />
        <NuxtImg
          v-if="displayPreviewUrl"
          :src="displayPreviewUrl"
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

        <!-- Generation loading overlay -->
        <div
          v-if="generatingPreview"
          class="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div class="flex flex-col items-center gap-3 text-white">
            <UIcon name="i-lucide-loader-2" class="size-8 animate-spin" />
            <span class="text-sm font-medium">Generating image…</span>
          </div>
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

          <div class="flex items-center gap-2 shrink-0">
            <UButton
              variant="subtle"
              color="primary"
              icon="i-lucide-image-plus"
              size="md"
              class="rounded-full shadow-sm"
              label="Generate Image"
              :loading="generatingPreview"
              @click="handleGenerateImage"
            />
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
        </div>

        <!-- All Characteristics -->
        <div v-if="allCharacteristics.length > 0" class="space-y-4">
          <h3
            class="text-xs font-semibold text-default uppercase tracking-widest border-b border-default pb-2"
          >
            Attributes
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            <div
              v-for="c in allCharacteristics"
              :key="c.label"
              class="bg-elevated p-3 rounded-xl border border-default hover:border-primary/30 transition-colors duration-200"
            >
              <span
                class="text-[10px] text-primary block mb-0.5 uppercase tracking-wider font-medium"
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
