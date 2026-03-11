<script setup lang="ts">
import type { AspectRatio, Resolution } from '~/composables/useSettings'

definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Settings — Narduk AI',
  description: 'Configure your default generation preferences.',
})
useWebPageSchema({
  name: 'Settings — Narduk AI',
  description: 'Configure your default generation preferences.',
})

const { defaultAspectRatio, defaultDuration, defaultResolution, resetDefaults } = useSettings()

const aspectRatioOptions = [
  { label: '9:16 (Portrait)', value: '9:16' },
  { label: '16:9 (Landscape)', value: '16:9' },
  { label: '1:1 (Square)', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
]

const resolutionOptions = [
  { label: '720p', value: '720p' },
  { label: '480p', value: '480p' },
]

const localAspectRatio = ref(defaultAspectRatio.value)
const localDuration = ref(defaultDuration.value)
const localResolution = ref(defaultResolution.value)

watch(localAspectRatio, (v) => {
  defaultAspectRatio.value = v as AspectRatio
})
watch(localDuration, (v) => {
  defaultDuration.value = v
})
watch(localResolution, (v) => {
  defaultResolution.value = v as Resolution
})

function handleReset() {
  resetDefaults()
  localAspectRatio.value = '9:16'
  localDuration.value = 6
  localResolution.value = '720p'
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-12 space-y-8 pb-safe">
    <!-- Page Header -->
    <div>
      <h1 class="font-display text-3xl font-bold">Settings</h1>
      <p class="text-muted mt-1">Default preferences for new generations.</p>
    </div>

    <!-- Prompt Library Management -->
    <div class="glass-card p-6">
      <PromptElementManagement />
    </div>

    <!-- Video Defaults -->
    <div class="glass-card p-6 space-y-6">
      <h2 class="font-display text-lg font-semibold flex items-center gap-2">
        <UIcon name="i-lucide-video" class="size-5 text-primary" />
        Video Defaults
      </h2>

      <!-- Aspect Ratio -->
      <UFormField label="Aspect Ratio">
        <USelect
          v-model="localAspectRatio"
          :items="aspectRatioOptions"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Duration">
        <template #hint>
          <span class="tabular-nums">{{ localDuration }}s</span>
        </template>
        <USlider v-model="localDuration" :min="1" :max="15" :step="1" />
        <div class="flex justify-between text-xs text-dimmed mt-1">
          <span>1s</span>
          <span>15s</span>
        </div>
      </UFormField>

      <UFormField label="Resolution">
        <URadioGroup v-model="localResolution" :items="resolutionOptions" value-key="value" />
      </UFormField>
    </div>

    <!-- API Features -->
    <div class="glass-card p-6 space-y-4">
      <h2 class="font-display text-lg font-semibold flex items-center gap-2">
        <UIcon name="i-lucide-info" class="size-5 text-primary" />
        API Status
      </h2>
      <div class="rounded-xl border border-warning/20 bg-warning/5 p-4 flex items-start gap-3">
        <UIcon name="i-lucide-clock" class="size-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium">Video Extension — Coming Soon</p>
          <p class="text-sm text-muted mt-0.5">
            The "Extend from Frame" feature is available in the Grok consumer app but not yet
            accessible via the xAI API. We'll add it here as soon as API support ships.
          </p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-rotate-ccw"
        label="Reset to Defaults"
        class="rounded-full"
        @click="handleReset"
      />
    </div>
  </div>
</template>
