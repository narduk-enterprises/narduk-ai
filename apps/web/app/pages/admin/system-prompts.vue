<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'System Prompts — Admin',
  description: 'Manage AI system prompts',
  robots: 'noindex',
})
useWebPageSchema({
  name: 'System Prompts',
  description: 'Admin interface for managing system prompts.',
})

const { prompts, status, saving, updatePrompt } = useAdminSystemPrompts()

const editingPrompt = ref<string | null>(null)
const editContent = ref('')
const isJsonContent = ref(false)

function detectJson(content: string): boolean {
  const trimmed = content.trim()
  // Check if starts with JSON-like structure or contains JSON response format instructions
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }
  return false
}

function startEdit(prompt: { name: string; content: string }) {
  editingPrompt.value = prompt.name
  editContent.value = prompt.content
  isJsonContent.value = detectJson(prompt.content)
}

function cancelEdit() {
  editingPrompt.value = null
  editContent.value = ''
  isJsonContent.value = false
}

function formatJson() {
  try {
    const parsed = JSON.parse(editContent.value.trim())
    editContent.value = JSON.stringify(parsed, null, 2)
    isJsonContent.value = true
  } catch {
    // Not valid JSON — try to find and format embedded JSON objects
    const formatted = editContent.value.replaceAll(/(\{[^{}]*\})/g, (match) => {
      try {
        return JSON.stringify(JSON.parse(match), null, 2)
      } catch {
        return match
      }
    })
    editContent.value = formatted
  }
}

function minifyJson() {
  try {
    const parsed = JSON.parse(editContent.value.trim())
    editContent.value = JSON.stringify(parsed)
  } catch {
    // Not valid JSON, do nothing
  }
}

async function savePrompt(name: string) {
  try {
    await updatePrompt(name, editContent.value)
    editingPrompt.value = null
  } catch {
    // Error already handled by composable toast
  }
}

const editorRows = computed(() => Math.min(Math.max(lineCount.value + 2, 10), 30))

function handleTab(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement
  if (!target) return

  event.preventDefault()
  const start = target.selectionStart
  const end = target.selectionEnd

  editContent.value =
    editContent.value.slice(0, Math.max(0, start)) +
    '  ' +
    editContent.value.slice(Math.max(0, end))

  nextTick(() => {
    target.selectionStart = start + 2
    target.selectionEnd = start + 2
  })
}

const lineCount = computed(() => {
  return editContent.value.split('\n').length
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <UButton
        to="/admin"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        class="mb-4 -ml-2"
      >
        Back to Admin
      </UButton>
      <div class="flex items-center gap-3 mb-2">
        <h1 class="font-display text-3xl font-bold">System Prompts</h1>
      </div>
      <p class="text-muted mt-2">
        Manage the underlying AI system prompts for generation and chat.
      </p>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center p-12">
      <UIcon name="i-lucide-loader-2" class="size-8 text-primary animate-spin" />
    </div>

    <div v-else class="space-y-6">
      <div v-for="prompt in prompts" :key="prompt.name" class="glass-card p-6 rounded-2xl">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h2 class="text-lg font-bold text-default">{{ prompt.name }}</h2>
            <p class="text-sm text-dimmed">{{ prompt.description }}</p>
          </div>
          <div class="text-xs text-muted flex flex-col items-end">
            <span>Last Updated</span>
            <span>{{ new Date(prompt.updatedAt).toLocaleDateString() }}</span>
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-if="editingPrompt === prompt.name">
          <!-- Editor toolbar -->
          <div
            class="flex items-center justify-between px-3 py-2 mb-0 rounded-t-lg bg-elevated border border-b-0 border-default"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs text-dimmed font-mono"> {{ lineCount }} lines </span>
              <USeparator orientation="vertical" class="h-4" />
              <span class="text-xs text-dimmed">
                {{ editContent.length.toLocaleString() }} chars
              </span>
            </div>
            <div class="flex items-center gap-1">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-braces"
                @click="formatJson"
              >
                Format JSON
              </UButton>
              <UButton
                v-if="isJsonContent"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-minimize-2"
                @click="minifyJson"
              >
                Minify
              </UButton>
            </div>
          </div>

          <!-- Textarea editor -->
          <div class="relative mb-4">
            <UTextarea
              v-model="editContent"
              class="w-full rounded-b-lg font-mono text-sm leading-relaxed"
              :rows="editorRows"
              autoresize
              spellcheck="false"
              @keydown.tab="handleTab"
            />
          </div>

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="cancelEdit">
              Cancel
            </UButton>
            <UButton color="primary" :loading="saving" @click="savePrompt(prompt.name)">
              Save Changes
            </UButton>
          </div>
        </div>

        <!-- Read Mode -->
        <div v-else>
          <div
            class="p-4 bg-muted/30 rounded-lg text-sm font-mono text-muted whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto"
          >
            {{ prompt.content }}
          </div>
          <div class="mt-4 flex justify-end">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-edit"
              @click="startEdit(prompt)"
            >
              Edit Prompt
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
