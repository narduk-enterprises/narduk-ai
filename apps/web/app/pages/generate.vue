<script setup lang="ts">
import type { Generation } from '~/types/generation'

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
  activePresets,
  activePresetIds,
  latestResult,
  latestResults,
  recentGenerations,
  userImages,
  generating,
  enhancing,
  isEnhanceModalOpen,
  enhanceInstructions,
  enhanceImageBase64,
  error,
  charCount,
  isGenerateDisabled,
  latestMediaType,
  currentMediaType,
  latestResultError,
  handleGenerate,
  handleFeelingLucky,
  feelingLucky,
  openEnhanceModal,
  enhanceCurrentPrompt,
  animateLatestImage,
  editLatestImage,
  useGenerationAsSource,
  upscaleGeneration,
  upscaling,
  uploadingSource,
  sourceGeneration,
  i2iInstructions,
  generatingI2IPrompt,
  generateI2IPrompt,
  handleSourceImageUpload,
  imageCount,
  attachedPerson,
  attachedPresets,
  attachPerson,
  detachPerson,
  attachPreset,
  detachPreset,
  compiledPrompt,
  tagCategories,
  ensureTagsLoaded,
  toggleTag,
  clearTags,
  selectedTagsList,
  tagSearchQuery,
  filteredTags,
  tagSnippets,
} = useGenerationForm()

const { deleteGeneration } = useGenerate()
const { elements, fetchElements, remixPrompt } = usePromptElements()

const isModifierSlideoverOpen = ref(false)
const isLibraryModalOpen = ref(false)

// Preset type configuration for UI rendering
const PRESET_TYPE_CONFIG: Record<string, { label: string; icon: string; order: number }> = {
  person: { label: 'Person', icon: 'i-lucide-user', order: 0 },
  scene: { label: 'Scene', icon: 'i-lucide-mountain', order: 1 },
  style: { label: 'Style', icon: 'i-lucide-palette', order: 2 },
  framing: { label: 'Framing', icon: 'i-lucide-frame', order: 3 },
  action: { label: 'Action', icon: 'i-lucide-zap', order: 4 },
}

const personElements = computed(() => elements.value.filter((el) => el.type === 'person'))

const otherPresetTypes = computed(() => {
  const types = ['scene', 'style', 'framing', 'action']
  return types
    .filter((t) => elements.value.some((el) => el.type === t))
    .map((t) => ({
      type: t,
      ...(PRESET_TYPE_CONFIG[t] || { label: t, icon: 'i-lucide-box', order: 99 }),
      elements: elements.value.filter((el) => el.type === t),
    }))
    .sort((a, b) => a.order - b.order)
})

function getPersonPreviewUrl(el: { metadata?: string | null }): string | null {
  if (!el.metadata) return null
  try {
    const meta = JSON.parse(el.metadata)
    return meta.headshotUrl || meta.fullBodyUrl || null
  } catch {
    return null
  }
}

const galleryViewer = useGalleryViewer()

function openRecentViewer(gen: Generation) {
  const idx = recentGenerations.value.findIndex((g: Generation) => g.id === gen.id)
  galleryViewer.open(recentGenerations.value, idx >= 0 ? idx : 0)
}

function handleClearAll() {
  detachPerson()
  clearTags()
}

function handleUseBuilderPrompt(newPrompt: string) {
  prompt.value = newPrompt
}

const remixing = ref(false)

async function handleRemix() {
  if (!prompt.value.trim() || remixing.value) return
  remixing.value = true
  try {
    const presetsToPass = Object.keys(activePresets.value).length ? activePresets.value : undefined
    prompt.value = await remixPrompt(prompt.value, currentMediaType.value, presetsToPass)
  } catch (e) {
    console.error('Remix failed:', e)
  } finally {
    remixing.value = false
  }
}

onMounted(() => {
  fetchElements()
  ensureTagsLoaded()
  // Pre-fill prompt from query param (navigated from /compose "Use in Generate")
  const routePrompt = useRoute().query.prompt
  if (routePrompt && typeof routePrompt === 'string') {
    prompt.value = decodeURIComponent(routePrompt)
  }
})

function handlePromptKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleGenerate()
  }
}

function handleRetry() {
  if (!latestResult.value) return
  prompt.value = latestResult.value.prompt
  handleGenerate()
}

function handleDismiss() {
  if (!latestResult.value) return
  deleteGeneration(latestResult.value.id)
  latestResult.value = null
}

const modes = [
  { value: 't2i', label: 'Text → Image', icon: 'i-lucide-image', desc: 'Create an image from a text description' },
  { value: 't2v', label: 'Text → Video', icon: 'i-lucide-video', desc: 'Generate a video from a text description' },
  { value: 'i2v', label: 'Image → Video', icon: 'i-lucide-wand-2', desc: 'Animate an existing image into a video' },
  { value: 'i2i', label: 'Image → Image', icon: 'i-lucide-layers', desc: 'Edit or transform an existing image' },
]

const activeMode = computed(() => modes.find((m) => m.value === activeTab.value))

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']
const resolutions = ['480p', '720p']
const imageCounts = [1, 2, 3, 4]

function openBatchViewer(gen: Generation) {
  const idx = latestResults.value.findIndex((g: Generation) => g.id === gen.id)
  galleryViewer.open(latestResults.value, idx >= 0 ? idx : 0)
}

function animateResult(gen: Generation) {
  activeTab.value = 'i2v'
  sourceGenerationId.value = gen.id
}

function editResult(gen: Generation) {
  activeTab.value = 'i2i'
  sourceGenerationId.value = gen.id
}


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
      <div class="space-y-2">
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
        <p v-if="activeMode" class="text-xs text-muted pl-1">{{ activeMode.desc }}</p>
      </div>

      <!-- Generation Form -->
      <div class="glass-card p-6 space-y-5">
        <!-- Prompt Input -->
        <UFormField required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{
                activeTab === 'i2i' || activeTab === 'i2v' ? 'Final Prompt' : 'Prompt'
              }}</span>
              <UTooltip
                v-if="activeTab === 'i2i' || activeTab === 'i2v'"
                text="When using a source image, describe the entire desired output, not just the changes. The AI will redesign the image using both the source and your description as inspiration."
                :popper="{ placement: 'top' }"
              >
                <UIcon
                  name="i-lucide-info"
                  class="size-4 text-muted hover:text-primary transition-colors cursor-help"
                />
              </UTooltip>
            </div>
          </template>
          <!-- I2I Instructions Flow -->
          <div
            v-if="(activeTab === 'i2i' || activeTab === 'i2v') && sourceGeneration"
            class="space-y-4 mb-4 bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-default/10"
          >
            <UFormField label="Original Prompt">
              <UTextarea
                :model-value="sourceGeneration.prompt"
                :rows="2"
                :maxrows="4"
                autoresize
                disabled
                class="w-full opacity-70"
              />
            </UFormField>

            <UFormField label="Additional Changes">
              <UTextarea
                v-model="i2iInstructions"
                placeholder="e.g. Make it a snowy winter scene, change the car color to red..."
                :rows="2"
                autoresize
                class="w-full"
              />
            </UFormField>

            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-wand-2"
              size="sm"
              :loading="generatingI2IPrompt"
              :disabled="generatingI2IPrompt"
              class="w-full justify-center"
              @click="generateI2IPrompt"
            >
              Generate Final Prompt
            </UButton>
          </div>

          <div class="prompt-input p-1 relative">
            <div
              v-if="generatingI2IPrompt"
              class="absolute inset-0 bg-default/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl"
            >
              <UIcon name="i-lucide-loader-2" class="size-6 text-primary animate-spin" />
            </div>
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
            <div class="flex flex-wrap items-center gap-3">
              <UButton
                key="btn-library"
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
                key="btn-remix"
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
                key="btn-enhance"
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

        <!-- Attached Person Chip -->
        <div v-if="attachedPerson" class="flex items-center gap-2">
          <div
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm"
          >
            <NuxtImg
              v-if="getPersonPreviewUrl(attachedPerson)"
              :src="getPersonPreviewUrl(attachedPerson)!"
              class="size-5 rounded-full object-cover ring-1 ring-primary/30"
              width="20"
              height="20"
              loading="lazy"
            />
            <UIcon v-else name="i-lucide-user" class="size-4 text-primary" />
            <span class="font-medium text-primary">{{ attachedPerson.name }}</span>
            <UButton
              color="primary"
              variant="ghost"
              icon="i-lucide-x"
              size="xs"
              :padded="false"
              class="-mr-1 rounded-full hover:bg-primary/20"
              @click="detachPerson"
            />
          </div>
        </div>

        <!-- Person Presets + Other Presets + Quick Modifiers -->
        <div
          v-if="personElements.length || otherPresetTypes.length || tagCategories.length"
          class="space-y-3 border-t border-default/10 pt-4"
        >
          <!-- Person Presets -->
          <div v-if="personElements.length" class="space-y-1.5">
            <span
              class="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1"
            >
              <UIcon name="i-lucide-user" class="size-3" />
              Person
            </span>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="person in personElements"
                :key="person.id"
                size="xs"
                :variant="attachedPerson?.id === person.id ? 'solid' : 'outline'"
                :color="attachedPerson?.id === person.id ? 'primary' : 'neutral'"
                class="rounded-full"
                :class="attachedPerson?.id === person.id ? 'shadow-sm shadow-primary/20' : ''"
                @click="attachedPerson?.id === person.id ? detachPerson() : attachPerson(person)"
              >
                <template #leading>
                  <NuxtImg
                    v-if="getPersonPreviewUrl(person)"
                    :src="getPersonPreviewUrl(person)!"
                    class="size-4 rounded-full object-cover ring-1 ring-default/20 -ml-0.5"
                    width="16"
                    height="16"
                    loading="lazy"
                  />
                </template>
                {{ person.name }}
              </UButton>
            </div>
          </div>

          <!-- Other Preset Types (Scene, Style, Framing, Action) -->
          <div v-for="pt in otherPresetTypes" :key="pt.type" class="space-y-1.5">
            <span
              class="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1"
            >
              <UIcon :name="pt.icon" class="size-3" />
              {{ pt.label }}
            </span>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="el in pt.elements"
                :key="el.id"
                size="xs"
                :variant="attachedPresets[pt.type]?.id === el.id ? 'solid' : 'outline'"
                :color="attachedPresets[pt.type]?.id === el.id ? 'primary' : 'neutral'"
                class="rounded-full"
                :class="attachedPresets[pt.type]?.id === el.id ? 'shadow-sm shadow-primary/20' : ''"
                @click="
                  attachedPresets[pt.type]?.id === el.id
                    ? detachPreset(pt.type)
                    : attachPreset(pt.type, el)
                "
              >
                {{ el.name }}
              </UButton>
            </div>
          </div>

          <!-- Active Tags & Add Button -->
          <div v-if="tagCategories.length" class="space-y-3 mt-4">
            <div class="flex items-center justify-between">
              <span
                class="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1"
              >
                <UIcon name="i-lucide-sparkles" class="size-3" />
                Quick Modifiers
              </span>
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                color="neutral"
                @click="isModifierSlideoverOpen = true"
              >
                Add Modifiers
              </UButton>
            </div>

            <div
              v-if="selectedTagsList.length"
              class="flex flex-wrap gap-1.5 bg-muted/20 p-2 rounded-lg border border-default/10"
            >
              <UButton
                v-for="tag in selectedTagsList"
                :key="tag.id"
                size="xs"
                variant="solid"
                color="primary"
                class="rounded-full shadow-sm shadow-primary/20"
                icon="i-lucide-x"
                trailing
                @click="toggleTag(tag.id)"
              >
                {{ tag.label }}
              </UButton>
            </div>
          </div>

          <!-- Clear All -->
          <div v-if="attachedPerson || tagSnippets" class="flex justify-end">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              @click="handleClearAll"
            >
              Clear All
            </UButton>
          </div>
        </div>

        <!-- Compiled Prompt Preview -->
        <div
          v-if="(attachedPerson || tagSnippets || activePresetIds.length > 0) && charCount > 0"
          class="rounded-xl bg-muted/30 border border-default/10 p-3 space-y-1.5"
        >
          <div class="flex items-center justify-between">
            <span
              class="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1"
            >
              <UIcon name="i-lucide-eye" class="size-3" />
              Final Prompt Preview
            </span>
            <span class="text-[10px] text-dimmed">{{ charCount }} chars</span>
          </div>
          <p class="text-sm text-default font-mono leading-relaxed wrap-break-word">
            {{ compiledPrompt }}
          </p>
        </div>

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

          <!-- Image Count (T2I only) — inline with aspect ratio -->
          <UFormField v-if="activeTab === 't2i'" label="Images" class="w-full sm:w-auto">
            <div class="flex gap-1">
              <UButton
                v-for="count in imageCounts"
                :key="count"
                :label="String(count)"
                :variant="imageCount === count ? 'solid' : 'outline'"
                :color="imageCount === count ? 'primary' : 'neutral'"
                size="sm"
                class="min-w-9"
                @click="imageCount = count"
              />
            </div>
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

        <!-- Action Buttons -->
        <div class="flex gap-3">
          <UButton
            size="lg"
            icon="i-lucide-sparkles"
            :loading="generating && !feelingLucky"
            :disabled="isGenerateDisabled || feelingLucky"
            class="flex-1 rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow"
            :label="
              generating && !feelingLucky
                ? 'Generating...'
                : imageCount > 1 && activeTab === 't2i'
                  ? `Generate ${imageCount} Images`
                  : 'Generate'
            "
            @click="handleGenerate"
          />
          <UTooltip
            v-if="activeTab === 't2i' || activeTab === 't2v'"
            text="Pick random presets and auto-generate"
          >
            <UButton
              size="lg"
              icon="i-lucide-dice-5"
              color="neutral"
              variant="outline"
              :loading="feelingLucky"
              :disabled="generating || feelingLucky"
              class="rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow min-w-[160px]"
              :label="feelingLucky ? 'Rolling...' : 'Feeling Lucky'"
              @click="handleFeelingLucky"
            />
          </UTooltip>
        </div>
      </div>

      <!-- Result Display -->
      <GenerationResult
        v-if="latestResult"
        :latest-result="latestResult"
        :latest-results="latestResults"
        :latest-media-type="latestMediaType"
        :latest-result-error="latestResultError"
        :upscaling="upscaling"
        @open-viewer="(gen: Generation) => galleryViewer.open([gen], 0)"
        @open-batch-viewer="openBatchViewer"
        @animate="animateResult"
        @edit="editResult"
        @upscale="(id: string) => upscaleGeneration(id)"
        @animate-latest="animateLatestImage"
        @edit-latest="editLatestImage"
        @retry="handleRetry"
        @dismiss="handleDismiss"
      />

      <!-- Recent Generations -->
      <RecentImagesCarousel
        :generations="recentGenerations"
        @click="openRecentViewer"
        @use-as-source="useGenerationAsSource"
        @upscale="(gen) => upscaleGeneration(gen.id)"
      />
    </div>

    <!-- Enhance Modal -->
    <EnhanceModal
      v-model:open="isEnhanceModalOpen"
      v-model:instructions="enhanceInstructions"
      v-model:image-base64="enhanceImageBase64"
      :enhancing="enhancing"
      @enhance="enhanceCurrentPrompt"
    />

    <!-- Prompt Library Modal -->
    <PromptLibraryModal v-model:open="isLibraryModalOpen" @use-prompt="handleUseBuilderPrompt" />

    <!-- Gallery Viewer -->
    <GalleryViewer />

    <!-- Quick Modifiers Slideover -->
    <ModifierSlideover
      v-model:open="isModifierSlideoverOpen"
      :tag-categories="tagCategories"
      :selected-tags-list="selectedTagsList"
      :filtered-tags="filteredTags"
      :tag-search-query="tagSearchQuery"
      @toggle-tag="toggleTag"
      @update:tag-search-query="tagSearchQuery = $event"
    />
  </div>
</template>
