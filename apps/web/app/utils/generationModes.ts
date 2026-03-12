import type { Generation } from '~/types/generation'

export interface GenerationModeOption {
  value: Generation['mode']
  label: string
  icon: string
  description: string
  inputLabel: 'Text' | 'Image'
  outputLabel: 'Image' | 'Video'
}

export const GENERATION_MODES: GenerationModeOption[] = [
  {
    value: 't2i',
    label: 'Create Image',
    icon: 'i-lucide-image',
    description: 'Start with a text prompt and generate a new image.',
    inputLabel: 'Text',
    outputLabel: 'Image',
  },
  {
    value: 't2v',
    label: 'Create Video',
    icon: 'i-lucide-video',
    description: 'Start with a text prompt and generate a new video.',
    inputLabel: 'Text',
    outputLabel: 'Video',
  },
  {
    value: 'i2v',
    label: 'Animate Image',
    icon: 'i-lucide-wand-2',
    description: 'Start with an image and turn it into a video.',
    inputLabel: 'Image',
    outputLabel: 'Video',
  },
  {
    value: 'i2i',
    label: 'Edit Image',
    icon: 'i-lucide-layers',
    description: 'Start with an image and create a new edited image.',
    inputLabel: 'Image',
    outputLabel: 'Image',
  },
]

export const GENERATION_MODE_LABELS = Object.fromEntries(
  GENERATION_MODES.map((mode) => [mode.value, mode.label]),
) as Record<Generation['mode'], string>
