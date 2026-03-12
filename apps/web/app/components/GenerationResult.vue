<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  latestResult: Generation
  latestResults: Generation[]
  latestMediaType: 'image' | 'video'
  latestResultError: string | null
  upscaling: boolean
}>()

const emit = defineEmits<{
  'open-viewer': [gen: Generation]
  'open-batch-viewer': [gen: Generation]
  animate: [gen: Generation]
  edit: [gen: Generation]
  upscale: [id: string]
  'animate-latest': []
  'edit-latest': []
  retry: []
  dismiss: []
}>()

const resultBadgeColor = computed(() => {
  if (!props.latestResult) return 'neutral'
  if (props.latestResult.status === 'done') return 'success'
  if (props.latestResult.status === 'pending') return 'warning'
  return 'error'
})

const isBatchDone = computed(
  () => props.latestResults.length > 1 && props.latestResults.every((r) => r.status === 'done'),
)
</script>

<template>
  <div class="glass-card p-6 space-y-4 animate-fade-in-up">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-display font-semibold">Result</h2>
      <UBadge :color="resultBadgeColor" :label="latestResult.status" />
    </div>

    <!-- Pending -->
    <div v-if="latestResult.status === 'pending'" class="flex flex-col items-center gap-4 py-16">
      <div class="relative">
        <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
        <div class="absolute inset-0 animate-glow-pulse rounded-full" />
      </div>
      <p class="text-muted">
        Generating your {{ latestResult.type }}...
        {{
          latestResult.type === 'video'
            ? 'Videos may take several minutes.'
            : 'This should take a moment.'
        }}
      </p>
    </div>

    <!-- Done: Batch Grid (multiple results) -->
    <template v-else-if="isBatchDone">
      <div
        class="grid gap-4"
        :class="{
          'grid-cols-2': latestResults.length === 2 || latestResults.length === 4,
          'grid-cols-3': latestResults.length === 3,
        }"
      >
        <div
          v-for="gen in latestResults"
          :key="gen.id"
          class="relative overflow-hidden rounded-2xl neon-border bg-elevated/30 cursor-pointer group"
          @click="emit('open-batch-viewer', gen)"
        >
          <NuxtImg
            v-if="gen.mediaUrl"
            :src="gen.mediaUrl"
            :alt="gen.prompt"
            class="w-full aspect-square object-cover transition-transform duration-300 hover:scale-[1.03]"
            placeholder
            loading="lazy"
          />
          <!-- Quick Actions Overlay -->
          <div
            class="absolute bottom-0 inset-x-0 p-2 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <div class="flex justify-center gap-1.5">
              <UTooltip text="Animate">
                <UButton
                  variant="solid"
                  color="neutral"
                  icon="i-lucide-video"
                  size="xs"
                  class="rounded-full"
                  @click.stop="emit('animate', gen)"
                />
              </UTooltip>
              <UTooltip text="Edit">
                <UButton
                  variant="solid"
                  color="neutral"
                  icon="i-lucide-layers"
                  size="xs"
                  class="rounded-full"
                  @click.stop="emit('edit', gen)"
                />
              </UTooltip>
              <UTooltip text="Upscale">
                <UButton
                  variant="solid"
                  color="neutral"
                  icon="i-lucide-maximize-2"
                  size="xs"
                  class="rounded-full"
                  :loading="upscaling"
                  @click.stop="emit('upscale', gen.id)"
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-start gap-3 group w-full">
        <p class="text-sm text-muted flex-1">{{ latestResult?.prompt }}</p>
        <CopyButton
          v-if="latestResult"
          :text="latestResult.prompt"
          class="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <UTooltip text="View all past generations" class="flex-1 sm:flex-initial">
          <UButton
            variant="outline"
            icon="i-lucide-grid-3x3"
            size="sm"
            to="/gallery"
            class="rounded-full min-h-11 w-full"
          >
            Gallery
          </UButton>
        </UTooltip>
      </div>
    </template>

    <!-- Done: Single Result -->
    <template v-else-if="latestResult?.status === 'done' && latestResult.mediaUrl">
      <div
        class="relative overflow-hidden rounded-2xl neon-border bg-elevated/30 cursor-pointer"
        @click="emit('open-viewer', latestResult)"
      >
        <MediaImg
          v-if="latestMediaType === 'image'"
          :src="latestResult.mediaUrl!"
          :alt="latestResult.prompt"
          class="max-h-[60vh] w-full object-contain transition-transform duration-300 hover:scale-[1.02]"
          loading="lazy"
        />
        <!-- eslint-disable-next-line vuejs-accessibility/media-has-caption -->
        <video
          v-else
          :src="latestResult.mediaUrl!"
          controls
          class="max-h-[60vh] w-full bg-black"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div class="flex items-start gap-3 group w-full">
        <p class="text-sm text-muted flex-1">{{ latestResult.prompt }}</p>
        <CopyButton
          :text="latestResult.prompt"
          class="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <UTooltip
          v-if="latestResult.type === 'image'"
          text="Create a video from this image"
          class="flex-1 sm:flex-initial"
        >
          <UButton
            variant="outline"
            icon="i-lucide-video"
            size="sm"
            class="rounded-full min-h-11 w-full"
            @click="emit('animate-latest')"
          >
            Animate
          </UButton>
        </UTooltip>
        <UTooltip
          v-if="latestResult.type === 'image'"
          text="Create a new image based on this one"
          class="flex-1 sm:flex-initial"
        >
          <UButton
            variant="outline"
            icon="i-lucide-layers"
            size="sm"
            class="rounded-full min-h-11 w-full"
            @click="emit('edit-latest')"
          >
            Edit
          </UButton>
        </UTooltip>
        <UTooltip
          v-if="latestResult.type === 'image'"
          text="Increase resolution to 2K (Costs more)"
          class="flex-1 sm:flex-initial"
        >
          <UButton
            variant="outline"
            icon="i-lucide-maximize-2"
            size="sm"
            class="rounded-full min-h-11 w-full"
            :loading="upscaling"
            @click="emit('upscale', latestResult!.id)"
          >
            Upscale
          </UButton>
        </UTooltip>
        <UTooltip text="View all past generations" class="flex-1 sm:flex-initial">
          <UButton
            variant="outline"
            icon="i-lucide-grid-3x3"
            size="sm"
            to="/gallery"
            class="rounded-full min-h-11 w-full"
          >
            Gallery
          </UButton>
        </UTooltip>
      </div>
    </template>

    <!-- Failed / Expired -->
    <div
      v-else-if="latestResult.status === 'failed' || latestResult.status === 'expired'"
      class="rounded-xl border border-error/20 bg-error/5 p-5 space-y-4"
    >
      <div class="flex items-start gap-3">
        <UIcon name="i-lucide-alert-triangle" class="size-6 text-error shrink-0 mt-0.5" />
        <div>
          <p class="font-medium text-error">Generation {{ latestResult.status }}</p>
          <p class="text-sm text-muted mt-1">
            {{ latestResultError || 'Something went wrong. Please try again.' }}
          </p>
        </div>
      </div>
      <div class="flex gap-2 pl-9">
        <UButton
          variant="outline"
          color="warning"
          icon="i-lucide-refresh-cw"
          size="sm"
          class="rounded-full"
          @click="emit('retry')"
        >
          Retry
        </UButton>
        <UButton
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          size="sm"
          class="rounded-full"
          @click="emit('dismiss')"
        >
          Dismiss
        </UButton>
      </div>
    </div>
  </div>
</template>
