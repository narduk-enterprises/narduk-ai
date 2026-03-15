<script setup lang="ts">
import type { Generation } from '~/types/generation'
import { GENERATION_MODES } from '~/utils/generationModes'
import { getGenerationSharePrompt } from '~/utils/generationPrompt'

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
  selectedImageModel,
  selectedVideoModel,
  activePresets,
  activePresetIds,
  prosePrompt,
  promptWarnings,
  isCharacterJsonModalOpen,
  characterJsonInput,
  characterJsonError,
  parsingCharacterJson,
  hasCharacterBatchImport,
  isCharacterBatchReady,
  characterBatchRequestCount,
  latestResult,
  latestResults,
  recentGenerations,
  userImages,
  generating,
  isGenerating,
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
  parseCharacterJsonImport,
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
  useCompiledPromptAsDraft,
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
  tagCategories,
  ensureTagsLoaded,
  toggleTag,
  clearTags,
  selectedTagsList,
  tagSearchQuery,
  filteredTags,
  tagSnippets,
  loadingGenerations,
  loadingMoreGenerations,
  isGenerationsFinished,
  loadMoreGenerations,
  clearCharacterJsonImport,
} = useGenerationForm()

const { deleteGeneration } = useGenerate()
const { elements, ensureLoaded: ensureElementsLoaded, remixPrompt } = usePromptElements()
const { templates, ensureLoaded: ensureTemplatesLoaded } = usePromptTemplates()

const isModifierSlideoverOpen = ref(false)
const isLibraryModalOpen = ref(false)
const selectedTemplateId = ref<string | null>(null)

const { imageModels, videoModels, pending: modelsPending, error: modelsError } = useXaiModels()

// ── Complexity indicator ─────────────────────────────────────
const attachedElementCount = computed(() => {
  let count = 0
  if (attachedPerson.value) count++
  for (const key of Object.keys(attachedPresets.value)) {
    if (attachedPresets.value[key]) count++
  }
  return count
})

const complexityLevel = computed<'green' | 'yellow' | 'red'>(() => {
  if (attachedElementCount.value <= 3) return 'green'
  if (attachedElementCount.value <= 5) return 'yellow'
  return 'red'
})

const complexityLabel = computed(() => {
  if (complexityLevel.value === 'green') return 'Optimal'
  if (complexityLevel.value === 'yellow') return 'Complex'
  return 'Overloaded'
})

const selectedTemplate = computed(
  () => templates.value.find((t) => t.id === selectedTemplateId.value) ?? null,
)

const templateSelectItems = computed(() =>
  templates.value.map((t) => ({
    label: t.name,
    value: t.id,
  })),
)

// Preset type configuration for UI rendering
const PRESET_TYPE_CONFIG: Record<string, { label: string; icon: string; order: number }> = {
  person: { label: 'Person', icon: 'i-lucide-user', order: 0 },
  scene: { label: 'Scene', icon: 'i-lucide-mountain', order: 1 },
  clothing: { label: 'Clothing', icon: 'i-lucide-shirt', order: 2 },
  style: { label: 'Style', icon: 'i-lucide-palette', order: 3 },
  framing: { label: 'Framing', icon: 'i-lucide-frame', order: 4 },
  action: { label: 'Action', icon: 'i-lucide-zap', order: 5 },
}

const personElements = computed(() => elements.value.filter((el) => el.type === 'person'))

const otherPresetTypes = computed(() => {
  const types = ['scene', 'clothing', 'style', 'framing', 'action']
  return types
    .filter((t) => elements.value.some((el) => el.type === t))
    .map((t) => ({
      type: t,
      ...(PRESET_TYPE_CONFIG[t] || { label: t, icon: 'i-lucide-box', order: 99 }),
      elements: elements.value.filter((el) => el.type === t),
    }))
    .sort((a, b) => a.order - b.order)
})

// ── Preset select items (USelectMenu format) ─────────────────────
const personSelectItems = computed(() =>
  personElements.value.map((p) => ({
    label: p.name,
    value: p.id,
  })),
)

const typeSelectItemsMap = computed(() => {
  const map: Record<string, Array<{ label: string; value: string }>> = {}
  for (const el of elements.value) {
    if (el.type === 'person') continue // handled by personSelectItems
    if (!map[el.type]) map[el.type] = []
    map[el.type]!.push({
      label: el.name,
      value: el.id,
    })
  }
  return map
})

function handlePersonSelect(item: { label: string; value: string } | null) {
  if (!item) return
  const p = personElements.value.find((e) => e.id === item.value)
  if (p) attachPerson(p)
}

function handlePresetSelect(type: string, item: { label: string; value: string } | null) {
  if (!item) return
  const el = elements.value.find((e) => e.type === type && e.id === item.value)
  if (el) attachPreset(type, el)
}

function getPresetPreviewUrl(el: { metadata?: string | null }): string | null {
  if (!el.metadata) return null
  try {
    const meta = JSON.parse(el.metadata)
    return meta.headshotUrl || meta.fullBodyUrl || null
  } catch {
    return null
  }
}

const galleryViewer = useGalleryViewer()
const { handleCompare } = useGalleryActions({ galleryViewer })

function openRecentViewer(gen: Generation) {
  const idx = recentGenerations.value.findIndex((g: Generation) => g.id === gen.id)
  galleryViewer.open(recentGenerations.value as unknown as Generation[], idx >= 0 ? idx : 0)
}

function handleClearAll() {
  if (hasCharacterBatchImport.value) {
    clearCharacterJsonImport()
  }
  detachPerson()
  clearTags()
}

function handleUseBuilderPrompt(newPrompt: string) {
  if (hasCharacterBatchImport.value) {
    clearCharacterJsonImport()
  }
  prompt.value = newPrompt
}

function handleUseGenerationPrompt(gen: Generation) {
  navigateTo({
    path: '/generate',
    query: {
      prompt: getGenerationSharePrompt(gen),
      mode: gen.type === 'video' ? 't2v' : 't2i',
    },
  })
}

const showFinalPromptPanel = computed(() => {
  const finalPrompt = prosePrompt.value.trim()
  if (!finalPrompt) return false

  return (
    finalPrompt !== prompt.value.trim() ||
    activePresetIds.value.length > 0 ||
    selectedTagsList.value.length > 0
  )
})

const promptFieldLabel = computed(() => {
  if (hasCharacterBatchImport.value) {
    return activeTab.value === 't2i' ? 'Batch Preview' : 'Batch Preview (T2I Only)'
  }

  if (activeTab.value === 'i2i' || activeTab.value === 'i2v') {
    return 'Final Prompt'
  }

  return showFinalPromptPanel.value ? 'Prompt Draft' : 'Prompt'
})

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
  ensureElementsLoaded()
  ensureTagsLoaded()
  ensureTemplatesLoaded()
  if (!recentGenerations.value.length) loadMoreGenerations(20)
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

const modes = GENERATION_MODES

const activeMode = computed(() => modes.find((m) => m.value === activeTab.value))

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']
const resolutions = ['480p', '720p']
const imageCounts = [1, 2, 3, 4]

const generateButtonLabel = computed(() => {
  if (hasCharacterBatchImport.value) {
    if (!isCharacterBatchReady.value) return 'Switch To Text To Image'
    if (isGenerating.value) return 'Generating Imported Images...'
    return `Generate ${characterBatchRequestCount.value} Imported Image${characterBatchRequestCount.value === 1 ? '' : 's'}`
  }

  if (isGenerating.value && !feelingLucky.value) {
    return 'Generating...'
  }

  if (imageCount.value > 1 && activeTab.value === 't2i') {
    return `Generate ${imageCount.value} Images`
  }

  return 'Generate'
})

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
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-safe">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="font-display text-3xl sm:text-4xl font-bold mb-1">Generate</h1>
      <p class="text-muted">Create images and videos with AI</p>
    </div>

    <!-- Desktop: 2-col split. Mobile: single col -->
    <div class="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
      <!-- ── LEFT COLUMN: Form ─────────────────────────────────────── -->
      <div class="space-y-4 min-w-0">
        <!-- Mode Selector -->
        <div class="space-y-1.5">
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
          <div v-if="activeMode" class="flex flex-wrap items-center gap-2 pl-1">
            <p class="text-xs text-muted">{{ activeMode.description }}</p>
            <UBadge color="neutral" variant="subtle" size="sm">
              Input: {{ activeMode.inputLabel }}
            </UBadge>
            <UBadge color="neutral" variant="subtle" size="sm">
              Output: {{ activeMode.outputLabel }}
            </UBadge>
          </div>
        </div>

        <!-- Generation Form Card -->
        <div class="glass-card p-5 space-y-4">
          <!-- ── Template Selector ──────────────────────────────────── -->
          <div
            v-if="!hasCharacterBatchImport && templates.length"
            class="flex flex-wrap items-center gap-2"
          >
            <USelectMenu
              :items="templateSelectItems"
              :model-value="
                templateSelectItems.find((i) => i.value === selectedTemplateId) ?? undefined
              "
              placeholder="Choose a template..."
              searchable
              :search-attributes="['label']"
              :ui="{ content: 'min-w-64' }"
              @update:model-value="(item) => (selectedTemplateId = item?.value ?? null)"
            >
              <UButton
                size="xs"
                :variant="selectedTemplateId ? 'solid' : 'outline'"
                :color="selectedTemplateId ? 'primary' : 'neutral'"
                icon="i-lucide-layout-template"
                class="rounded-full"
              >
                {{ selectedTemplate?.name || 'Template' }}
              </UButton>
            </USelectMenu>
            <UButton
              v-if="selectedTemplateId"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              class="rounded-full"
              @click="selectedTemplateId = null"
            />
            <p v-if="selectedTemplate?.description" class="text-xs text-muted">
              {{ selectedTemplate.description }}
            </p>
          </div>

          <!-- ── Complexity Indicator ───────────────────────────────── -->
          <div v-if="attachedElementCount > 0" class="flex items-center gap-2">
            <div
              class="size-2 rounded-full"
              :class="{
                'bg-success': complexityLevel === 'green',
                'bg-warning': complexityLevel === 'yellow',
                'bg-error': complexityLevel === 'red',
              }"
            />
            <span
              class="text-xs"
              :class="{
                'text-success': complexityLevel === 'green',
                'text-warning': complexityLevel === 'yellow',
                'text-error': complexityLevel === 'red',
              }"
            >
              {{ complexityLabel }} ({{ attachedElementCount }} element{{
                attachedElementCount === 1 ? '' : 's'
              }})
            </span>
            <UTooltip
              v-if="complexityLevel !== 'green'"
              :text="
                complexityLevel === 'red'
                  ? 'Aurora produces best results with 3-4 elements. Consider removing some for sharper output.'
                  : 'Prompt has several elements — results may vary. Aurora works best with 3-4 core elements.'
              "
            >
              <UIcon name="i-lucide-info" class="size-3.5 text-muted" />
            </UTooltip>
          </div>

          <!-- ── Preset Slot Tray ───────────────────────────────────── -->
          <div
            v-if="!hasCharacterBatchImport && (personElements.length || otherPresetTypes.length)"
            class="flex flex-wrap items-center gap-2"
          >
            <!-- Person slot -->
            <template v-if="personElements.length">
              <!-- Selected: chip -->
              <div
                v-if="attachedPerson"
                class="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary"
              >
                <UAvatar
                  v-if="getPresetPreviewUrl(attachedPerson)"
                  :src="getPresetPreviewUrl(attachedPerson)!"
                  :alt="attachedPerson.name"
                  size="2xs"
                  class="ring-1 ring-primary/30"
                />
                <UIcon v-else name="i-lucide-user" class="size-3.5" />
                <span>{{ attachedPerson.name }}</span>
                <UButton
                  color="primary"
                  variant="ghost"
                  icon="i-lucide-x"
                  size="xs"
                  :padded="false"
                  class="rounded-full hover:bg-primary/20 -mr-0.5"
                  @click="detachPerson()"
                />
              </div>
              <!-- Unselected: searchable select -->
              <USelectMenu
                v-else
                :items="personSelectItems"
                searchable
                :search-attributes="['label']"
                placeholder="Search person..."
                :ui="{ content: 'min-w-72' }"
                @update:model-value="handlePersonSelect"
              >
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  icon="i-lucide-user"
                  class="rounded-full text-muted hover:text-primary"
                >
                  Person
                </UButton>
              </USelectMenu>
            </template>

            <!-- Other preset type slots -->
            <template v-for="pt in otherPresetTypes" :key="pt.type">
              <!-- Selected chip -->
              <div
                v-if="attachedPresets[pt.type]"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary"
              >
                <UIcon :name="pt.icon" class="size-3.5" />
                <span>{{ attachedPresets[pt.type]?.name }}</span>
                <UButton
                  color="primary"
                  variant="ghost"
                  icon="i-lucide-x"
                  size="xs"
                  :padded="false"
                  class="rounded-full hover:bg-primary/20 -mr-0.5"
                  @click="detachPreset(pt.type)"
                />
              </div>
              <!-- Searchable select -->
              <USelectMenu
                v-else
                :items="typeSelectItemsMap[pt.type] || []"
                searchable
                :search-attributes="['label']"
                :placeholder="`Search ${pt.label.toLowerCase()}...`"
                :ui="{ content: 'min-w-72' }"
                @update:model-value="(item) => handlePresetSelect(pt.type, item)"
              >
                <UButton
                  size="xs"
                  variant="outline"
                  color="neutral"
                  :icon="pt.icon"
                  class="rounded-full text-muted hover:text-primary"
                >
                  {{ pt.label }}
                </UButton>
              </USelectMenu>
            </template>

            <!-- Quick Modifiers button -->
            <USeparator v-if="tagCategories.length" orientation="vertical" class="h-5 mx-0.5" />
            <UButton
              v-if="tagCategories.length"
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-sparkles"
              class="rounded-full text-muted hover:text-primary"
              @click="isModifierSlideoverOpen = true"
            >
              Modifiers<span v-if="selectedTagsList.length" class="ml-1 text-primary font-bold">{{
                selectedTagsList.length
              }}</span>
            </UButton>

            <!-- Clear button -->
            <UButton
              v-if="attachedPerson || Object.keys(attachedPresets).length || tagSnippets"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              class="rounded-full ml-auto"
              @click="handleClearAll"
            />
          </div>

          <!-- Active modifier chips -->
          <div
            v-if="!hasCharacterBatchImport && selectedTagsList.length"
            class="flex flex-wrap gap-1.5"
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

          <!-- Prompt Input -->
          <UFormField>
            <template #label>
              <div class="flex items-center gap-1.5">
                <span>{{ promptFieldLabel }}</span>
                <UTooltip
                  v-if="activeTab === 'i2i' || activeTab === 'i2v'"
                  text="When using a source image, describe the entire desired output, not just the changes."
                  :popper="{ placement: 'top' }"
                >
                  <UIcon
                    name="i-lucide-info"
                    class="size-4 text-muted hover:text-primary transition-colors cursor-help"
                  />
                </UTooltip>
              </div>
            </template>

            <!-- I2I Instructions -->
            <div
              v-if="(activeTab === 'i2i' || activeTab === 'i2v') && sourceGeneration"
              class="space-y-3 mb-3 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-default/10"
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
                  placeholder="e.g. Make it a snowy winter scene..."
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
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  icon="i-lucide-file-json"
                  class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                  @click="isCharacterJsonModalOpen = true"
                >
                  Import JSON
                </UButton>
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
                  icon="i-lucide-shuffle"
                  :loading="remixing"
                  :disabled="hasCharacterBatchImport || !prompt.trim() || generating || remixing"
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
                  :disabled="hasCharacterBatchImport || !prompt.trim() || generating || enhancing"
                  class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-xs min-h-9"
                  @click="openEnhanceModal"
                >
                  Enhance
                </UButton>
                <span class="text-xs text-dimmed">{{ charCount }} chars</span>
              </div>
            </template>
          </UFormField>

          <div
            v-if="hasCharacterBatchImport"
            class="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-3"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-default">JSON Batch Test Loaded</p>
                  <UBadge
                    color="info"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-flask-conical"
                    label="Test Only"
                  />
                </div>
                <p class="text-xs text-muted">
                  {{ characterBatchRequestCount }} request{{
                    characterBatchRequestCount === 1 ? '' : 's'
                  }}
                  prepared from the imported character schema. The prompt field is a preview only.
                  Generate will send one xAI image request per imported prompt.
                </p>
                <p v-if="!isCharacterBatchReady" class="text-xs text-warning">
                  Switch back to Text to Image to submit this imported batch.
                </p>
                <p class="text-xs text-dimmed">
                  xAI Batch API does not currently support image generation, so this test flow runs
                  imported prompts through parallel image requests on the server.
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-file-json"
                  @click="isCharacterJsonModalOpen = true"
                >
                  Edit JSON
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  @click="clearCharacterJsonImport"
                >
                  Clear Test Import
                </UButton>
              </div>
            </div>
          </div>

          <div
            v-if="!hasCharacterBatchImport && showFinalPromptPanel"
            class="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-3"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-default">Final Prompt</p>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-lock"
                    label="Read only"
                  />
                </div>
                <p class="text-xs text-muted">
                  This is the exact prompt that will be sent after presets and modifiers are merged.
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <CopyButton :text="prosePrompt" />
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-file-pen-line"
                  @click="useCompiledPromptAsDraft"
                >
                  Edit Final Prompt
                </UButton>
              </div>
            </div>

            <!-- Prompt Warnings -->
            <div v-if="promptWarnings.length" class="space-y-1.5">
              <div
                v-for="(warning, idx) in promptWarnings"
                :key="idx"
                class="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
                :class="{
                  'bg-warning/10 text-warning': warning.severity === 'warning',
                  'bg-info/10 text-info': warning.severity === 'caution',
                  'bg-muted text-muted': warning.severity === 'info',
                }"
              >
                <UIcon
                  :name="
                    warning.severity === 'warning'
                      ? 'i-lucide-alert-triangle'
                      : warning.severity === 'caution'
                        ? 'i-lucide-alert-circle'
                        : 'i-lucide-info'
                  "
                  class="size-3.5 mt-0.5 shrink-0"
                />
                <div>
                  <p>{{ warning.message }}</p>
                  <p v-if="warning.suggestion" class="opacity-75 mt-0.5">
                    💡 {{ warning.suggestion }}
                  </p>
                </div>
              </div>
            </div>

            <div
              class="rounded-xl border border-default/50 bg-muted/35 px-4 py-3 text-sm leading-relaxed text-muted whitespace-pre-wrap max-h-72 overflow-y-auto select-text cursor-text"
            >
              {{ prosePrompt }}
            </div>
          </div>

          <!-- Options Row -->
          <div class="flex flex-wrap items-end gap-4">
            <UFormField
              v-if="activeTab === 't2i' || activeTab === 't2v'"
              label="Aspect Ratio"
              class="w-auto"
            >
              <USelect v-model="aspectRatio" :items="aspectRatios" class="w-28" />
            </UFormField>
            <UFormField
              v-if="activeTab === 't2i' && !hasCharacterBatchImport"
              label="Images"
              class="w-auto"
            >
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
            <UFormField
              v-if="activeTab === 't2v' || activeTab === 'i2v'"
              label="Duration"
              class="w-auto"
            >
              <div class="flex items-center gap-3">
                <USlider v-model="duration" :min="1" :max="15" :step="1" class="w-32" />
                <span class="text-sm text-muted font-mono w-8">{{ duration }}s</span>
              </div>
            </UFormField>
            <UFormField
              v-if="activeTab === 't2v' || activeTab === 'i2v'"
              label="Resolution"
              class="w-auto"
            >
              <USelect v-model="resolution" :items="resolutions" class="w-24" />
            </UFormField>
            <!-- Image Model Picker (T2I / I2I) -->
            <UFormField
              v-if="(activeTab === 't2i' || activeTab === 'i2i') && !hasCharacterBatchImport"
              label="Model"
              class="w-auto"
              :error="modelsError ? 'Load failed' : false"
            >
              <USelect
                v-model="selectedImageModel"
                :items="imageModels"
                :loading="modelsPending"
                :disabled="modelsPending || !!modelsError"
                class="min-w-56 w-auto"
              />
            </UFormField>
            <!-- Video Model Picker (T2V / I2V) -->
            <UFormField
              v-if="activeTab === 't2v' || activeTab === 'i2v'"
              label="Model"
              class="w-auto"
              :error="modelsError ? 'Load failed' : false"
            >
              <USelect
                v-model="selectedVideoModel"
                :items="videoModels"
                :loading="modelsPending"
                :disabled="modelsPending || !!modelsError"
                class="min-w-56 w-auto"
              />
            </UFormField>
          </div>

          <!-- Source Image -->
          <UFormField
            v-if="activeTab === 'i2v' || activeTab === 'i2i'"
            label="Source Image"
            required
          >
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
              :loading="isGenerating && !feelingLucky"
              :disabled="isGenerateDisabled || feelingLucky"
              class="flex-1 rounded-xl shadow-lg hover:shadow-primary/20 transition-shadow"
              :label="generateButtonLabel"
              @click="handleGenerate"
            />
            <UTooltip
              v-if="(activeTab === 't2i' || activeTab === 't2v') && !hasCharacterBatchImport"
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

        <!-- Recent Generations carousel stays below the form -->
        <RecentImagesCarousel
          :generations="recentGenerations"
          :loading="loadingGenerations"
          :loading-more="loadingMoreGenerations"
          :is-finished="isGenerationsFinished"
          @click="openRecentViewer"
          @use-as-source="useGenerationAsSource"
          @use-prompt="handleUseGenerationPrompt"
          @upscale="(gen) => upscaleGeneration(gen.id)"
          @compare="(gen) => handleCompare(gen, 'recent-carousel')"
          @load-more="loadMoreGenerations(20)"
        />
      </div>

      <!-- ── RIGHT COLUMN: Result (sticky on desktop) ──────────────── -->
      <div class="lg:sticky lg:top-4 min-w-0">
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
          @use-prompt="handleUseGenerationPrompt"
          @animate-latest="animateLatestImage"
          @edit-latest="editLatestImage"
          @retry="handleRetry"
          @dismiss="handleDismiss"
        />
        <!-- Desktop placeholder when no result yet -->
        <div
          v-else
          class="hidden lg:flex flex-col items-center justify-center glass-card min-h-[420px] text-center gap-3 p-8"
        >
          <div class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UIcon name="i-lucide-image" class="size-8 text-primary/50" />
          </div>
          <p class="text-muted text-sm">Your generated image will appear here</p>
        </div>
      </div>
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

    <CharacterJsonImportModal
      v-model:open="isCharacterJsonModalOpen"
      v-model:json-text="characterJsonInput"
      :loading="parsingCharacterJson"
      :error="characterJsonError"
      @parse="parseCharacterJsonImport"
    />

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
