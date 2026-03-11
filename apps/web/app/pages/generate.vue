<script setup lang="ts">
import type { Generation } from '~/types/generation'
import type { QuickModifierCategory } from '~/composables/useQuickModifiers'

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
  latestResult,
  latestResults,
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
  currentMediaType,
  latestResultError,
  loadUserImages,
  handleGenerate,
  handleFeelingLucky,
  feelingLucky,
  openEnhanceModal,
  enhanceCurrentPrompt,
  animateLatestImage,
  editLatestImage,
  useGenerationAsSource,
  handleImageUpload,
  removeEnhanceImage,
  enhanceImageBase64,
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
  modifierSnippets,
  activeModifiers,
  attachPerson,
  detachPerson,
  compilePrompt,
  setModifierDependencies,
  activePromptElements,
} = useGenerationForm()

const { deleteGeneration } = useGenerate()

const { elements, fetchElements, remixPrompt } = usePromptElements()

const {
  categories: modifierCategories,
  toggleModifier,
  isSelected: isModifierSelected,
  clearModifiers,
  selectedModifiersList,
  fetchModifiers,
  allModifiersList,
  addModifiers,
  compiledSnippets,
  searchQuery,
  filteredModifiers,
} = useQuickModifiers()

const isModifierSlideoverOpen = ref(false)
const activeModifierCategory = ref<QuickModifierCategory | null>(null)

watch(modifierCategories, (newVal) => {
  if (newVal.length > 0 && !activeModifierCategory.value) {
    activeModifierCategory.value = newVal[0] ?? null
  }
})

// Wire up the form so it can auto-select modifiers when a preset is chosen
setModifierDependencies(allModifiersList.value, addModifiers)
watch(allModifiersList, (newList) => {
  setModifierDependencies(newList, addModifiers)
})

// Keep modifierSnippets and activeModifiers in sync
watch(compiledSnippets, (val) => {
  modifierSnippets.value = val
})
watch(
  selectedModifiersList,
  (val) => {
    activeModifiers.value = val
  },
  { immediate: true },
)

// Person presets for quick attachment
const personElements = computed(() => elements.value.filter((el) => el.type === 'person'))

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
const isComposeModalOpen = ref(false)
const isLibraryModalOpen = ref(false)

function openComposeModal() {
  isComposeModalOpen.value = true
}

interface DropdownItem {
  label: string
  description?: string
  onSelect?: () => void
}

const presetDropdownItems = computed(() => {
  if (!elements.value.length) return []

  const typeMap: Record<string, DropdownItem[]> = {}
  for (const el of elements.value) {
    if (!typeMap[el.type]) typeMap[el.type] = []
    typeMap[el.type]!.push({
      label: el.name,
      description: el.content.substring(0, 30) + '...',
      onSelect: () => {
        prompt.value = prompt.value ? `${prompt.value}\n\n${el.content}` : el.content
      },
    })
  }

  const nestedItems = []
  for (const [type, items] of Object.entries(typeMap)) {
    nestedItems.push({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      children: items,
      icon: 'i-lucide-folder',
    })
  }

  return [nestedItems]
})

function openRecentViewer(gen: Generation) {
  const idx = recentGenerations.value.findIndex((g: Generation) => g.id === gen.id)
  galleryViewer.open(recentGenerations.value, idx >= 0 ? idx : 0)
}

function handleClearAll() {
  detachPerson()
  clearModifiers()
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
  loadUserImages()
  fetchElements()
  fetchModifiers()
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
  { value: 't2i', label: 'Text → Image', icon: 'i-lucide-image' },
  { value: 't2v', label: 'Text → Video', icon: 'i-lucide-video' },
  { value: 'i2v', label: 'Image → Video', icon: 'i-lucide-wand-2' },
  { value: 'i2i', label: 'Image → Image', icon: 'i-lucide-layers' },
]

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']
const resolutions = ['480p', '720p']
const imageCounts = [1, 2, 3, 4]

function selectResultAndOpenViewer(gen: Generation) {
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
                variant="ghost"
                color="neutral"
                size="sm"
                icon="i-lucide-library"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                @click="isLibraryModalOpen = true"
              >
                Library
              </UButton>
              <UDropdownMenu v-if="presetDropdownItems?.length" :items="presetDropdownItems">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  icon="i-lucide-bookmark"
                  class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                >
                  Presets
                </UButton>
              </UDropdownMenu>
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

        <!-- Person Presets + Quick Modifiers -->
        <div
          v-if="personElements.length || modifierCategories.length"
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

          <!-- Active Modifiers & Add Button -->
          <div v-if="modifierCategories.length" class="space-y-3 mt-4">
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
              v-if="activeModifiers.length"
              class="flex flex-wrap gap-1.5 bg-muted/20 p-2 rounded-lg border border-default/10"
            >
              <UButton
                v-for="mod in activeModifiers"
                :key="mod.id"
                size="xs"
                variant="solid"
                color="primary"
                class="rounded-full shadow-sm shadow-primary/20"
                icon="i-lucide-x"
                trailing
                @click="toggleModifier(mod.id)"
              >
                {{ mod.label }}
              </UButton>
            </div>
          </div>

          <!-- Clear All -->
          <div v-if="attachedPerson || modifierSnippets" class="flex justify-end">
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
          v-if="
            (attachedPerson || modifierSnippets || activePromptElements.length > 0) && charCount > 0
          "
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
            {{ compilePrompt() }}
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

          <!-- Image Count (T2I only) -->
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
            Generating your {{ latestResult.type }}...
            {{
              latestResult.type === 'video'
                ? 'Videos may take several minutes.'
                : 'This should take a moment.'
            }}
          </p>
        </div>

        <!-- Done: Batch Grid (multiple results) -->
        <template
          v-else-if="latestResults.length > 1 && latestResults.every((r) => r.status === 'done')"
        >
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
              @click="selectResultAndOpenViewer(gen)"
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
                      @click.stop="animateResult(gen)"
                    />
                  </UTooltip>
                  <UTooltip text="Edit">
                    <UButton
                      variant="solid"
                      color="neutral"
                      icon="i-lucide-layers"
                      size="xs"
                      class="rounded-full"
                      @click.stop="editResult(gen)"
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
                      @click.stop="upscaleGeneration(gen.id)"
                    />
                  </UTooltip>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3 group w-full">
            <p class="text-sm text-muted flex-1">{{ latestResult?.prompt }}</p>
            <CopyPromptButton
              v-if="latestResult"
              :prompt="latestResult.prompt"
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
            @click="galleryViewer.open([latestResult!], 0)"
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
            <CopyPromptButton
              :prompt="latestResult.prompt"
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
                @click="animateLatestImage"
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
                @click="editLatestImage"
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
                @click="upscaleGeneration(latestResult!.id)"
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

        <!-- Failed -->
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
              @click="handleRetry"
            >
              Retry
            </UButton>
            <UButton
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              size="sm"
              class="rounded-full"
              @click="handleDismiss"
            >
              Dismiss
            </UButton>
          </div>
        </div>
      </div>

      <!-- Recent Generations -->
      <RecentImagesCarousel
        :generations="recentGenerations"
        @click="openRecentViewer"
        @use-as-source="useGenerationAsSource"
        @upscale="(gen) => upscaleGeneration(gen.id)"
      />
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
    <PromptBuilder
      v-model:open="isComposeModalOpen"
      :media-type="currentMediaType"
      @use-prompt="handleUseBuilderPrompt"
    />

    <!-- Prompt Library Modal -->
    <PromptLibraryModal v-model:open="isLibraryModalOpen" @use-prompt="handleUseBuilderPrompt" />

    <!-- Gallery Viewer -->
    <GalleryViewer />

    <!-- Quick Modifiers Slideover -->
    <USlideover v-model:open="isModifierSlideoverOpen" title="Quick Modifiers">
      <template #body>
        <div class="flex flex-col h-full overflow-hidden">
          <!-- Search Input -->
          <div class="p-3 sm:px-4 sm:py-3 border-b border-default/10 shrink-0">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search modifiers..."
              class="w-full"
            >
              <template #trailing>
                <UButton
                  v-if="searchQuery"
                  color="neutral"
                  variant="link"
                  icon="i-lucide-x"
                  :padded="false"
                  @click="searchQuery = ''"
                />
              </template>
            </UInput>
          </div>

          <!-- Slideover Content area -->
          <div class="flex-1 overflow-hidden" :class="searchQuery ? 'p-4 overflow-y-auto' : 'flex'">
            <!-- Search Results -->
            <div v-if="searchQuery">
              <div v-if="filteredModifiers.length" class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="mod in filteredModifiers"
                  :key="mod.id"
                  size="xs"
                  :variant="isModifierSelected(mod.id) ? 'solid' : 'outline'"
                  :color="isModifierSelected(mod.id) ? 'primary' : 'neutral'"
                  class="rounded-full transition-shadow duration-200"
                  :class="isModifierSelected(mod.id) ? 'shadow-sm shadow-primary/20' : ''"
                  @click="toggleModifier(mod.id)"
                >
                  {{ mod.label }}
                </UButton>
              </div>
              <div v-else class="text-center text-muted py-8 text-sm">
                No modifiers found for "{{ searchQuery }}"
              </div>
            </div>

            <!-- Category Tabs (No Search) -->
            <template v-else>
              <!-- Sidebar -->
              <div
                class="w-1/3 sm:w-2/5 border-r border-default/10 overflow-y-auto py-2 flex shrink-0 flex-col"
              >
                <UButton
                  v-for="cat in modifierCategories"
                  :key="cat.category"
                  variant="ghost"
                  :color="activeModifierCategory?.category === cat.category ? 'primary' : 'neutral'"
                  class="w-full justify-start rounded-none px-3 py-2 text-left shrink-0"
                  :class="
                    activeModifierCategory?.category === cat.category
                      ? 'bg-primary/10 font-medium'
                      : 'text-muted'
                  "
                  @click="activeModifierCategory = cat"
                >
                  <span class="truncate text-xs sm:text-sm">{{ cat.label || cat.category }}</span>
                </UButton>
              </div>
              <!-- Content -->
              <div class="flex-1 p-3 sm:p-4 overflow-y-auto">
                <div v-if="activeModifierCategory" class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="mod in activeModifierCategory.modifiers"
                    :key="mod.id"
                    size="xs"
                    :variant="isModifierSelected(mod.id) ? 'solid' : 'outline'"
                    :color="isModifierSelected(mod.id) ? 'primary' : 'neutral'"
                    class="rounded-full transition-shadow duration-200"
                    :class="isModifierSelected(mod.id) ? 'shadow-sm shadow-primary/20' : ''"
                    @click="toggleModifier(mod.id)"
                  >
                    {{ mod.label }}
                  </UButton>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end p-3 sm:pr-4 sm:pb-4 sm:pt-2">
          <UButton color="primary" @click="isModifierSlideoverOpen = false"> Done </UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
