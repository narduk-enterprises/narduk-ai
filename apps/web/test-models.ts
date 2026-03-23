import { xaiImagineListModels } from './server/utils/grok.js'

async function main() {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    console.error('No API key')
    process.exit(1)
  }
  const models = await xaiImagineListModels(apiKey)
  console.log(models.map((m) => m.id).filter((id) => id.includes('vision')))
}
main()
