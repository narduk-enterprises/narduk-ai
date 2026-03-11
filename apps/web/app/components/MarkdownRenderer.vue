<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{
  content: string
}>()

// Configure marked for safe, clean output
const renderer = new marked.Renderer()

// Add language label + data attribute for copy button injection
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const langLabel = lang ? `<span class="code-lang">${lang}</span>` : ''
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  return `<div class="code-block-wrapper"><div class="code-block-header">${langLabel}<button class="code-copy-btn" data-code="${escaped}" title="Copy code" type="button"><span class="copy-icon">⧉</span><span class="check-icon hidden">✓</span></button></div><pre><code class="language-${lang || ''}">${escaped}</code></pre></div>`
}

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  return marked.parse(props.content) as string
})

// Handle code copy button clicks via event delegation
function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const btn = target.closest('.code-copy-btn') as HTMLElement | null
  if (!btn) return

  const code = btn.getAttribute('data-code')
  if (!code) return

  // Decode HTML entities back to raw text
  const textarea = document.createElement('textarea')
  textarea.innerHTML = code
  const decoded = textarea.value

  navigator.clipboard
    .writeText(decoded)
    .then(() => {
      const copyIcon = btn.querySelector('.copy-icon')
      const checkIcon = btn.querySelector('.check-icon')
      if (copyIcon) copyIcon.classList.add('hidden')
      if (checkIcon) checkIcon.classList.remove('hidden')
      setTimeout(() => {
        if (copyIcon) copyIcon.classList.remove('hidden')
        if (checkIcon) checkIcon.classList.add('hidden')
      }, 2000)
      return
    })
    .catch(() => {
      // Clipboard not available
    })
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div class="markdown-body" v-html="renderedHtml" @click="handleClick" />
</template>
