# Middleware & Icons

## Middleware (Next.js 16+)
- **Renaming**: Note that `middleware.ts` is renamed to `proxy.ts`.
- **Functionality**: Use `proxy.ts` for route interception, authentication, redirects, and rewrites.
- **Runtime**: `nodejs` by default. Use `middleware.ts` only if Edge Runtime is explicitly required.
- **Config**: Use `skipProxyUrlNormalize` instead of `skipMiddlewareUrlNormalize`.

## Iconography
- **Library**: Use `react-icons` for all icons (prefer HeroIcons or Feather).
- **Reuse**: Create icon components in `src/components/icons` for consistency.
- **Documentation**: Document icon usage within component files.
