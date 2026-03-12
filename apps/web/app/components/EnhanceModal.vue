<script setup lang="ts">
const isOpen = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  (e: 'enhance'): void
}>()

const enhanceInstructions = defineModel<string>('instructions', { default: '' })
const enhanceImageBase64 = defineModel<string | null>('imageBase64', { default: null })

const props = defineProps<{
  enhancing: boolean
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    enhanceImageBase64.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function removeImage() {
  enhanceImageBase64.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <UModal v-model:open="isOpen">
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
          @click="isOpen = false"
        />
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Tell Grok how you want to enhance your prompt. You can ask for a specific style, lighting,
          camera angle, or just leave it blank for a general enhancement.
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
            @click="fileInput?.click()"
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
              @click="removeImage"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="ghost" @click="isOpen = false"> Cancel </UButton>
        <UButton
          color="primary"
          icon="i-lucide-sparkles"
          :loading="props.enhancing"
          @click="emit('enhance')"
        >
          Enhance
        </UButton>
      </div>
    </template>
  </UModal>
</template>
