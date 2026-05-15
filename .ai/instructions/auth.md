# Authentication & Authorization

- **Library**: Use Auth.js (Next Auth v5) for authentication and session management.
- **Config**: Defined in `src/server/auth.ts`, exporting `auth`, `handlers`, `signIn`, and `signOut`.
- **Security**:
  - Store sensitive keys (e.g., `AUTH_SECRET`) in `.env`.
  - Protect API routes and pages via the `auth()` function.
- **Strategy**: Use JWT session strategy for stateless authentication.
- **Providers**: Use secure providers (OAuth, JWT, Credentials).
- **Server Components**: Use `auth()` — never `useSession()`.
- **Client Components**: Use `useSession()` from `next-auth/react`.
- **Never pass `userId` from client to server** — rely on server-side session.
