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
  handleImageUpload,
  removeEnhanceImage,
  enhanceImageBase64,
} = useGenerationForm()

const { elements, groupedByType, fetchElements, createElement, composeElements, remixPrompt } =
  usePromptElements()

const isComposeModalOpen = ref(false)
const composeSelection = reactive<Record<string, string | null>>({
  person: null,
  scene: null,
  framing: null,
  action: null,
})

function openComposeModal() {
  isComposeModalOpen.value = true
}

function toggleComposeSelection(type: string, content: string) {
  composeSelection[type] = composeSelection[type] === content ? null : content
}

const composing = ref(false)
const composedResult = ref<string | null>(null)
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

async function composeWithGrok() {
  composing.value = true
  composedResult.value = null
  try {
    composedResult.value = await composeElements(composeSelection)
  } catch (e) {
    console.error('Compose failed:', e)
    // Fallback to simple join
    composedResult.value = ['person', 'scene', 'framing', 'action']
      .map((t) => composeSelection[t])
      .filter(Boolean)
      .join('. ')
  } finally {
    composing.value = false
  }
}

async function useComposedPrompt() {
  if (!composedResult.value) return
  prompt.value = composedResult.value

  // Auto-save to library
  const componentNames = ['person', 'scene', 'framing', 'action']
    .filter((t) => composeSelection[t])
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
  const autoName = `Composed: ${componentNames.join(' + ')}`
  try {
    await createElement('prompt', autoName, composedResult.value)
  } catch (_e) {
    // Non-blocking — prompt is already in the field
  }

  // Close and reset
  isComposeModalOpen.value = false
  composedResult.value = null
  for (const key of Object.keys(composeSelection)) {
    composeSelection[key] = null
  }
}

const composeSelectionCount = computed(() => Object.values(composeSelection).filter(Boolean).length)

const composeTypeIcons: Record<string, string> = {
  person: 'i-lucide-user',
  scene: 'i-lucide-image',
  framing: 'i-lucide-camera',
  action: 'i-lucide-activity',
}

const composeCategories: Record<string, string> = {
  person: 'Person / Character',
  scene: 'Scene / Environment',
  framing: 'Framing / Camera',
  action: 'Action / Pose',
}

function isElementSelected(el: { type: string; content: string }) {
  return composeSelection[el.type] === el.content
}

function handleComposeToggle(el: { type: string; content: string }) {
  toggleComposeSelection(el.type, el.content)
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
              @keydown="handlePromptKeydown"
            />
          </div>
          <template #hint>
            <div class="flex items-center gap-3">
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-lucide-puzzle"
                :disabled="!elements.length"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-[10px]"
                @click="openComposeModal"
              >
                Compose
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-lucide-shuffle"
                :loading="remixing"
                :disabled="!prompt.trim() || generating || remixing"
                class="hover:text-primary transition-colors duration-200 uppercase tracking-widest text-[10px]"
                @click="handleRemix"
              >
                Remix
              </UButton>
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
          <div class="flex items-start gap-3 group w-full">
            <p class="text-sm text-muted flex-1">{{ latestResult.prompt }}</p>
            <CopyPromptButton
              :prompt="latestResult.prompt"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            />
          </div>
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
                <img
                  :src="enhanceImageBase64"
                  alt="Enhanced Source"
                  class="size-16 object-cover rounded-lg ring-1 ring-default shadow-sm"
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

    <!-- Compose from Parts Modal -->
    <UModal v-model:open="isComposeModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-display font-semibold text-lg flex items-center gap-2">
                <UIcon name="i-lucide-puzzle" class="size-5 text-primary" />
                Compose Prompt
              </h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                class="-my-1"
                @click="isComposeModalOpen = false"
              />
            </div>
          </template>

          <div class="space-y-5">
            <p class="text-sm text-muted">
              Pick one element from each category to assemble a complete prompt.
            </p>

            <div v-for="(typeLabel, typeKey) in composeCategories" :key="typeKey" class="space-y-2">
              <h4
                class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"
              >
                <UIcon :name="composeTypeIcons[typeKey] || 'i-lucide-folder'" class="size-3.5" />
                {{ typeLabel }}
              </h4>
              <div v-if="groupedByType[typeKey]?.length" class="flex flex-wrap gap-2">
                <UButton
                  v-for="el in groupedByType[typeKey]"
                  :key="el.id"
                  :variant="isElementSelected(el) ? 'solid' : 'outline'"
                  :color="isElementSelected(el) ? 'primary' : 'neutral'"
                  size="sm"
                  class="rounded-full transition-all duration-200"
                  :class="isElementSelected(el) ? 'shadow-md shadow-primary/20' : ''"
                  @click="handleComposeToggle(el)"
                >
                  {{ el.name }}
                </UButton>
              </div>
              <p v-else class="text-xs text-dimmed italic">No {{ typeKey }} presets yet.</p>
            </div>
          </div>

          <template #footer>
            <!-- Composed result preview -->
            <div v-if="composedResult" class="space-y-3">
              <div
                class="rounded-xl border border-primary/20 bg-primary/5 p-4 max-h-40 overflow-y-auto"
              >
                <p class="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  Assembled Prompt
                </p>
                <p class="text-sm text-default leading-relaxed">
                  {{ composedResult }}
                </p>
              </div>
              <div class="flex justify-end gap-3">
                <UButton color="neutral" variant="ghost" @click="composedResult = null">
                  Back
                </UButton>
                <UButton color="primary" icon="i-lucide-check" @click="useComposedPrompt">
                  Use Prompt
                </UButton>
              </div>
            </div>

            <!-- Selection controls -->
            <div v-else class="flex items-center justify-between">
              <span class="text-xs text-muted"> {{ composeSelectionCount }} of 4 selected </span>
              <div class="flex gap-3">
                <UButton color="neutral" variant="ghost" @click="isComposeModalOpen = false">
                  Cancel
                </UButton>
                <UButton
                  color="primary"
                  icon="i-lucide-sparkles"
                  :disabled="composeSelectionCount === 0"
                  :loading="composing"
                  @click="composeWithGrok"
                >
                  Compose with Grok
                </UButton>
              </div>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
