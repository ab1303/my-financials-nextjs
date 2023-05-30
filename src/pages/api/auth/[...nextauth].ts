import { authOptions } from '@/utils/authOptions';
import NextAuth from 'next-auth';

// import DiscordProvider from "next-auth/providers/discord";
// import { env } from "../../../env/server.mjs";

export default NextAuth(authOptions);
