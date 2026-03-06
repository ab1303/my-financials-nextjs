---
name: react-best-practices
description:
  Modern React best practices focusing on performance, maintainability, and
  idiomatic patterns. Covers hooks, state management, and component lifecycle.
license: MIT
metadata:
  author: vercel
  version: '1.0.0'
---

# React Best Practices

Guidelines for writing high-quality, performant, and maintainable React
applications. Optimized for AI agents and LLMs.

## Core Principles

1.  **Keep Components Small**: Each component should do one thing well.
2.  **Functional Components**: Use functional components and hooks over classes.
3.  **Immutable State**: Never mutate state directly; always use the provided
    setter functions.
4.  **Keys in Lists**: Always provide unique, stable keys for list items.
5.  **Performance Optimization**: Use `useMemo` and `useCallback` judiciously to
    prevent unnecessary re-renders.

---

## 1. Eliminating Waterfalls (CRITICAL)

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### 1.1 Defer Await Until Needed
Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

### 1.2 Dependency-Based Parallelization
For operations with partial dependencies, maximize parallelism. 
```typescript
// Config and profile run in parallel
const userPromise = fetchUser()
const profilePromise = userPromise.then(user => fetchProfile(user.id))
const [user, config, profile] = await Promise.all([userPromise, fetchConfig(), profilePromise])
```

### 1.3 Prevent Waterfall Chains in API Routes
In API routes and Server Actions, start independent operations immediately, even if you don't await them yet.

### 1.4 Promise.all() for Independent Operations
When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

### 1.5 Strategic Suspense Boundaries
Instead of awaiting data in async components before returning JSX, use Suspense boundaries to show the wrapper UI faster while data loads.

---

## 2. Bundle Size Optimization (CRITICAL)

### 2.1 Avoid Barrel File Imports
Import directly from source files instead of barrel files (index.js) to avoid loading thousands of unused modules.
```typescript
// ✅ Good
import Check from 'lucide-react/dist/esm/icons/check'
```

### 2.2 Conditional Module Loading
Load large data or modules only when a feature is activated using dynamic imports.

### 2.3 Defer Non-Critical Third-Party Libraries
Load analytics, logging, and error tracking after hydration using `next/dynamic` with `ssr: false`.

### 2.4 Dynamic Imports for Heavy Components
Use `next/dynamic` to lazy-load large components (like editors or maps) not needed on initial render.

---

## 3. Server-Side Performance (HIGH)

### 3.1 Authenticate Server Actions Like API Routes
Always verify authentication and authorization **inside** each Server Action.

### 3.2 Avoid Duplicate Serialization in RSC Props
RSC deduplicates by object reference. Do transformations (`.toSorted()`, `.filter()`) in client, not server, to keep payloads small.

### 3.3 Cross-Request LRU Caching
Use an LRU cache for data shared across sequential requests within the same function instance.

### 3.4 Hoist Static I/O to Module Level
Load static assets (fonts, logos, config) at the module level so they run once per instance, not per request.

### 3.5 Minimize Serialization at RSC Boundaries
Only pass fields that the client actually uses. Don't pass the whole database object if you only need the `name`.

### 3.6 Parallel Data Fetching with Component Composition
React Server Components execute sequentially. Use composition (passing components as children) to fetch data in parallel.

### 3.7 Per-Request Deduplication with React.cache()
Use `React.cache()` for deduplicating database queries or heavy computations within a single request.

---

## 4. Re-render Optimization (MEDIUM)

### 4.1 Calculate Derived State During Rendering
If a value can be computed from current props/state, derive it during render. Don't use `useEffect` to sync state.

### 4.2 Use Functional setState Updates
Always use `setCount(c => c + 1)` when the new state depends on the old one. This prevents stale closures and unstable callback references.

### 4.3 Use Lazy State Initialization
Pass a function to `useState` for expensive initial values: `useState(() => computeExpensiveValue())`.

---

## 5. Rendering Performance (MEDIUM)

### 5.1 CSS content-visibility for Long Lists
Apply `content-visibility: auto` to defer off-screen rendering of long list items.

### 5.2 Prevent Hydration Mismatch
For content depending on `localStorage`, use an inline script to update the DOM before React hydrates to prevent flickering.

### 5.3 Use Explicit Conditional Rendering
Use ternary `count > 0 ? <Badge /> : null` instead of `count && <Badge />` to avoid rendering `0`.
