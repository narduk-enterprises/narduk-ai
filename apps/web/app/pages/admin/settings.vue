<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'

useSeo({
  title: 'Settings',
  description: 'Manage Narduk AI generation settings.',
})
useWebPageSchema({
  name: 'Settings',
  description: 'Manage Narduk AI generation settings',
})

// Types
type SettingsFields = {
  videoModel: string
  imageModel: string
  promptEnhanceModel: string
}

// Schemas
const schema = z.object({
  videoModel: z.string().min(1, 'Video model must be selected'),
  imageModel: z.string().min(1, 'Image model must be selected'),
  promptEnhanceModel: z.string().min(1, 'Prompt enhance model must be selected'),
})

// State
const toast = useToast()
const { currentSettings, status, refresh, updateSettings } = useAdminSettings()

const state = reactive<SettingsFields>({
  videoModel: currentSettings.value?.videoModel || 'grok-imagine-video',
  imageModel: currentSettings.value?.imageModel || 'grok-imagine-image',
  promptEnhanceModel: currentSettings.value?.promptEnhanceModel || 'grok-3-mini',
})

const isSaving = ref(false)

// Select Options
const videoOptions = [{ label: 'Grok Imagine Video', value: 'grok-imagine-video' }]

const imageOptions = [
  { label: 'Grok Imagine Image Pro', value: 'grok-imagine-image-pro' },
  { label: 'Grok Imagine Image', value: 'grok-imagine-image' },
]

const enhanceOptions = [
  { label: 'Grok 4.1 Fast Reasoning', value: 'grok-4-1-fast-reasoning' },
  { label: 'Grok 4.1 Fast Non-Reasoning', value: 'grok-4-1-fast-non-reasoning' },
  { label: 'Grok Code Fast 1', value: 'grok-code-fast-1' },
]

// Handlers
async function onSubmit(event: FormSubmitEvent<SettingsFields>) {
  isSaving.value = true

  try {
    await updateSettings(event.data)
    await refresh()

    toast.add({
      title: 'Success',
      description: 'App settings saved',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (error) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error Saving Settings',
      description: err.data?.message || 'An unexpected error occurred.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="font-display text-2xl font-bold tracking-tight text-default">App Settings</h1>
      <p class="text-sm text-muted mt-1">
        Configure global ML model selections used for generations.
      </p>
    </div>

    <!-- Loading State -->
    <UCard v-if="status === 'pending'" class="shadow-elevated rounded-card">
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-muted" />
        <p class="mt-4 text-sm font-medium text-default">Loading settings...</p>
      </div>
    </UCard>

    <UCard v-else class="shadow-elevated rounded-card">
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-6 mx-auto w-full max-w-xl"
        @submit="onSubmit"
      >
        <!-- Video Model Selection -->
        <UFormField
          name="videoModel"
          label="Video Generation Model"
          description="The model used for all T2V and I2V tasks."
        >
          <USelectMenu
            v-model="state.videoModel"
            :items="videoOptions"
            value-key="value"
            style="width: 100%"
          />
        </UFormField>

        <!-- Image Model Selection -->
        <UFormField
          name="imageModel"
          label="Image Generation Model"
          description="The model used for T2I generation natively."
        >
          <USelectMenu
            v-model="state.imageModel"
            :items="imageOptions"
            value-key="value"
            style="width: 100%"
          />
        </UFormField>

        <!-- Prompt Enhance Model Selection -->
        <UFormField
          name="promptEnhanceModel"
          label="Prompt Enhance Model"
          description="The text model to use for the 'Enhance Prompt' rewriting feature."
        >
          <USelectMenu
            v-model="state.promptEnhanceModel"
            :items="enhanceOptions"
            value-key="value"
            style="width: 100%"
          />
        </UFormField>

        <USeparator class="my-6" />

        <div class="flex justify-end pt-2">
          <UButton type="submit" color="primary" :loading="isSaving" icon="i-lucide-save">
            Save Settings
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
