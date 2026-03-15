/**
 * useElementVariants — manages outfit/mood/style variants for prompt elements.
 *
 * A variant overrides specific attributes of a base element (e.g., clothing,
 * accessories) while keeping core identity (face, hair, body) intact.
 * Used primarily for person presets.
 */

export interface ElementVariant {
  id: string
  elementId: string
  name: string
  variantAttributes: Record<string, string>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function useElementVariants() {
  const variants = ref<ElementVariant[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVariants(elementId: string) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<ElementVariant[]>('/api/variants', {
        query: { elementId },
      })
      variants.value = data
    } catch (e) {
      error.value = (e as { message?: string }).message || 'Failed to load variants'
    } finally {
      loading.value = false
    }
  }

  async function createVariant(payload: {
    elementId: string
    name: string
    variantAttributes: Record<string, string>
  }) {
    loading.value = true
    error.value = null
    try {
      const variant = await $fetch<ElementVariant>('/api/variants', {
        method: 'POST',
        body: payload,
      })
      variants.value.push(variant)
      return variant
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to create variant'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteVariant(id: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/variants/${id}`, { method: 'DELETE' })
      variants.value = variants.value.filter((v) => v.id !== id)
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      error.value = err.data?.message || err.message || 'Failed to delete variant'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Merge a variant's attributes with the base element's attributes.
   * Variant attributes override base attributes where keys match.
   */
  function mergeVariant(
    baseAttrs: Record<string, string>,
    variant: ElementVariant,
  ): Record<string, string> {
    return { ...baseAttrs, ...variant.variantAttributes }
  }

  /**
   * Get variants for a specific element from the loaded list.
   */
  function getVariantsForElement(elementId: string): ElementVariant[] {
    return variants.value.filter((v) => v.elementId === elementId)
  }

  return {
    variants,
    loading,
    error,
    fetchVariants,
    createVariant,
    deleteVariant,
    mergeVariant,
    getVariantsForElement,
  }
}
