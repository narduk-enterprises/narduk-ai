<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    showText?: boolean
  }>(),
  {
    size: 'md',
    showText: true,
  },
)

const sizeClasses = {
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-10',
}

const textClasses = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
}
</script>

<template>
  <NuxtLink to="/" class="flex items-center gap-2.5 group shrink-0">
    <div
      :class="[
        sizeClasses[size],
        'relative rounded-xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg transition-all duration-300 group-hover:shadow-primary/30 group-hover:scale-105',
      ]"
    >
      <UIcon
        name="i-lucide-sparkles"
        class="text-white"
        :class="size === 'lg' ? 'size-5' : 'size-4'"
      />
    </div>
    <span
      v-if="showText"
      :class="[textClasses[size], 'font-display font-bold tracking-tight hidden sm:block']"
    >
      Narduk <span class="text-gradient">AI</span>
    </span>
  </NuxtLink>
</template>
