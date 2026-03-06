---
name: vercel-composition-patterns
description:
  React composition patterns that scale. Use when refactoring components with
  boolean prop proliferation, building flexible component libraries, or
  designing reusable APIs.
license: MIT
metadata:
  author: vercel
  version: '1.0.0'
---

# React Composition Patterns

Composition patterns for building flexible, maintainable React components. Optimized for AI agents and LLMs.

## 1. Basic Composition

### 1.1 Children Prop Pattern
The most fundamental pattern. Use the `children` prop to allow components to wrap arbitrary content instead of hardcoding items as props.

### 1.2 Slot Pattern
Use named props to pass components into specific "slots" within a layout (e.g., `header`, `sidebar`, `footer`).

### 1.3 Component Injection
Pass component types as props (`ItemComponent={MyItem}`) to allow callers to decide which component to render.

---

## 2. Server/Client Composition

### 2.1 Passing Server Components as Props (CRITICAL)
You cannot import a Server Component into a Client Component. Instead, pass the Server Component as a prop (usually `children`) from a parent Server Component.

### 2.2 Client-Only Wrappers
Wrap client-only libraries or browser-specific code in a component that only renders on the client (using `useEffect` and a `mounted` state).

### 2.3 Shared Layouts with Server Components
Use Server Components in layouts to fetch data once and share it across multiple pages.

---

## 3. Advanced Patterns

### 3.1 Compound Components (HIGH)
Multiple components work together to form a single unit, sharing state implicitly via context (e.g., `Tabs`, `Tabs.List`, `Tabs.Trigger`).

### 3.2 Render Props
A pattern where a component's prop is a function that returns a React element. Mostly replaced by Hooks, but still useful for specific use cases.

---

## 4. Performance Patterns

### 4.1 Moving State Down (HIGH)
If only a small part of a component tree needs state, move that state down into a smaller component to minimize re-renders of the larger tree.

### 4.2 Passing Components as Props to Avoid Re-renders
If a component contains expensive static content, pass that content as a prop to avoid re-rendering it when the parent's state changes.

---

## 5. Next.js Specific Patterns

### 5.1 Parallel Routes
Allows simultaneous rendering of multiple pages (e.g., dashboard and modal) in the same layout.

### 5.2 Intercepting Routes
Allows showing a route (e.g., a photo detail) in a modal while keeping the background context.
