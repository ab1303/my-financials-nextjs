# Middleware / Proxy And Edge Runtime

- In Next.js 16+, `middleware.ts` is renamed to `proxy.ts`. Use `proxy.ts` for route interception, authentication, redirects, and rewrites.
- The proxy runtime is `nodejs` by default. If you need the Edge Runtime, keep using `middleware.ts` until full edge support is available in proxy.
- Handle cookies, headers, and dynamic rewrites in `proxy.ts`
- Be mindful of constraints when running at the edge
- Configuration flags are also renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`
