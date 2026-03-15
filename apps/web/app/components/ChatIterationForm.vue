<script setup lang="ts">
import { MAX_ITERATION_PASS_COUNT } from '~/utils/iterationConfig'

const props = defineProps<{
  iterationPrompt: string
  iterationGoal: string
  iterationContext: string
  iterationPassCount: number
  isIterating: boolean
  isChatting: boolean
  generatingInline: boolean
  isFormCollapsed: boolean
}>()

const emit = defineEmits<{
  'update:iterationPrompt': [value: string]
  'update:iterationGoal': [value: string]
  'update:iterationContext': [value: string]
  'update:iterationPassCount': [value: string | number | null | undefined]
  'update:isFormCollapsed': [value: boolean]
  'submit': []
  'stop': []
}>()

const promptModel = computed({
  get: () => props.iterationPrompt,
  set: (v: string) => emit('update:iterationPrompt', v),
})
const goalModel = computed({
  get: () => props.iterationGoal,
  set: (v: string) => emit('update:iterationGoal', v),
})
const contextModel = computed({
  get: () => props.iterationContext,
  set: (v: string) => emit('update:iterationContext', v),
})

const allDisabled = computed(
  () => props.isIterating || props.isChatting || props.generatingInline,
)

const submitLabel = computed(() =>
  props.iterationPassCount === 1
    ? 'Run 1 Round'
    : `Run ${props.iterationPassCount} Rounds`,
)
</script>

<template>
  <div class="glass-card overflow-hidden">
    <!-- Mobile collapsed summary bar -->
    <div
      v-if="isFormCollapsed && isIterating"
      class="flex items-center justify-between gap-3 px-4 py-3 md:hidden cursor-pointer"
      role="button"
      tabindex="0"
      @click="emit('update:isFormCollapsed', false)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UIcon
          name="i-lucide-wand-sparkles"
          class="size-4 text-primary shrink-0 animate-spin"
        />
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{{ iterationGoal || 'Refining...' }}</p>
          <p class="text-[10px] text-muted">
            {{ iterationPassCount }} {{ iterationPassCount === 1 ? 'round' : 'rounds' }} · Tap to
            expand
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-octagon-x"
          size="xs"
          @click.stop="emit('stop')"
        >
          Stop
        </UButton>
        <UIcon name="i-lucide-chevron-down" class="size-4 text-muted" />
      </div>
    </div>

    <!-- Full form -->
    <div
      class="px-4 py-4 sm:px-5 sm:py-5 space-y-4"
      :class="{ 'hidden md:block': isFormCollapsed && isIterating }"
    >
      <!-- Card header -->
      <div class="flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center size-8 rounded-full bg-primary/10">
            <UIcon name="i-lucide-wand-sparkles" class="size-4 text-primary" />
          </div>
          <div>
            <p class="font-display font-semibold text-sm">Prompt Refiner</p>
            <p class="text-xs text-muted hidden sm:block">
              Paste a prompt, set a goal, and Grok will rewrite → render → review → repeat.
            </p>
          </div>
        </div>
        <UButton
          v-if="isIterating"
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-up"
          size="xs"
          class="md:hidden"
          @click="emit('update:isFormCollapsed', true)"
        />
      </div>

      <UForm
        :state="{ prompt: iterationPrompt, goal: iterationGoal, passCount: iterationPassCount }"
        class="w-full space-y-3"
        @submit.prevent="emit('submit')"
      >
        <UFormField label="Starting Prompt" class="w-full">
          <UTextarea
            v-model="promptModel"
            placeholder="Paste the prompt you want to improve..."
            autoresize
            :rows="3"
            :maxrows="8"
            :disabled="allDisabled"
            class="w-full"
            :ui="{ base: 'rounded-xl' }"
          />
        </UFormField>

        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem] md:items-start">
          <UFormField label="Goal" class="w-full">
            <UTextarea
              v-model="goalModel"
              placeholder="What should the prompt get better at?"
              autoresize
              :rows="2"
              :maxrows="4"
              :disabled="allDisabled"
              class="w-full"
              :ui="{ base: 'rounded-xl' }"
            />
          </UFormField>

          <UFormField label="Rounds" class="w-full">
            <UInput
              :model-value="String(iterationPassCount)"
              type="number"
              min="1"
              :max="String(MAX_ITERATION_PASS_COUNT)"
              step="1"
              :disabled="allDisabled"
              class="w-full"
              :ui="{ base: 'rounded-xl' }"
              @update:model-value="emit('update:iterationPassCount', $event)"
            />
          </UFormField>
        </div>

        <UFormField class="w-full">
          <template #label>
            <div class="flex items-center gap-2">
              <span>Context & Feedback</span>
              <span
                v-if="isIterating"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
              >
                <UIcon name="i-lucide-pencil" class="size-2.5" />
                edits apply on next round
              </span>
              <span v-else class="text-[10px] text-dimmed font-normal">Optional</span>
            </div>
          </template>
          <UTextarea
            v-model="contextModel"
            placeholder="Add constraints or feedback after reviewing each round..."
            autoresize
            :rows="2"
            :maxrows="6"
            :disabled="isChatting || generatingInline"
            class="w-full"
            :ui="{ base: 'rounded-xl' }"
          />
        </UFormField>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <UButton
            type="submit"
            color="primary"
            variant="solid"
            icon="i-lucide-wand-sparkles"
            :loading="isIterating"
            :disabled="!iterationPrompt.trim() || !iterationGoal.trim() || allDisabled"
            class="rounded-xl"
            size="lg"
          >
            {{ submitLabel }}
          </UButton>
          <UButton
            v-if="isIterating"
            color="neutral"
            variant="outline"
            icon="i-lucide-octagon-x"
            class="rounded-xl"
            size="lg"
            @click="emit('stop')"
          >
            Stop
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
