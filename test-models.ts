import { grokListModels } from './apps/web/server/utils/grok.ts'

async function main() {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY
  const models = await grokListModels(apiKey)
  console.log(models.map((m) => m.id))
}
main()
