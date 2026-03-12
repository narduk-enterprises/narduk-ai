import type { ComputedRef } from 'vue'

export function useGalleryZoom(options: {
  isVideo: ComputedRef<boolean>
  next: () => void
  prev: () => void
}) {
  const MIN_ZOOM = 1
  const MAX_ZOOM = 16
  const DOUBLE_CLICK_ZOOM = 2.5

  const zoomLevel = ref(1)
  const panX = ref(0)
  const panY = ref(0)
  const isZoomed = computed(() => zoomLevel.value > 1.01)
  const isSelectZoomMode = ref(false)
  const isSelectingArea = ref(false)
  const selectionRect = ref<{ left: number; top: number; width: number; height: number } | null>(
    null,
  )

  const isDragging = ref(false)
  let dragStartX = 0
  let dragStartY = 0
  let panStartX = 0
  let panStartY = 0
  let selectionStartX = 0
  let selectionStartY = 0

  let lastPinchDist = 0
  let lastPinchZoom = 1
  let lastTapTime = 0
  let lastTapX = 0
  let lastTapY = 0

  const imageContainerRef = ref<HTMLElement | null>(null)

  const imageTransform = computed(
    () =>
      `scale(${zoomLevel.value}) translate(${panX.value / zoomLevel.value}px, ${panY.value / zoomLevel.value}px)`,
  )

  function clampPan(x: number, y: number): { x: number; y: number } {
    const el = imageContainerRef.value
    if (!el) return { x, y }
    const { width, height } = el.getBoundingClientRect()
    const maxX = (width * (zoomLevel.value - 1)) / 2
    const maxY = (height * (zoomLevel.value - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }

  function clampToContainer(pointX: number, pointY: number): { x: number; y: number } {
    const el = imageContainerRef.value
    if (!el) return { x: pointX, y: pointY }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(rect.width, pointX - rect.left)),
      y: Math.max(0, Math.min(rect.height, pointY - rect.top)),
    }
  }

  function clearSelectionRect() {
    isSelectingArea.value = false
    selectionRect.value = null
  }

  function cancelSelectZoomMode() {
    isSelectZoomMode.value = false
    clearSelectionRect()
  }

  function toggleSelectZoomMode() {
    if (options.isVideo.value) return
    if (isSelectZoomMode.value) cancelSelectZoomMode()
    else isSelectZoomMode.value = true
  }

  function updateSelectionRect(clientX: number, clientY: number) {
    const start = clampToContainer(selectionStartX, selectionStartY)
    const current = clampToContainer(clientX, clientY)
    selectionRect.value = {
      left: Math.min(start.x, current.x),
      top: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    }
  }

  function zoomToSelection(rect: { left: number; top: number; width: number; height: number }) {
    const el = imageContainerRef.value
    if (!el) return

    const bounds = el.getBoundingClientRect()
    const zoomFactor = Math.min(bounds.width / rect.width, bounds.height / rect.height)
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel.value * zoomFactor))
    const zoomRatio = nextZoom / zoomLevel.value
    const selectionCenterX = rect.left + rect.width / 2 - bounds.width / 2
    const selectionCenterY = rect.top + rect.height / 2 - bounds.height / 2

    zoomLevel.value = nextZoom
    const clamped = clampPan(
      (panX.value - selectionCenterX) * zoomRatio,
      (panY.value - selectionCenterY) * zoomRatio,
    )
    panX.value = clamped.x
    panY.value = clamped.y
  }

  function resetZoom() {
    zoomLevel.value = 1
    panX.value = 0
    panY.value = 0
    clearSelectionRect()
  }

  function zoomIn() {
    const next = Math.min(MAX_ZOOM, zoomLevel.value * 1.3)
    zoomLevel.value = next
    const clamped = clampPan(panX.value, panY.value)
    panX.value = clamped.x
    panY.value = clamped.y
  }

  function zoomOut() {
    const next = Math.max(MIN_ZOOM, zoomLevel.value / 1.3)
    zoomLevel.value = next
    if (next <= 1.01) {
      panX.value = 0
      panY.value = 0
    } else {
      const clamped = clampPan(panX.value, panY.value)
      panX.value = clamped.x
      panY.value = clamped.y
    }
  }

  function handleWheelZoom(e: WheelEvent) {
    if (options.isVideo.value) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? -0.15 : 0.15
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel.value * (1 + factor)))
    zoomLevel.value = next
    if (next <= 1.01) {
      panX.value = 0
      panY.value = 0
    } else {
      const clamped = clampPan(panX.value, panY.value)
      panX.value = clamped.x
      panY.value = clamped.y
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (options.isVideo.value || e.button !== 0) return
    if (isSelectZoomMode.value || e.shiftKey) {
      selectionStartX = e.clientX
      selectionStartY = e.clientY
      isSelectingArea.value = true
      updateSelectionRect(e.clientX, e.clientY)
      e.preventDefault()
      return
    }
    if (!isZoomed.value) return
    isDragging.value = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    panStartX = panX.value
    panStartY = panY.value
    e.preventDefault()
  }

  function handleMouseMove(e: MouseEvent) {
    if (isSelectingArea.value) {
      updateSelectionRect(e.clientX, e.clientY)
      return
    }
    if (!isDragging.value) return
    const clamped = clampPan(
      panStartX + (e.clientX - dragStartX),
      panStartY + (e.clientY - dragStartY),
    )
    panX.value = clamped.x
    panY.value = clamped.y
  }

  function handleMouseUp() {
    if (isSelectingArea.value) {
      const rect = selectionRect.value
      clearSelectionRect()
      if (rect && rect.width >= 24 && rect.height >= 24) {
        zoomToSelection(rect)
        isSelectZoomMode.value = false
      }
      return
    }
    isDragging.value = false
  }

  function handleDblClick(e: MouseEvent) {
    if (options.isVideo.value) return
    if (isSelectZoomMode.value) return
    if (isZoomed.value) {
      resetZoom()
    } else {
      const el = imageContainerRef.value
      if (el) {
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left - rect.width / 2
        const cy = e.clientY - rect.top - rect.height / 2
        zoomLevel.value = DOUBLE_CLICK_ZOOM
        const clamped = clampPan(cx * (DOUBLE_CLICK_ZOOM - 1), cy * (DOUBLE_CLICK_ZOOM - 1))
        panX.value = clamped.x
        panY.value = clamped.y
      } else {
        zoomLevel.value = DOUBLE_CLICK_ZOOM
      }
    }
  }

  // Touch / Swipe + Pinch Navigation
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  let touchMoved = false

  function handleTouchStart(e: TouchEvent) {
    if (isSelectZoomMode.value) cancelSelectZoomMode()
    touchMoved = false
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      lastPinchDist = Math.hypot(dx, dy)
      lastPinchZoom = zoomLevel.value
      return
    }
    const touch = e.touches[0]
    if (touch) {
      touchStartX.value = touch.clientX
      touchStartY.value = touch.clientY
      if (isZoomed.value) {
        isDragging.value = true
        dragStartX = touch.clientX
        dragStartY = touch.clientY
        panStartX = panX.value
        panStartY = panY.value
      }
    }
  }

  function handleTouchMove(e: TouchEvent) {
    touchMoved = true
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      const dist = Math.hypot(dx, dy)
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, lastPinchZoom * (dist / lastPinchDist)))
      zoomLevel.value = next
      if (next <= 1.01) {
        panX.value = 0
        panY.value = 0
      } else {
        const clamped = clampPan(panX.value, panY.value)
        panX.value = clamped.x
        panY.value = clamped.y
      }
      return
    }
    if (isDragging.value && isZoomed.value && e.touches.length === 1) {
      const t = e.touches[0]!
      const clamped = clampPan(
        panStartX + (t.clientX - dragStartX),
        panStartY + (t.clientY - dragStartY),
      )
      panX.value = clamped.x
      panY.value = clamped.y
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    isDragging.value = false
    const touch = e.changedTouches[0]
    if (!touch) return
    if (!touchMoved) {
      const now = Date.now()
      if (
        now - lastTapTime < 300 &&
        Math.abs(touch.clientX - lastTapX) < 30 &&
        Math.abs(touch.clientY - lastTapY) < 30
      ) {
        if (isZoomed.value) resetZoom()
        else zoomLevel.value = DOUBLE_CLICK_ZOOM
        lastTapTime = 0
        return
      }
      lastTapTime = now
      lastTapX = touch.clientX
      lastTapY = touch.clientY
    }
    if (!isZoomed.value && e.changedTouches.length === 1) {
      const deltaX = touch.clientX - touchStartX.value
      const deltaY = touch.clientY - touchStartY.value
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) options.next()
        else options.prev()
      }
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('mousemove', handleMouseMove)
    })

    onUnmounted(() => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    })
  }

  return {
    zoomLevel,
    isZoomed,
    isSelectZoomMode,
    isSelectingArea,
    isDragging,
    selectionRect,
    imageContainerRef,
    imageTransform,
    MAX_ZOOM,
    resetZoom,
    zoomIn,
    zoomOut,
    cancelSelectZoomMode,
    toggleSelectZoomMode,
    handleWheelZoom,
    handleMouseDown,
    handleDblClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
