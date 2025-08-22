# My Financials built on "Create T3 App"

This is an app bootstrapped according to the [init.tips](https://init.tips) stack, also known as the T3-Stack.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with the most basic configuration and then move on to more advanced configuration.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next-Auth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [TailwindCSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

We also [roll our own docs](https://beta.create.t3.gg) with some summary information and links to the respective documentation.

## Overall TechStack

- Next.js for the React-based frontend and routing (next)
- TypeScript for type safety (typescript)
- tRPC for typesafe APIs (@trpc/server, @trpc/client, @trpc/react-query)
- Prisma for ORM and database management (prisma, @prisma/client)
- NextAuth.js for authentication (next-auth)
- Tailwind CSS for styling (tailwindcss)
- React Query for data fetching and caching (@tanstack/react-query)
- Immer for immutable state management (immer)
- React Toastify for notifications (react-toastify)
- React Select for select inputs (react-select)
- React Icons for iconography (react-icons)

## Versions

`Node: 20.18.1 `

## Docker Compose

- Start Docker service
  `docker-compose up -d`

## Migration to NextJS 13

```
    pnpm up next react react-dom eslint-config-next --latest
    pnpm upgrade eslint-config-next@latest

    pnpm i -D @next/codemod@latest
    pnpm add -D @babel/preset-env@^7.1.6

    npx @next/codemod new-link ./src/pages/ --dry

    npx @next/codemod next-image-to-legacy-image ./src --print

    npx @next/codemod next-image-experimental ./src --print
```
