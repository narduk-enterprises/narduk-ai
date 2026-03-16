---
description:
  Comprehensive audit of Component, Composable, and Pinia Store usage patterns —
  checks 'Thin Store' implementation, Dumb vs Smart component boundaries,
  Mutation Centralization, and Nuxt 4 state safety.
---

# State Management Architecture Audit

This workflow audits a Nuxt 4 codebase for correct separation of concerns
between Vue Components, generic Nuxt Composables, and Pinia Stores.

It checks against institutional standards such as "Thin Store" decomposition,
Mutation Centralization, proper hydration/SSR safety, and LOC thresholds.

// turbo-all

---

## 1. File Size Audit

Identify files exceeding thresholds that indicate anti-patterns:

```bash
echo "=== COMPOSABLES >300L ===" && wc -l app/composables/*.ts 2>/dev/null | sort -rn | awk '$1 > 300 {print}' | head -10
echo "=== PAGES >500L ===" && find app/pages -name '*.vue' | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 500 {print}' | head -10
echo "=== COMPONENTS >300L ===" && wc -l app/components/*.vue 2>/dev/null | sort -rn | awk '$1 > 300 {print}' | head -10
```

**Action**: Files over threshold are candidates for extraction into
sub-composables, child components, or utility modules.

---

## 2. Store Layer (Pinia)

```bash
echo "=== STORES ===" && ls app/stores/ 2>/dev/null || echo "No stores directory"
echo "=== $patch IN COMPONENTS ===" && grep -rn '\$patch' app/components/ 2>/dev/null | head -10 || echo "Clean"
echo "=== DIRECT STORE WRITES IN COMPONENTS ===" && grep -rn '\.value\s*=' app/components/ 2>/dev/null | grep 'store' | head -10 || echo "Clean"
```

- Stores should be modularized by domain, not monolithic.
- Components call store _Actions_ to mutate. No `$patch` or raw reassignment in
  `.vue` files.
- If NO stores exist, check if composables are filling the role correctly.

---

## 3. Composable Layer

```bash
echo "=== MODULE-SCOPED REFS (SSR LEAK RISK) ===" && grep -rn "^const .* = ref\b\|^const .* = reactive\b\|^let .* = ref\b" app/composables/ 2>/dev/null | head -20 || echo "Clean"
echo "=== RAW $fetch IN COMPOSABLES (should use useAppFetch for stores) ===" && grep -rn '\$fetch' app/composables/ 2>/dev/null | grep -v '//' | grep -v 'useAppFetch' | head -20
echo "=== useState USAGE ===" && grep -rn 'useState(' app/composables/ app/pages/ app/components/ 2>/dev/null | head -15
```

- **Antipattern**: `ref()` at module scope in composables → SSR cross-request
  leak.
- **Exception**: `useState()` from Nuxt is safe for SSR-friendly global state.
- Raw `$fetch` in composables is acceptable when used inside
  `useAsyncData`/`useFetch` callbacks, or when the composable is client-only.
  Flag any that should use `useAppFetch`.

---

## 4. Component Layer

```bash
echo "=== HIGH REF COUNT COMPONENTS ===" && for f in $(find app/components app/pages -name '*.vue' 2>/dev/null); do count=$(grep -c 'const .* = ref(' "$f" 2>/dev/null); if [ "$count" -gt 5 ]; then echo "$count refs: $f"; fi; done | sort -rn
echo "=== $fetch IN COMPONENTS ===" && grep -rn '\$fetch' app/components/ 2>/dev/null | head -10 || echo "Clean"
echo "=== INLINE FETCH IN PAGES ===" && grep -rn 'await \$fetch\|await fetch(' app/pages/ 2>/dev/null | head -10 || echo "Clean"
```

- Components with >5 refs likely need extraction into composables.
- Components should NEVER use `$fetch` directly. Use composables or `useFetch`.
- Pages may use `useAsyncData`/`useFetch` but not raw `$fetch` in setup.

---

## 5. Hydration & Async Safety

```bash
echo "=== NAKED $fetch IN PAGES (should use useFetch/useAsyncData) ===" && grep -rn 'await \$fetch' app/pages/ 2>/dev/null | head -10 || echo "Clean"
echo "=== onMounted WITH STATE INIT ===" && grep -A3 'onMounted' app/pages/ app/components/ 2>/dev/null | grep -B1 'ref\|reactive\|\.value' | head -10 || echo "Clean"
echo "=== WINDOW/DOCUMENT OUTSIDE CLIENT GUARD ===" && grep -rn 'window\.\|document\.' app/composables/ app/pages/ app/components/ 2>/dev/null | grep -v 'import.meta.client\|onMounted\|ClientOnly\|// eslint' | head -10 || echo "Clean"
```

- `$fetch` in page setup → double-fetch during hydration. Use `useFetch`.
- `window`/`document` must be guarded by `import.meta.client` or `onMounted`.

---

## 6. Duplication Detection

```bash
echo "=== DUPLICATE UTILITY FUNCTIONS ===" && grep -rn 'function parse\|function format\|function validate\|function create' app/composables/ app/utils/ app/pages/ 2>/dev/null | awk -F: '{print $3}' | sort | uniq -c | sort -rn | awk '$1 > 1' | head -10
echo "=== COMPONENTS IMPORTED >3 TIMES ===" && for comp in $(grep -roh "import .* from '~/components/[^']*'" app/ 2>/dev/null | awk -F"'" '{print $2}' | sort | uniq -c | sort -rn | awk '$1 > 3 {print $2}'); do echo "$comp"; done | head -5
```

Check for duplicated utility logic across files that should be extracted into a
shared `utils/` module.

---

## 7. Compile Findings

Synthesize findings into a table:

| Domain          | Standard                                       | Finding |
| --------------- | ---------------------------------------------- | ------- |
| **Stores**      | Thin, domain-focused, mutation via actions     |         |
| **Composables** | Pure functions, SSR-safe, no module-scope refs |         |
| **Components**  | Smart/Dumb boundary, minimal local state       |         |
| **Pages**       | Data via useFetch/useAsyncData, no raw $fetch  |         |
| **Hydration**   | No double-fetch, client guards for window/doc  |         |
| **Duplication** | Single source of truth for shared utilities    |         |

Present findings and proposed fixes. **Implement fixes without creating new
anti-patterns.**
