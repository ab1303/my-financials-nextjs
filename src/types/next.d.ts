// next.d.ts

import type {
  NextComponentType,
  NextPageContext,
} from 'next';
import type { AppProps } from 'next/app';

declare module 'next' {
  type NextLayoutComponentType<P = Record<string, unknown>> = NextComponentType<
    NextPageContext,
    unknown,
    P
  > & {
    getLayout?: (page: ReactNode) => ReactNode;
  };
}

declare module 'next/app' {
  type AppLayoutProps<P = Record<string, unknown>> = AppProps & {
    Component: NextLayoutComponentType<P>;
  };
}
