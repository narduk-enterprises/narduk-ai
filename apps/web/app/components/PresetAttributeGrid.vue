<script setup lang="ts">
defineProps<{
  state: Record<string, string | null>
  overrides: Record<string, string | null>
  columns?: 2 | 3
}>()

const emit = defineEmits<{
  update: [key: string, value: string]
}>()

function formatKey(key: string) {
  return key.replaceAll('_', ' ')
}
</script>

<template>
  <div
    class="grid gap-2"
    :class="columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'"
  >
    <div
      v-for="(val, key) in state"
      :key="key"
      class="p-2.5 rounded-lg border transition-colors"
      :class="
        val || overrides[String(key)]
          ? 'bg-elevated border-default hover:border-primary/50 shadow-sm'
          : 'bg-default border-dashed border-default/50'
      "
    >
      <span
        class="font-medium capitalize text-xs block mb-0.5"
        :class="val || overrides[String(key)] ? 'text-primary' : 'text-dimmed'"
        >{{ formatKey(String(key)) }}</span
      >
      <!-- eslint-disable-next-line narduk/no-native-input -- Lightweight inline edit, UInput too heavy here -->
      <input
        :value="overrides[String(key)] ?? (val || '')"
        placeholder="..."
        class="w-full bg-transparent text-default text-sm border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-0.5 placeholder:text-dimmed placeholder:italic"
        @change="emit('update', String(key), ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
