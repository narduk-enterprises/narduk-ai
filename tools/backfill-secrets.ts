/**
 * Backfill Secrets (`CRON_SECRET`, `NUXT_SESSION_PASSWORD`) for all fleet projects.
 * Run from the template repo with Doppler access to fleet projects
 * (e.g. FLEET_DOPPLER_TOKEN or doppler run --project narduk-ai).
 *
 * Usage:
 *   npx tsx tools/backfill-secrets.ts [--projects=app1,app2] [--dry-run] [--force]
 *
 * Fleet membership is auto-discovered via the control-plane D1 registry (requires
 * CONTROL_PLANE_API_KEY in Doppler). You can also override the list:
 *   --projects=<comma-separated list>   (CLI flag)
 *   FLEET_PROJECTS=<comma-separated>    (environment variable)
 *
 * --dry-run: print what would be set, do not call Doppler.
 * --force: set secrets even if already present (rotates them).
 */

import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

if (process.env.FLEET_DOPPLER_TOKEN) {
  process.env.DOPPLER_TOKEN = process.env.FLEET_DOPPLER_TOKEN
}

const cliArgs = process.argv.slice(2)
const projectsArg = cliArgs.find((a) => a.startsWith('--projects='))?.slice('--projects='.length)

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────────────────────
// Fleet auto-discovery from control-plane API
// ──────────────────────────────────────────────────────────────
interface FleetApp {
  name: string
  dopplerProject: string
  url: string
}

async function discoverFleetProjects(): Promise<string[]> {
  const apiKey = process.env.CONTROL_PLANE_API_KEY
  if (!apiKey) {
    try {
      const raw = execSync(
        'doppler secrets get CONTROL_PLANE_API_KEY --project narduk-ai --config prd --plain',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim()
      if (raw && raw.startsWith('nk_')) {
        process.env.CONTROL_PLANE_API_KEY = raw
        return discoverFleetProjects()
      }
    } catch {
      /* not available */
    }
    return []
  }

  const baseUrl = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
  try {
    const res = await fetch(`${baseUrl}/api/fleet/apps`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      console.error(
        `⚠️  Control plane API returned ${res.status}. Falling back to manual project list.`,
      )
      return []
    }
    const apps = (await res.json()) as FleetApp[]
    return apps.map((a) => a.dopplerProject).filter(Boolean)
  } catch (e: any) {
    console.error(
      `⚠️  Failed to reach control plane: ${e.message}. Falling back to manual project list.`,
    )
    return []
  }
}

function hasSecret(project: string, config: string, key: string): boolean {
  try {
    execSync(`doppler secrets get ${key} --project "${project}" --config ${config} --plain`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

function setSecret(project: string, config: string, key: string, value: string): void {
  const safe = value.replace(/'/g, "'\"'\"'")
  execSync(`doppler secrets set ${key}='${safe}' --project "${project}" --config ${config}`, {
    stdio: 'pipe',
  })
}

async function main() {
  const dryRun = cliArgs.includes('--dry-run')
  const force = cliArgs.includes('--force')

  if (!isDopplerAvailable()) {
    console.error('❌ Doppler CLI not available. Install and log in, or set FLEET_DOPPLER_TOKEN.')
    process.exit(1)
  }

  let FLEET_PROJECTS: string[] = (projectsArg ?? process.env.FLEET_PROJECTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (FLEET_PROJECTS.length === 0) {
    console.log('🔍 No --projects specified. Discovering fleet apps from control-plane API...')
    FLEET_PROJECTS = await discoverFleetProjects()

    if (FLEET_PROJECTS.length > 0) {
      console.log(`   Found ${FLEET_PROJECTS.length} fleet app(s).\n`)
    } else {
      console.error('❌ No fleet projects discovered.')
      console.error('  Provide --projects=app1,app2, set FLEET_PROJECTS=app1,app2,')
      console.error('  or set CONTROL_PLANE_API_KEY (nk_...) for auto-discovery.')
      process.exit(1)
    }
  }

  const SECRETS_TO_BACKFILL = ['CRON_SECRET', 'NUXT_SESSION_PASSWORD']

  console.log('')
  console.log(`Backfill Secrets (${SECRETS_TO_BACKFILL.join(', ')}) for fleet projects`)
  console.log('══════════════════════════════════════════════════════════════')
  if (dryRun) console.log('  (dry run — no changes)')
  if (force) console.log('  (force — overwrite existing)')
  console.log('')

  let setCount = 0
  let skipCount = 0
  let failCount = 0

  for (const project of FLEET_PROJECTS) {
    for (const secretKey of SECRETS_TO_BACKFILL) {
      const hasPrd = hasSecret(project, 'prd', secretKey)
      const hasDev = hasSecret(project, 'dev', secretKey)

      if (!force && hasPrd && hasDev) {
        console.log(`  ⏭ ${project.padEnd(28)} already has ${secretKey}`)
        skipCount++
        continue
      }

      const generatedValue = crypto.randomBytes(32).toString('hex')

      if (dryRun) {
        console.log(`  [dry] ${project.padEnd(28)} would set ${secretKey} (prd + dev)`)
        setCount++
        continue
      }

      try {
        if (!hasPrd || force) setSecret(project, 'prd', secretKey, generatedValue)
        if (!hasDev || force) setSecret(project, 'dev', secretKey, generatedValue)
        console.log(`  ✅ ${project.padEnd(28)} ${secretKey} set (prd + dev)`)
        setCount++
      } catch (err: any) {
        console.log(`  ❌ ${project.padEnd(28)} ${err.message?.trim() || err}`)
        failCount++
      }
    }
  }

  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Set: ${setCount}  Skipped: ${skipCount}  Failed: ${failCount}`)
  console.log('')
  if (failCount > 0) process.exit(1)
}

main()
