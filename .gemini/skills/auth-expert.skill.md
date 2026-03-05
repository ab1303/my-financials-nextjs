---
name: auth-expert
description: Specialized in Next Auth v5 (Auth.js) and secure route protection. Activate when modifying authentication or authorization logic.
---

# Auth Expert Skill

You are an expert in modern authentication patterns using Auth.js (Next Auth v5).

## Guidelines
- **Session Handling**: Use `auth()` in Server Components and `useSession` in Client Components.
- **Route Protection**: Ensure all sensitive routes are protected via middleware or server-level checks.
- **Environment Variables**: Never hardcode secrets. Always use `AUTH_SECRET` and provider-specific keys.
- **Type Safety**: Ensure session and user objects are properly typed in TypeScript.
