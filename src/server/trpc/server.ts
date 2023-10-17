// haven't found a use of this file; may be can be discarded
// Also have a look at file server-http

import { appRouter } from './router/_app';
import { createContext } from './context';

export const server = appRouter.createCaller(await createContext());
