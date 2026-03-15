<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  rows?: number
  maxrows?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <UForm
    :state="{ input: inputValue }"
    class="flex items-end gap-2"
    @submit.prevent="emit('submit')"
  >
    <UTextarea
      v-model="inputValue"
      :placeholder="placeholder ?? 'Type a message...'"
      class="flex-1"
      :size="size ?? 'lg'"
      autoresize
      :rows="rows ?? 2"
      :maxrows="maxrows ?? 5"
      :disabled="disabled"
      :ui="{ base: 'rounded-2xl shadow-card' }"
      @keydown="handleKeydown"
    />
    <UButton
      type="submit"
      color="primary"
      variant="solid"
      icon="i-lucide-send"
      :loading="loading"
      :disabled="!inputValue.trim() || disabled"
      class="rounded-xl touch-target shrink-0 mb-0.5"
      :size="size ?? 'lg'"
    />
  </UForm>
</template>
