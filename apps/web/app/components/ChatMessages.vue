<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChatForm'

defineProps<{
  messages: ChatMessage[]
  isChatting: boolean
  generatingInline?: boolean
  headshotUrl?: string | null
  showBuilderState?: boolean
}>()

const emit = defineEmits<{
  'use-prompt': [text: string]
  'save-prompt': [text: string]
  'generate-inline': [prompt: string]
  'share-image': [imageUrl: string]
}>()

function handleUsePrompt(prompt: string) {
  emit('use-prompt', prompt)
}

function handleSavePrompt(prompt: string) {
  emit('save-prompt', prompt)
}

function handleGenerateInline(prompt: string) {
  emit('generate-inline', prompt)
}

function handleShareImage(imageUrl: string) {
  emit('share-image', imageUrl)
}

function formatKey(key: string | number) {
  return String(key).replaceAll('_', ' ')
}

/** Get displayable text from a message (strips XML tags from assistant replies) */
function getDisplayContent(msg: ChatMessage): string {
  if (msg.parsedResponse?.message) return msg.parsedResponse.message
  const raw = typeof msg.content === 'string' ? msg.content : ''
  return raw.replaceAll(/<[^>]+>/g, '')
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
      <!-- User message: handle multimodal content (text + image) -->
      <template v-if="msg.role === 'user'">
        <!-- Text portion -->
        <div
          v-if="typeof msg.content === 'string' && msg.content.trim()"
          class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-primary text-white rounded-tr-sm whitespace-pre-wrap"
        >
          {{ msg.content }}
        </div>
        <!-- Multimodal: text part -->
        <template v-else-if="Array.isArray(msg.content)">
          <div v-for="(part, pi) in msg.content" :key="pi">
            <div
              v-if="part.type === 'text'"
              class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-primary text-white rounded-tr-sm whitespace-pre-wrap mb-2"
            >
              {{ part.text }}
            </div>
            <div
              v-else-if="part.type === 'image_url'"
              class="mt-1 rounded-xl overflow-hidden ring-2 ring-primary/30 max-w-xs"
            >
              <img
                :src="part.image_url.url"
                alt="Shared image"
                class="w-full h-auto object-cover"
              />
            </div>
          </div>
        </template>
      </template>

      <!-- Assistant Chat Bubble -->
      <div
        v-else-if="
          msg.parsedResponse?.message ||
          (!msg.parsedResponse && msg.content) ||
          (msg.role === 'assistant' && msg.content)
        "
        class="p-4 rounded-2xl text-sm md:text-base leading-relaxed bg-elevated text-default border border-default rounded-tl-sm shadow-sm"
      >
        <MarkdownRenderer :content="getDisplayContent(msg)" />
      </div>

      <!-- Inline Generated Image -->
      <div
        v-if="msg.parsedResponse?.isInlineGeneration && msg.parsedResponse?.imageUrl"
        class="mt-3 animate-fade-in-up"
      >
        <div class="flex items-end gap-3">
          <!-- Thumbnail — click to gallery -->
          <NuxtLink
            to="/gallery"
            class="shrink-0 block rounded-xl overflow-hidden ring-1 ring-primary/20 hover:ring-primary/50 transition-all hover:scale-[1.02] shadow-card"
          >
            <img
              :src="msg.parsedResponse.imageUrl"
              :alt="msg.parsedResponse.prompt || 'Generated image'"
              class="h-40 w-auto max-w-[180px] object-cover"
            />
          </NuxtLink>

          <!-- Action buttons stacked vertically beside the image -->
          <div class="flex flex-col gap-1.5">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-share-2"
              size="xs"
              @click="handleShareImage(msg.parsedResponse!.imageUrl!)"
            >
              Share with Agent
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-images"
              size="xs"
              to="/gallery"
            >
              View in Gallery
            </UButton>
          </div>
        </div>
      </div>

      <!-- Generated Prompt Card -->
      <div
        v-if="msg.parsedResponse?.prompt && !msg.parsedResponse?.isInlineGeneration"
        class="mt-3 w-full animate-fade-in-up"
      >
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
                  @click="handleUsePrompt(msg.parsedResponse.prompt!)"
                >
                  Use This Prompt
                </UButton>
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-lucide-image"
                  size="sm"
                  @click="handleGenerateInline(msg.parsedResponse.prompt!)"
                >
                  Generate Here
                </UButton>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-bookmark-plus"
                  size="sm"
                  @click="handleSavePrompt(msg.parsedResponse.prompt!)"
                >
                  Save to Presets
                </UButton>
                <CopyButton :text="msg.parsedResponse.prompt" />
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

    <!-- Inline Generation Loading -->
    <div
      v-if="generatingInline"
      class="flex self-start items-center gap-3 p-4 rounded-2xl bg-elevated border border-default rounded-tl-sm max-w-[85%] animate-fade-in-up"
    >
      <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-primary" />
      <span class="text-sm text-muted">Generating image…</span>
    </div>
  </div>
</template>
