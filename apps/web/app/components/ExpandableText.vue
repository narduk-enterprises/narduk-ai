<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string
    as?: 'div' | 'p' | 'span'
    collapsedLines?: number
    preserveWhitespace?: boolean
    textClass?: string
    wrapperClass?: string
    buttonClass?: string
    expandLabel?: string
    collapseLabel?: string
  }>(),
  {
    as: 'p',
    collapsedLines: 3,
    preserveWhitespace: true,
    textClass: '',
    wrapperClass: '',
    buttonClass: '',
    expandLabel: 'Show more',
    collapseLabel: 'Show less',
  },
)

const wrapperRef = ref<HTMLElement | null>(null)
const measurementRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const isOverflowing = ref(false)

let resizeObserver: ResizeObserver | null = null

const clampStyle = computed(() => ({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: String(props.collapsedLines),
}))

async function measureOverflow() {
  if (import.meta.server) return

  await nextTick()

  const element = measurementRef.value
  if (!element) return

  isOverflowing.value = element.scrollHeight > element.clientHeight + 1

  if (!isOverflowing.value) {
    expanded.value = false
  }
}

watch(
  () => [props.text, props.collapsedLines],
  () => {
    expanded.value = false
    void measureOverflow()
  },
)

onMounted(() => {
  void measureOverflow()

  if (typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    void measureOverflow()
  })

  if (wrapperRef.value) {
    resizeObserver.observe(wrapperRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="wrapperRef" class="relative" :class="wrapperClass">
    <component
      :is="as"
      :style="expanded ? undefined : clampStyle"
      class="break-words"
      :class="[preserveWhitespace ? 'whitespace-pre-wrap' : '', textClass]"
    >
      {{ text }}
    </component>

    <component
      :is="as"
      ref="measurementRef"
      aria-hidden="true"
      class="pointer-events-none invisible absolute left-0 top-0 w-full break-words"
      :class="[preserveWhitespace ? 'whitespace-pre-wrap' : '', textClass]"
      :style="clampStyle"
    >
      {{ text }}
    </component>

    <UButton
      v-if="isOverflowing"
      size="xs"
      variant="ghost"
      color="primary"
      class="mt-1 h-auto px-0 py-0 font-medium"
      :class="buttonClass"
      :label="expanded ? collapseLabel : expandLabel"
      :aria-expanded="expanded"
      @click.stop="expanded = !expanded"
      @keydown.enter.stop
      @keydown.space.stop
    />
  </div>
</template>
