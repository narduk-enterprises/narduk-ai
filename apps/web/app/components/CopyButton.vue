<script setup lang="ts">
const props = defineProps<{
  text?: string
  label?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'soft' | 'outline' | 'solid'
}>()

const copied = ref(false)

async function copy() {
  if (!props.text) return

  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <UButton
    :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
    :color="copied ? 'success' : 'neutral'"
    :variant="variant ?? 'ghost'"
    :size="size ?? 'xs'"
    :label="label"
    :title="copied ? 'Copied!' : 'Copy'"
    @click.prevent.stop="copy"
  />
</template>
