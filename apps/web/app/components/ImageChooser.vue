<script setup lang="ts">
import type { Generation } from '~/types/generation'

const props = defineProps<{
  modelValue: string
  userImages: Generation[]
  uploading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
  (e: 'upload', file: File): void
}>()

const isGalleryModalOpen = ref(false)
const searchQuery = ref('')
const dropZoneRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const isOverDropZone = ref(false)

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isOverDropZone.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isOverDropZone.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isOverDropZone.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file) handleFileSelected(file)
  }
}

// Find the currently selected image object
const selectedImage = computed(() => {
  if (!props.modelValue) return null
  return props.userImages.find((img) => img.id === props.modelValue)
})

// Filtered images for the gallery modal
const filteredImages = computed(() => {
  if (!searchQuery.value) return props.userImages

  const query = searchQuery.value.toLowerCase()
  return props.userImages.filter((img) => img.prompt.toLowerCase().includes(query))
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file) handleFileSelected(file)
    // Reset input so the same file can be selected again if needed
    target.value = ''
  }
}

function handleFileSelected(file: File) {
  // Check file type and size
  if (!file.type.startsWith('image/')) {
    useToast().add({
      title: 'Invalid File',
      description: 'Please select an image file.',
      color: 'error',
    })
    return
  }

  // 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    useToast().add({
      title: 'File Too Large',
      description: 'Image size must be less than 5MB.',
      color: 'error',
    })
    return
  }

  emit('upload', file)
}

function selectImage(id: string) {
  emit('update:modelValue', id)
  isGalleryModalOpen.value = false
  searchQuery.value = ''
}

function clearSelection() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="relative w-full">
    <!-- State 1: Image Selected -->
    <div
      v-if="selectedImage"
      class="relative group rounded-xl overflow-hidden ring-1 ring-default shadow-sm bg-muted/20 w-full sm:w-64 aspect-square max-w-sm"
    >
      <img
        :src="selectedImage.mediaUrl!"
        :alt="selectedImage.prompt"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      <!-- Overlay controls -->
      <div
        class="absolute inset-0 bg-default/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
      >
        <UButton
          color="neutral"
          icon="i-lucide-library"
          size="sm"
          class="bg-default/80 hover:bg-default"
          @click="isGalleryModalOpen = true"
        >
          Change
        </UButton>
        <UButton
          color="error"
          variant="outline"
          icon="i-lucide-trash"
          size="sm"
          class="bg-default/80 hover:bg-default hover:text-error"
          @click="clearSelection"
        >
          Remove
        </UButton>
      </div>

      <!-- Uploading overlay placeholder if replacing an existing selection with upload -->
      <div
        v-if="uploading"
        class="absolute inset-0 bg-default/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
      >
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        <span class="text-sm font-medium text-primary">Uploading...</span>
      </div>
    </div>

    <!-- State 2: Empty / Upload State -->
    <div v-else class="flex flex-col gap-3">
      <!-- Drag & Drop Zone -->
      <div
        ref="dropZoneRef"
        class="relative flex flex-col items-center justify-center w-full py-10 px-4 rounded-xl border-2 border-dashed transition-colors duration-200 cursor-pointer"
        :class="[
          isOverDropZone
            ? 'border-primary bg-primary/5'
            : 'border-default/20 bg-muted/10 hover:bg-muted/20 hover:border-default/40',
          uploading ? 'opacity-70 pointer-events-none' : '',
        ]"
        @click="!uploading && triggerFileInput()"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <!-- eslint-disable-next-line narduk/no-native-input -- Hidden input for file picking -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />

        <template v-if="uploading">
          <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary mb-3" />
          <p class="text-sm font-medium text-primary">Uploading image...</p>
        </template>
        <template v-else>
          <div class="p-3 bg-default rounded-full shadow-sm mb-3">
            <UIcon name="i-lucide-upload-cloud" class="size-6 text-primary" />
          </div>
          <p class="text-sm font-medium text-default text-center">
            Click to upload or drag and drop
          </p>
          <p class="text-xs text-dimmed text-center mt-1">PNG, JPG up to 5MB</p>
        </template>
      </div>

      <!-- Or choose from gallery -->
      <div class="flex items-center gap-4">
        <div class="h-px bg-default/10 flex-1"></div>
        <span class="text-xs text-muted uppercase font-semibold tracking-wider">or</span>
        <div class="h-px bg-default/10 flex-1"></div>
      </div>

      <UButton
        block
        color="neutral"
        variant="outline"
        icon="i-lucide-library"
        class="rounded-xl border-default/20"
        :disabled="uploading"
        @click="isGalleryModalOpen = true"
      >
        Choose from Gallery
      </UButton>
    </div>

    <!-- Gallery Modal -->
    <UModal
      v-model:open="isGalleryModalOpen"
      :ui="{
        content: 'sm:max-w-4xl flex flex-col h-[85vh] sm:h-[700px] overflow-hidden bg-default',
      }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-display font-semibold text-lg flex items-center gap-2">
            <UIcon name="i-lucide-library" class="size-5 text-primary" />
            Select Image
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            @click="isGalleryModalOpen = false"
          />
        </div>
      </template>

      <template #body>
        <div class="flex flex-col h-full gap-4">
          <!-- Search Header -->
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search by prompt..."
            class="w-full shrink-0"
            :ui="{ leadingIcon: 'text-muted' }"
          />

          <!-- Image Grid -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <div
              v-if="filteredImages.length === 0"
              class="flex flex-col items-center justify-center h-full py-12 text-center"
            >
              <UIcon name="i-lucide-image-off" class="size-10 text-dimmed mb-3" />
              <p class="text-sm font-medium text-muted">No images found</p>
              <p v-if="searchQuery" class="text-xs text-dimmed mt-1">
                Try adjusting your search query
              </p>
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
              <UButton
                v-for="img in filteredImages"
                :key="img.id"
                variant="ghost"
                :padded="false"
                class="relative aspect-square overflow-hidden rounded-xl ring-2 transition-all duration-200 hover:scale-[1.02] text-left group focus:outline-none"
                :class="[
                  modelValue === img.id
                    ? 'ring-primary shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'ring-transparent hover:ring-primary/40',
                ]"
                @click="selectImage(img.id)"
              >
                <img :src="img.mediaUrl!" :alt="img.prompt" class="h-full w-full object-cover" />

                <!-- Hover info overlay -->
                <div
                  class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <p class="text-[10px] text-white/90 line-clamp-2 leading-tight">
                    {{ img.prompt }}
                  </p>
                </div>

                <!-- Selected indicator -->
                <div
                  v-if="modelValue === img.id"
                  class="absolute flex items-center justify-center size-6 top-2 right-2 rounded-full bg-primary text-primary-foreground shadow-sm"
                >
                  <UIcon name="i-lucide-check" class="size-3.5" />
                </div>
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
