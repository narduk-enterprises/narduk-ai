import { eq } from 'drizzle-orm'
import { promptElements } from '#server/database/schema'
import { xaiImagineChat } from '#server/utils/grok'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig(event)
  const apiKey = config.xaiApiKey
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'Missing xAI API Key' })
  }

  const db = useDatabase(event)

  // Get all person elements
  const items = await db.select().from(promptElements).where(eq(promptElements.type, 'person'))

  let updatedCount = 0
  const errors = []

  for (const item of items) {
    try {
      const systemPrompt = `You are a creative writer for character generation. Below is a list of physical attributes for a character. Read their attributes and generate a vivid description of their breasts based on their other physical attributes, age, vibe, body type, and clothing. It should be 1 short, evocative sentence describing their shape, size, and cleavage (if applicable). Make it vivid, attractive, and fitting to the character's overall design. Do not return anything except the description string. Do not use quotes.`

      const userPrompt = `Character details:
${item.content}

Generate the 'breasts' description.`

      const breastsDesc = await xaiImagineChat(apiKey, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      if (!breastsDesc) {
        errors.push(`Grok returned empty for ${item.id}`)
        continue
      }

      let newContent = item.content
      if (!newContent.toLowerCase().includes('breasts:')) {
        newContent = `${newContent.trim()}\nBreasts: ${breastsDesc}`
      } else {
        // Already has breasts, skip
        continue
      }

      let newChatHistory = item.chatHistory
      if (newChatHistory) {
        try {
          const chatLog = JSON.parse(newChatHistory)
          for (const msg of chatLog) {
            if (msg.role === 'assistant' && typeof msg.content === 'string') {
              try {
                const parsed = JSON.parse(msg.content)
                if (parsed.builder_state && typeof parsed.builder_state === 'object') {
                  parsed.builder_state.breasts = breastsDesc
                  msg.content = JSON.stringify(parsed)
                }
              } catch {
                // ignore
              }
            }
          }
          newChatHistory = JSON.stringify(chatLog)
        } catch {
          // ignore
        }
      }

      await db
        .update(promptElements)
        .set({
          content: newContent,
          chatHistory: newChatHistory,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(promptElements.id, item.id))

      updatedCount++
      console.log(`Updated ${item.id} with: ${breastsDesc}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`Error on ${item.id}: ${msg}`)
    }
  }

  return {
    success: true,
    total: items.length,
    updated: updatedCount,
    errors,
  }
})
