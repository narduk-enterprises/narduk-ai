<script setup lang="ts">
const props = defineProps<{
  state: Record<string, string | null>
  overrides: Record<string, string | null>
  columns?: 2 | 3
}>()

const emit = defineEmits<{
  update: [key: string, value: string]
}>()

function handleChange(id: string, event: Event) {
  emit('update', id, (event.target as HTMLInputElement).value)
}

const gridClass = computed(() => {
  return props.columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
})

// Provide a unified view of the items to render so the template
// only iterates over simple objects without function calls
const gridItems = computed(() => {
  return Object.keys(props.state).map((key) => {
    const val = props.state[key] as string | null
    const hasOverride = !!props.overrides[key]
    const active = !!val || hasOverride

    return {
      key,
      id: String(key),
      label: key.replaceAll('_', ' '),
      value: props.overrides[key] ?? (val || ''),
      cardClass: active
        ? 'bg-elevated border-default hover:border-primary/50 shadow-sm'
        : 'bg-default border-dashed border-default/50',
      labelClass: active ? 'text-primary' : 'text-dimmed',
    }
  })
})
</script>

<template>
  <div class="grid gap-2" :class="gridClass">
    <div
      v-for="item in gridItems"
      :key="item.key"
      class="p-2.5 rounded-lg border transition-colors"
      :class="item.cardClass"
    >
      <span class="font-medium capitalize text-xs block mb-0.5" :class="item.labelClass">{{
        item.label
      }}</span>
      <!-- eslint-disable-next-line narduk/no-native-input -- Lightweight inline edit, UInput too heavy here -->
      <input
        :value="item.value"
        placeholder="..."
        class="w-full bg-transparent text-default text-sm border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-0.5 placeholder:text-dimmed placeholder:italic"
        @change="handleChange(item.id, $event)"
      />
    </div>
  </div>
</template>
