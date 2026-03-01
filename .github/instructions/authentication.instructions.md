# Authentication

- Use Auth.js (Next Auth v5) for authentication and session management.
- Auth configuration is defined in `src/server/auth.ts` which exports `auth`, `handlers`, `signIn`, and `signOut`.
- Store sensitive keys/secrets in environment variables (`AUTH_SECRET` for the session secret).
- Protect API routes and pages based on user session via `auth()` function.
- Use secure providers (OAuth, JWT, Credentials, etc.).
- Session strategy uses JWT for stateless authentication.
