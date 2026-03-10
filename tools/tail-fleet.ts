#!/usr/bin/env npx tsx
/**
 * tail-fleet.ts — Interactive log streaming for fleet apps
 *
 * Discovers fleet apps and provides an interactive menu to stream
 * their real-time logs using `wrangler tail`.
 *
 * Usage:
 *   npx tsx tools/tail-fleet.ts          # interactive mode
 *   npx tsx tools/tail-fleet.ts my-app   # direct mode
 */

import { execSync, spawn } from 'node:child_process'
import * as readline from 'node:readline'

// ──────────────────────────────────────────────────────────────
// App Discovery
// ──────────────────────────────────────────────────────────────

interface FleetApp {
  name: string
  dopplerProject: string
  url: string
}

async function discoverFleetProjects(): Promise<string[]> {
  const apiKey = process.env.CONTROL_PLANE_API_KEY
  if (!apiKey) {
    // Try to get it from Doppler
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
      console.error(`⚠️  Control plane API returned ${res.status}.`)
      return []
    }
    const apps = (await res.json()) as FleetApp[]
    return apps
      .map((a) => a.dopplerProject)
      .filter(Boolean)
      .sort()
  } catch (e: any) {
    console.error(`⚠️  Failed to reach control plane: ${e.message}.`)
    return []
  }
}

// ──────────────────────────────────────────────────────────────
// Interaction
// ──────────────────────────────────────────────────────────────

function promptUser(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans)
    }),
  )
}

async function selectApp(apps: string[]): Promise<string | null> {
  console.log('\n📡 Available Fleet Applications:\n')

  apps.forEach((app, idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2, ' ')}. ${app}`)
  })

  console.log('')

  while (true) {
    const answer = await promptUser(
      'Enter app number, or type full name (or press enter to cancel): ',
    )

    if (!answer.trim()) {
      return null
    }

    // Check if they typed a number
    const num = parseInt(answer.trim(), 10)
    if (!isNaN(num) && num > 0 && num <= apps.length) {
      return apps[num - 1]
    }

    // Check if they typed an exact name
    if (apps.includes(answer.trim())) {
      return answer.trim()
    }

    // Check if they typed a partial match uniquely
    const matches = apps.filter((a) => a.includes(answer.trim()))
    if (matches.length === 1) {
      return matches[0]
    }

    console.log('❌ Invalid selection. Please try again.')
  }
}

// ──────────────────────────────────────────────────────────────
// Execution
// ──────────────────────────────────────────────────────────────

function tailApp(appName: string) {
  console.log(`\n🚀 Starting log tailing for: \x1b[36m${appName}\x1b[0m`)
  console.log(`Press Ctrl+C to stop.\n`)

  const child = spawn('wrangler', ['tail', appName, '--format=pretty'], {
    stdio: 'inherit',
  })

  child.on('error', (err) => {
    console.error(`❌ Failed to start wrangler: ${err.message}`)
  })

  // Process exits naturally when child is killed by user (Ctrl+C)
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  let targetApp = args[0]

  if (targetApp) {
    tailApp(targetApp)
    return
  }

  console.log('🔍 Discovering fleet apps from control-plane API...')
  const apps = await discoverFleetProjects()

  if (apps.length === 0) {
    console.error('❌ No fleet apps found or could not connect to control plane.')
    console.error('  You can still run this explicitly: pnpm run tail:fleet <app-name>')
    process.exit(1)
  }

  const selected = await selectApp(apps)

  if (selected) {
    tailApp(selected)
  } else {
    console.log('Cancelled.')
  }
}

main().catch((e) => {
  console.error(`Fatal error: ${e.message}`)
  process.exit(1)
})
