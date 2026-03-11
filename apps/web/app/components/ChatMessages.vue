<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChatForm'

defineProps<{
  messages: ChatMessage[]
  isChatting: boolean
  generatingPreview?: boolean
  headshotUrl?: string | null
  showBuilderState?: boolean
}>()

const emit = defineEmits<{
  'use-prompt': [text: string]
  'save-prompt': [text: string]
}>()

function formatKey(key: string | number) {
  return String(key).replaceAll('_', ' ')
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="(msg, index) in messages.filter((m) => m.role !== 'system')"
      :key="index"
      class="flex flex-col max-w-[90%] md:max-w-[80%]"
      :class="msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'"
    >
      <!-- Chat Bubble -->
      <div
        v-if="msg.parsedResponse?.message || (!msg.parsedResponse && msg.content)"
        class="p-4 rounded-2xl whitespace-pre-wrap text-sm md:text-base leading-relaxed"
        :class="[
          msg.role === 'user'
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-elevated text-default border border-default rounded-tl-sm shadow-sm',
        ]"
      >
        {{ msg.parsedResponse ? msg.parsedResponse.message : msg.content }}
      </div>

      <!-- Generated Prompt Card -->
      <div v-if="msg.parsedResponse?.prompt" class="mt-3 w-full animate-fade-in-up">
        <UCard class="ring-1 ring-primary/20 bg-primary/5">
          <div class="p-4 sm:p-5 flex items-start gap-3">
            <UIcon name="i-lucide-sparkles" class="size-5 text-primary shrink-0 mt-0.5" />
            <div class="flex-1 space-y-3">
              <p class="text-sm font-medium text-default leading-relaxed font-mono select-all">
                {{ msg.parsedResponse.prompt }}
              </p>
              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/10">
                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-wand-2"
                  size="sm"
                  @click="emit('use-prompt', msg.parsedResponse.prompt!)"
                >
                  Use This Prompt
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-bookmark-plus"
                  size="sm"
                  @click="emit('save-prompt', msg.parsedResponse.prompt!)"
                >
                  Save to Presets
                </UButton>
                <CopyPromptButton :prompt="msg.parsedResponse.prompt" />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Inline Builder State Card (only when showBuilderState is true) -->
      <div
        v-if="
          showBuilderState &&
          msg.parsedResponse?.builder_state &&
          Object.keys(msg.parsedResponse.builder_state).length > 0 &&
          !msg.parsedResponse?.prompt
        "
        class="mt-3 w-full animate-fade-in-up"
      >
        <UCard class="ring-1 ring-primary/20 bg-primary/5">
          <div class="p-3 sm:p-4">
            <div class="flex items-center gap-2 mb-2">
              <img
                v-if="headshotUrl"
                :src="headshotUrl"
                alt="Headshot"
                class="size-7 rounded-full object-cover ring-1 ring-primary/30 shrink-0"
              />
              <UIcon v-else name="i-lucide-hammer" class="size-4 text-primary" />
              <span class="text-xs font-semibold text-primary">Attributes Updated</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1">
              <div
                v-for="(val, key) in msg.parsedResponse.builder_state"
                :key="key"
                class="text-[10px] px-1.5 py-0.5 rounded"
                :class="val ? 'bg-elevated text-default' : 'text-dimmed'"
              >
                <span class="capitalize font-medium">{{ formatKey(key) }}:</span>
                {{ val || '—' }}
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Typing Indicator -->
    <div
      v-if="isChatting"
      class="flex self-start items-center gap-1.5 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%]"
    >
      <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
      <span class="size-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
      <span class="size-2 rounded-full bg-primary animate-bounce"></span>
    </div>

    <!-- Preview Loading -->
    <div
      v-if="generatingPreview"
      class="flex self-start items-center gap-3 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%] animate-fade-in-up"
    >
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-primary" />
      <span class="text-sm text-muted">Generating preview...</span>
    </div>
  </div>
</template>
