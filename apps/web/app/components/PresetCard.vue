<script setup lang="ts">
import type { PromptElement, PresetMetadata } from '~/composables/usePromptElements'

const props = defineProps<{
  preset: PromptElement
}>()

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

function handleEdit() {
  navigateTo(`/presets/${props.preset.id}`)
}

function handleDelete() {
  emit('delete', props.preset.id)
}
</script>

<template>
  <div
    class="preset-card group card-base overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer"
    @click="navigateTo(`/presets/${preset.id}`)"
  >
    <!-- Image / Placeholder -->
    <div class="relative aspect-4/5 overflow-hidden bg-elevated">
      <!-- Actual preview image -->
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="preset.name"
        class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
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

      <!-- Type badge overlay -->
      <div class="absolute top-3 left-3">
        <UBadge :color="config!.color as any" variant="subtle" size="sm" class="backdrop-blur-sm">
          <UIcon :name="config!.icon" class="size-3 mr-1" />
          {{ config!.label }}
        </UBadge>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-2">
      <h3 class="font-display font-semibold text-default truncate text-sm">
        {{ preset.name }}
      </h3>
      <p class="text-xs text-muted line-clamp-2 leading-relaxed">
        {{ cardDescription }}
      </p>
    </div>

    <!-- Actions (visible on hover / always on mobile) -->
    <div
      class="px-4 pb-4 flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
    >
      <UButton
        variant="ghost"
        color="primary"
        icon="i-lucide-pencil"
        size="xs"
        class="rounded-full flex-1"
        @click.stop="handleEdit"
      >
        Edit
      </UButton>
      <UButton
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        size="xs"
        class="rounded-full"
        @click.stop="handleDelete"
      />
    </div>
  </div>
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
