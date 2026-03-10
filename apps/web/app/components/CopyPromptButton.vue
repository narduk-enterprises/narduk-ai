<script setup lang="ts">
const props = defineProps<{
  prompt?: string
}>()

const copied = ref(false)

async function copyPrompt() {
  if (!props.prompt) return

  try {
    await navigator.clipboard.writeText(props.prompt)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy prompt:', err)
  }
}
</script>

<template>
  <UButton
    :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
    :color="copied ? 'success' : 'neutral'"
    variant="ghost"
    size="xs"
    :title="copied ? 'Copied!' : 'Copy Prompt'"
    @click.prevent.stop="copyPrompt"
  />
</template>
