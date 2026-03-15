import { describe, expect, it } from 'vitest'
import {
  personToProse,
  sceneToProse,
  framingToProse,
  actionToProse,
  styleToProse,
  presetToProse,
  budgetAttributes,
} from '../../app/utils/presetProseTemplates'

describe('presetProseTemplates', () => {
  describe('personToProse', () => {
    it('converts full person attributes to natural prose', () => {
      const result = personToProse({
        name: 'Emma Foster',
        age: '28',
        gender: 'woman',
        ethnicity: 'Caucasian',
        hair_color: 'auburn',
        hair_style: 'wavy',
        eye_color: 'hazel',
        skin_tone: 'fair with freckles',
        clothing: 'a casual tee and jeans',
        expression: 'relaxed',
      })

      expect(result).toContain('28-year-old')
      expect(result).toContain('Caucasian')
      expect(result).toContain('woman')
      expect(result).toContain('auburn wavy hair')
      expect(result).toContain('hazel eyes')
      expect(result).toContain('fair with freckles skin')
      expect(result).toContain('wearing a casual tee and jeans')
      expect(result).toContain('relaxed expression')
      // Metadata keys should be excluded
      expect(result).not.toContain('Emma Foster')
    })

    it('excludes metadata keys (name, description, extended_detail, other)', () => {
      const result = personToProse({
        name: 'Emma',
        description: 'A beautiful person',
        extended_detail: 'Long backstory...',
        other: 'Extra notes',
        hair_color: 'blonde',
      })

      expect(result).not.toContain('Emma')
      expect(result).not.toContain('beautiful')
      expect(result).not.toContain('backstory')
      expect(result).not.toContain('Extra')
      expect(result).toContain('blonde hair')
    })

    it('handles partial attributes gracefully', () => {
      const result = personToProse({ hair_color: 'red' })
      expect(result).toContain('red hair')
    })

    it('returns empty string for empty attributes', () => {
      expect(personToProse({})).toBe('')
    })

    it('filters out None values', () => {
      const result = personToProse({
        hair_color: 'auburn',
        tattoos_piercings: 'None',
      })
      expect(result).toContain('auburn')
      expect(result).not.toContain('None')
    })

    it('handles hair_style without hair_color', () => {
      const result = personToProse({ hair_style: 'curly' })
      expect(result).toContain('curly hair')
    })
  })

  describe('sceneToProse', () => {
    it('converts scene attributes to natural prose', () => {
      const result = sceneToProse({
        name: 'Urban Rooftop',
        setting: 'an urban rooftop bar',
        time_of_day: 'golden hour',
        lighting: 'warm ambient',
        atmosphere: 'moody',
        weather: 'clear',
      })

      expect(result).toContain('in an urban rooftop bar')
      expect(result).toContain('at golden hour')
      expect(result).toContain('warm ambient lighting')
      expect(result).toContain('moody atmosphere')
      expect(result).toContain('clear weather')
      expect(result).not.toContain('Urban Rooftop')
    })

    it('returns empty string for empty attributes', () => {
      expect(sceneToProse({})).toBe('')
    })
  })

  describe('framingToProse', () => {
    it('converts framing attributes to prose', () => {
      const result = framingToProse({
        shot_type: 'medium close-up',
        lens: '85mm portrait lens',
        depth_of_field: 'shallow',
      })

      expect(result).toContain('medium close-up')
      expect(result).toContain('shot on 85mm portrait lens')
      expect(result).toContain('shallow depth of field')
    })

    it('combines lens and focal_length', () => {
      const result = framingToProse({
        lens: 'prime lens',
        focal_length: '50mm',
      })
      expect(result).toContain('shot on prime lens 50mm')
    })
  })

  describe('actionToProse', () => {
    it('converts action attributes to prose', () => {
      const result = actionToProse({
        primary_action: 'sitting cross-legged',
        hand_placement: 'resting on knees',
        facial_expression: 'serene',
      })

      expect(result).toContain('sitting cross-legged')
      expect(result).toContain('hands resting on knees')
      expect(result).toContain('serene expression')
    })
  })

  describe('styleToProse', () => {
    it('converts style attributes to prose', () => {
      const result = styleToProse({
        art_medium: 'photography',
        color_palette: 'warm tones',
        mood: 'nostalgic',
      })

      expect(result).toContain('photography')
      expect(result).toContain('warm tones color palette')
      expect(result).toContain('nostalgic mood')
    })
  })

  describe('presetToProse dispatcher', () => {
    it('routes to the correct function by type', () => {
      expect(presetToProse('person', { hair_color: 'blonde' })).toContain('blonde hair')
      expect(presetToProse('scene', { setting: 'a beach' })).toContain('in a beach')
      expect(presetToProse('framing', { shot_type: 'wide shot' })).toContain('wide shot')
      expect(presetToProse('action', { primary_action: 'running' })).toContain('running')
      expect(presetToProse('style', { art_medium: 'oil painting' })).toContain('oil painting')
    })

    it('returns empty string for unknown types', () => {
      expect(presetToProse('unknown', { foo: 'bar' })).toBe('')
    })
  })

  describe('budgetAttributes', () => {
    it('returns attributes unchanged when under budget', () => {
      const attrs = { hair_color: 'blonde', age: '25' }
      const result = budgetAttributes(attrs, 100, 800)
      expect(result).toEqual(attrs)
    })

    it('drops low-priority keys when over budget', () => {
      const attrs = {
        hair_color: 'blonde',
        age: '25',
        vegetation: 'lush palm trees',
        ground_surface: 'cobblestone',
        tattoos_piercings: 'sleeve tattoo',
      }
      const result = budgetAttributes(attrs, 900, 800)
      expect(result.hair_color).toBe('blonde')
      expect(result.age).toBe('25')
      expect(result.vegetation).toBeUndefined()
      expect(result.ground_surface).toBeUndefined()
      expect(result.tattoos_piercings).toBeUndefined()
    })
  })
})
