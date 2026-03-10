<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Generate — Narduk AI',
  description: 'Create images and videos with AI using Grok Imagine.',
})
useWebPageSchema({
  name: 'Generate — Narduk AI',
  description: 'Create images and videos with AI using Grok Imagine.',
})

const {
  activeTab,
  prompt,
  aspectRatio,
  duration,
  resolution,
  sourceGenerationId,
  latestResult,
  recentGenerations,
  userImages,
  generating,
  enhancing,
  isEnhanceModalOpen,
  enhanceInstructions,
  error,
  charCount,
  isGenerateDisabled,
  resultBadgeColor,
  latestMediaType,
  latestResultError,
  loadUserImages,
  handleGenerate,
  openEnhanceModal,
  enhanceCurrentPrompt,
  selectSourceImage,
  animateLatestImage,
  editLatestImage,
  useGenerationAsSource,
} = useGenerationForm()

onMounted(loadUserImages)

const modes = [
  { value: 't2i', label: 'Text → Image', icon: 'i-lucide-image' },
  { value: 't2v', label: 'Text → Video', icon: 'i-lucide-video' },
  { value: 'i2v', label: 'Image → Video', icon: 'i-lucide-wand-2' },
  { value: 'i2i', label: 'Image → Image', icon: 'i-lucide-layers' },
]

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']
const resolutions = ['480p', '720p']
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="font-display text-3xl sm:text-4xl font-bold mb-2">Generate</h1>
      <p class="text-muted">Create images and videos with AI</p>
    </div>

    <div class="space-y-6">
      <!-- Mode Selector — Pill Toolbar -->
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="mode in modes"
          :key="mode.value"
          :icon="mode.icon"
          :label="mode.label"
          :variant="activeTab === mode.value ? 'solid' : 'outline'"
          :color="activeTab === mode.value ? 'primary' : 'neutral'"
          size="sm"
          class="rounded-full"
          :class="activeTab === mode.value ? 'shadow-lg shadow-primary/20' : ''"
          @click="activeTab = mode.value"
        />
      </div>

      <!-- Generation Form -->
      <div class="glass-card p-6 space-y-5">
        <!-- Prompt Input -->
        <UFormField label="Prompt" required>
          <div class="prompt-input p-1">
            <UTextarea
              v-model="prompt"
              placeholder="Describe what you want to create..."
              :rows="3"
              autoresize
              class="w-full"
              :ui="{ base: 'border-none bg-transparent shadow-none focus:ring-0' }"
            />
          </div>
          <template #hint>
            <div class="flex items-center gap-3">
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-lucide-wand-2"
                :loading="enhancing"
                :disabled="!prompt.trim() || generating || enhancing"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-[10px]"
                @click="openEnhanceModal"
              >
                Enhance
              </UButton>
              <span class="text-xs text-dimmed">{{ charCount }} characters</span>
            </div>
          </template>
        </UFormField>

        <!-- Options Row -->
        <div class="flex flex-wrap items-end gap-4">
          <!-- Aspect Ratio -->
          <UFormField v-if="activeTab === 't2i' || activeTab === 't2v'" label="Aspect Ratio">
            <USelect v-model="aspectRatio" :items="aspectRatios" class="w-28" />
          </UFormField>

          <!-- Duration -->
          <UFormField v-if="activeTab === 't2v' || activeTab === 'i2v'" label="Duration">
            <div class="flex items-center gap-3">
              <USlider v-model="duration" :min="1" :max="15" :step="1" class="w-32" />
              <span class="text-sm text-muted font-mono w-8">{{ duration }}s</span>
            </div>
          </UFormField>

          <!-- Resolution -->
          <UFormField v-if="activeTab === 't2v' || activeTab === 'i2v'" label="Resolution">
            <USelect v-model="resolution" :items="resolutions" class="w-24" />
          </UFormField>
        </div>

        <!-- Source Image Selector -->
        <UFormField v-if="activeTab === 'i2v' || activeTab === 'i2i'" label="Source Image" required>
          <div
            v-if="userImages.length"
            class="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8"
          >
            <UButton
              v-for="img in userImages"
              :key="img.id"
              variant="ghost"
              :padded="false"
              class="relative aspect-square overflow-hidden rounded-xl ring-2 transition-all duration-200 hover:scale-[1.03]"
              :class="
                sourceGenerationId === img.id
                  ? 'ring-primary shadow-lg shadow-primary/20'
                  : 'ring-transparent hover:ring-primary/40'
              "
              @click="selectSourceImage(img.id)"
            >
              <img :src="img.mediaUrl!" :alt="img.prompt" class="h-full w-full object-cover" />
              <div
                v-if="sourceGenerationId === img.id"
                class="absolute inset-0 bg-primary/10 flex items-center justify-center"
              >
                <UIcon name="i-lucide-check" class="size-5 text-primary" />
              </div>
            </UButton>
          </div>
          <p v-else class="text-sm text-dimmed py-4 text-center">
            No images yet. Generate some images first using Text → Image.
          </p>
        </UFormField>

        <!-- Error -->
        <UAlert v-if="error" color="error" icon="i-lucide-alert-triangle" :title="error" />

        <!-- Generate Button -->
        <UButton
          size="lg"
          icon="i-lucide-sparkles"
          :loading="generating"
          :disabled="isGenerateDisabled"
          block
          :label="generating ? 'Generating...' : 'Generate'"
          class="rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow"
          @click="handleGenerate"
        />
      </div>

      <!-- Result Display -->
      <div v-if="latestResult" class="glass-card p-6 space-y-4 animate-fade-in-up">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-display font-semibold">Result</h2>
          <UBadge :color="resultBadgeColor" :label="latestResult.status" />
        </div>

        <!-- Pending -->
        <div
          v-if="latestResult.status === 'pending'"
          class="flex flex-col items-center gap-4 py-16"
        >
          <div class="relative">
            <UIcon name="i-lucide-loader-2" class="size-12 animate-spin text-primary" />
            <div class="absolute inset-0 animate-glow-pulse rounded-full" />
          </div>
          <p class="text-muted">
            Generating your {{ latestResult.type }}... This may take up to 2 minutes.
          </p>
        </div>

        <!-- Done -->
        <template v-else-if="latestResult.status === 'done' && latestResult.mediaUrl">
          <MediaPlayer
            :src="latestResult.mediaUrl"
            :type="latestMediaType"
            :alt="latestResult.prompt"
          />
          <p class="text-sm text-muted">{{ latestResult.prompt }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="latestResult.type === 'image'"
              variant="outline"
              icon="i-lucide-video"
              size="sm"
              class="rounded-full"
              @click="animateLatestImage"
            >
              Animate
            </UButton>
            <UButton
              v-if="latestResult.type === 'image'"
              variant="outline"
              icon="i-lucide-layers"
              size="sm"
              class="rounded-full"
              @click="editLatestImage"
            >
              Edit
            </UButton>
            <UButton
              variant="outline"
              icon="i-lucide-grid-3x3"
              size="sm"
              to="/gallery"
              class="rounded-full"
            >
              Gallery
            </UButton>
          </div>
        </template>

        <!-- Failed -->
        <div
          v-else-if="latestResult.status === 'failed' || latestResult.status === 'expired'"
          class="rounded-xl border border-error/20 bg-error/5 p-5 flex items-start gap-3"
        >
          <UIcon name="i-lucide-alert-triangle" class="size-6 text-error shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-error">Generation {{ latestResult.status }}</p>
            <p class="text-sm text-muted mt-1">
              {{ latestResultError || 'Something went wrong. Please try again.' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Recent Generations -->
      <div v-if="recentGenerations.length" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-display font-semibold">Recent</h2>
          <UButton variant="link" to="/gallery" size="sm" trailing-icon="i-lucide-arrow-right">
            View All
          </UButton>
        </div>
        <div class="columns-2 gap-4 sm:columns-3 stagger-children">
          <GenerationCard
            v-for="gen in recentGenerations"
            :key="gen.id"
            :generation="gen"
            class="break-inside-avoid mb-4"
            @click="navigateTo(`/gallery/${gen.id}`)"
            @use-as-source="useGenerationAsSource"
          />
        </div>
      </div>
    </div>

    <!-- Enhance Modal -->
    <UModal v-model:open="isEnhanceModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-display font-semibold text-lg flex items-center gap-2">
                <UIcon name="i-lucide-wand-2" class="size-5 text-primary" />
                Enhance Prompt
              </h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                class="-my-1"
                @click="isEnhanceModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-muted">
              Tell Grok how you want to enhance your prompt. You can ask for a specific style,
              lighting, camera angle, or just leave it blank for a general enhancement.
            </p>
            <UFormField label="Instructions (Optional)">
              <UTextarea
                v-model="enhanceInstructions"
                placeholder="e.g. Make it highly cinematic, neon cyberpunk style, 8k resolution..."
                :rows="3"
                autoresize
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="ghost" @click="isEnhanceModalOpen = false">
                Cancel
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-sparkles"
                :loading="enhancing"
                @click="enhanceCurrentPrompt"
              >
                Enhance
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
