import type { Ref } from 'vue'

export function useGalleryVideo(options: { videoRef: Ref<HTMLVideoElement | null> }) {
  const isPlaying = ref(false)
  const isMuted = ref(true)
  const currentTime = ref(0)
  const videoDuration = ref(0)
  const progressPercent = computed(() =>
    videoDuration.value > 0 ? (currentTime.value / videoDuration.value) * 100 : 0,
  )
  const showControls = ref(true)
  let controlsTimer: ReturnType<typeof setTimeout> | null = null

  function togglePlay() {
    if (!options.videoRef.value) return
    if (options.videoRef.value.paused) {
      options.videoRef.value.play()
      isPlaying.value = true
    } else {
      options.videoRef.value.pause()
      isPlaying.value = false
    }
  }

  function toggleMute() {
    if (!options.videoRef.value) return
    options.videoRef.value.muted = !options.videoRef.value.muted
    isMuted.value = options.videoRef.value.muted
  }

  function handleTimeUpdate() {
    if (!options.videoRef.value) return
    currentTime.value = options.videoRef.value.currentTime
  }

  function handleLoadedMetadata() {
    if (!options.videoRef.value) return
    videoDuration.value = options.videoRef.value.duration
  }

  function seekTo(e: MouseEvent) {
    if (!options.videoRef.value) return
    const bar = e.currentTarget as HTMLElement
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    options.videoRef.value.currentTime = ratio * videoDuration.value
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function scheduleHideControls() {
    showControls.value = true
    if (controlsTimer) clearTimeout(controlsTimer)
    controlsTimer = setTimeout(() => {
      if (isPlaying.value) showControls.value = false
    }, 3000)
  }

  function handleVideoClick() {
    togglePlay()
    scheduleHideControls()
  }

  function handleMouseMoveOnVideo() {
    scheduleHideControls()
  }

  function resetVideoState() {
    isPlaying.value = false
    currentTime.value = 0
    videoDuration.value = 0
    showControls.value = true
    if (controlsTimer) clearTimeout(controlsTimer)
  }

  function playVideo() {
    if (!options.videoRef.value) return
    options.videoRef.value
      .play()
      .then(() => {
        isPlaying.value = true
        scheduleHideControls()
        return
      })
      .catch(() => {
        // autoplay blocked
      })
  }

  onUnmounted(() => {
    if (controlsTimer) clearTimeout(controlsTimer)
  })

  return {
    isPlaying,
    isMuted,
    currentTime,
    videoDuration,
    progressPercent,
    showControls,
    togglePlay,
    toggleMute,
    handleTimeUpdate,
    handleLoadedMetadata,
    seekTo,
    formatTime,
    handleVideoClick,
    handleMouseMoveOnVideo,
    scheduleHideControls,
    resetVideoState,
    playVideo,
  }
}
