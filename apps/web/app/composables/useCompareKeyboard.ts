/**
 * Keyboard shortcut handler for the Compare page.
 * Manages arena and manual compare key bindings with proper lifecycle.
 */
export function useCompareKeyboard(options: {
  arenaActive: Ref<boolean>
  currentPair: Ref<{ left: { id: string }; right: { id: string } } | null>
  arenaVoting: Ref<boolean>
  canVote: Ref<boolean>
  savingVote: Ref<boolean>
  isPickerOpen: Ref<boolean>
  leftImage: Ref<{ id: string } | null>
  rightImage: Ref<{ id: string } | null>
  submitArenaVote: (id: string) => void
  skipPair: () => void
  submitVote: (id: string) => void
}) {
  function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return target.closest('input, textarea, [contenteditable="true"], [role="textbox"]') !== null
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return
    const key = event.key.toLowerCase()

    // Arena mode shortcuts
    if (options.arenaActive.value && options.currentPair.value && !options.arenaVoting.value) {
      if (key === 'a') {
        event.preventDefault()
        options.submitArenaVote(options.currentPair.value.left.id)
      }
      if (key === 'b') {
        event.preventDefault()
        options.submitArenaVote(options.currentPair.value.right.id)
      }
      if (key === 's') {
        event.preventDefault()
        options.skipPair()
      }
      return
    }

    // Manual mode shortcuts
    if (!options.canVote.value || options.savingVote.value || options.isPickerOpen.value) return

    if (key === 'a' && options.leftImage.value) {
      event.preventDefault()
      options.submitVote(options.leftImage.value.id)
    }
    if (key === 'b' && options.rightImage.value) {
      event.preventDefault()
      options.submitVote(options.rightImage.value.id)
    }
  }

  onMounted(() => {
    if (import.meta.client) {
      window.addEventListener('keydown', handleKeydown)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('keydown', handleKeydown)
    }
  })
}
