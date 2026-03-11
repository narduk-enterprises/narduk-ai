export default defineEventHandler(async (event) => {
  return await getQuickModifiersByCategory(event)
})
