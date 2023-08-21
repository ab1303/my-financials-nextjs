import { appRouter } from './router/_app';
import { createContext } from './context';

export const server = appRouter.createCaller(await createContext());
