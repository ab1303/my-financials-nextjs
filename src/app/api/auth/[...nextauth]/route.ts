import NextAuth from 'next-auth';
import { authOptions } from '@/utils/authOptions';

// import DiscordProvider from "next-auth/providers/discord";
// import { env } from "../../../env/server.mjs";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
