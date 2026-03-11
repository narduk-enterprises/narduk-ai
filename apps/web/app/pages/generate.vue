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
  animateLatestImage,
  editLatestImage,
  useGenerationAsSource,
  handleImageUpload,
  removeEnhanceImage,
  enhanceImageBase64,
  upscaleGeneration,
  uploadingSource,
  handleSourceImageUpload,
} = useGenerationForm()

const { elements, fetchElements, remixPrompt } = usePromptElements()

const isComposeModalOpen = ref(false)
const isLibraryModalOpen = ref(false)

function openComposeModal() {
  isComposeModalOpen.value = true
}

function handleUseBuilderPrompt(newPrompt: string) {
  prompt.value = newPrompt
}

const remixing = ref(false)

async function handleRemix() {
  if (!prompt.value.trim() || remixing.value) return
  remixing.value = true
  try {
    prompt.value = await remixPrompt(prompt.value)
  } catch (e) {
    console.error('Remix failed:', e)
  } finally {
    remixing.value = false
  }
}

onMounted(() => {
  loadUserImages()
  fetchElements()
})

function handlePromptKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleGenerate()
  }
}

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
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-safe">
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
          class="rounded-full min-h-11"
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
              :maxrows="8"
              autoresize
              class="w-full"
              :ui="{ base: 'border-none bg-transparent shadow-none focus:ring-0' }"
              @keydown="handlePromptKeydown"
            />
          </div>
          <template #hint>
            <div class="flex items-center gap-3 flex-wrap">
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-library"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                @click="isLibraryModalOpen = true"
              >
                Library
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-puzzle"
                :disabled="!elements.length"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                @click="openComposeModal"
              >
                Compose
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-shuffle"
                :loading="remixing"
                :disabled="!prompt.trim() || generating || remixing"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                @click="handleRemix"
              >
                Remix
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-wand-2"
                :loading="enhancing"
                :disabled="!prompt.trim() || generating || enhancing"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                @click="openEnhanceModal"
              >
                Enhance
              </UButton>
              <span class="text-xs text-dimmed">{{ charCount }} characters</span>
            </div>
          </template>
        </UFormField>

        <!-- Options Row -->
        <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
          <!-- Aspect Ratio -->
          <UFormField
            v-if="activeTab === 't2i' || activeTab === 't2v'"
            label="Aspect Ratio"
            class="w-full sm:w-auto"
          >
            <USelect v-model="aspectRatio" :items="aspectRatios" class="w-full sm:w-28" />
          </UFormField>

          <!-- Duration -->
          <UFormField
            v-if="activeTab === 't2v' || activeTab === 'i2v'"
            label="Duration"
            class="w-full sm:w-auto"
          >
            <div class="flex items-center gap-3">
              <USlider v-model="duration" :min="1" :max="15" :step="1" class="flex-1 sm:w-32" />
              <span class="text-sm text-muted font-mono w-8">{{ duration }}s</span>
            </div>
          </UFormField>

          <!-- Resolution -->
          <UFormField
            v-if="activeTab === 't2v' || activeTab === 'i2v'"
            label="Resolution"
            class="w-full sm:w-auto"
          >
            <USelect v-model="resolution" :items="resolutions" class="w-full sm:w-24" />
          </UFormField>
        </div>

        <!-- Source Image Selector -->
        <UFormField v-if="activeTab === 'i2v' || activeTab === 'i2i'" label="Source Image" required>
          <ImageChooser
            v-model="sourceGenerationId"
            :user-images="userImages"
            :uploading="uploadingSource"
            @upload="handleSourceImageUpload"
          />
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
          <div class="flex items-start gap-3 group w-full">
            <p class="text-sm text-muted flex-1">{{ latestResult.prompt }}</p>
            <CopyPromptButton
              :prompt="latestResult.prompt"
              class="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="latestResult.type === 'image'"
              variant="outline"
              icon="i-lucide-video"
              size="sm"
              class="rounded-full min-h-11 flex-1 sm:flex-initial"
              @click="animateLatestImage"
            >
              Animate
            </UButton>
            <UButton
              v-if="latestResult.type === 'image'"
              variant="outline"
              icon="i-lucide-layers"
              size="sm"
              class="rounded-full min-h-11 flex-1 sm:flex-initial"
              @click="editLatestImage"
            >
              Edit
            </UButton>
            <UButton
              variant="outline"
              icon="i-lucide-grid-3x3"
              size="sm"
              to="/gallery"
              class="rounded-full min-h-11 flex-1 sm:flex-initial"
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
            @upscale="(gen) => upscaleGeneration(gen.id)"
          />
        </div>
      </div>
    </div>

    <!-- Enhance Modal -->
    <UModal v-model:open="isEnhanceModalOpen">
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

      <template #body>
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
              class="w-full"
            />
          </UFormField>

          <!-- Optional Image Attachment -->
          <div class="flex items-center gap-4 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-image-plus"
              size="sm"
              @click="
                (
                  ($refs.fileInput as HTMLInputElement[])[0] ||
                  ($refs.fileInput as HTMLInputElement)
                ).click()
              "
            >
              {{ enhanceImageBase64 ? 'Change Image' : 'Attach Image' }}
            </UButton>
            <!-- eslint-disable-next-line narduk/no-native-input -- Hidden file input for direct DOM click handling -->
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageUpload"
            />
            <div v-if="enhanceImageBase64" class="relative group">
              <NuxtImg
                :src="enhanceImageBase64"
                alt="Enhanced Source"
                class="size-16 object-contain bg-black/5 dark:bg-black/40 p-1 rounded-lg ring-1 ring-default shadow-sm"
              />
              <UButton
                color="error"
                variant="solid"
                icon="i-lucide-x"
                :padded="false"
                class="absolute -top-2 -right-2 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center size-5 shadow-sm hover:scale-110"
                @click="removeEnhanceImage"
              />
            </div>
          </div>
        </div>
      </template>

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
    </UModal>

    <!-- Prompt Builder Modal -->
    <PromptBuilder v-model:open="isComposeModalOpen" @use-prompt="handleUseBuilderPrompt" />

    <!-- Prompt Library Modal -->
    <PromptLibraryModal v-model:open="isLibraryModalOpen" @use-prompt="handleUseBuilderPrompt" />
  </div>
</template>
