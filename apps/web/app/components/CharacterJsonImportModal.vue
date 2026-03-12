<script setup lang="ts">
const isOpen = defineModel<boolean>('open', { default: false })
const jsonText = defineModel<string>('jsonText', { default: '' })

const props = defineProps<{
  loading: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'parse'): void
}>()
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      content: 'sm:max-w-3xl bg-default',
      body: 'space-y-4',
    }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-display font-semibold text-lg flex items-center gap-2">
            <UIcon name="i-lucide-file-json" class="size-5 text-primary" />
            Import Character JSON
          </h3>
          <p class="text-sm text-muted">
            Test-only flow: parse the provided schema, preview it in the prompt field, then submit
            it with the OpenAI Batch API.
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="isOpen = false"
        />
      </div>
    </template>

    <template #body>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-flask-conical"
        title="Schema-specific test import"
        description="This parser is intentionally separate from the normal prompt schema so it can stay isolated to this experiment."
      />

      <UFormField label="Character Input JSON" :error="props.error || false">
        <UTextarea
          v-model="jsonText"
          :rows="16"
          :maxrows="20"
          autoresize
          placeholder='{"characters":[...]}'
          class="w-full font-mono text-sm"
        />
      </UFormField>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-dimmed">
          The prompt field will show a preview only. Batch submission happens when you generate.
        </p>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="ghost" @click="isOpen = false"> Cancel </UButton>
          <UButton
            color="primary"
            icon="i-lucide-braces"
            :loading="props.loading"
            :disabled="!jsonText.trim()"
            @click="emit('parse')"
          >
            Parse JSON
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
