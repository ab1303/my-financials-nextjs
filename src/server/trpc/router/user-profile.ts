import { TRPCError } from '@trpc/server';
import {
  changePasswordSchema,
  updateProfileSchema,
  uploadAvatarSchema,
} from '@/app/(authorized)/settings/profile/_schema';
import * as profileService from '@/server/services/user-profile/user-profile.service';
import { protectedProcedure, router } from '@/server/trpc/trpc';

export const userProfileRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return profileService.getProfile(ctx.prisma, ctx.session.user.id);
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return profileService.updateProfile(ctx.prisma, ctx.session.user.id, input);
    }),

  uploadAvatar: protectedProcedure
    .input(uploadAvatarSchema)
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');

      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File size must be under 5MB',
        });
      }

      return profileService.uploadAvatar(
        ctx.prisma,
        ctx.session.user.id,
        buffer,
        input.mimeType,
        input.fileName,
      );
    }),

  deleteAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    await profileService.deleteAvatar(ctx.prisma, ctx.session.user.id);
    return { success: true };
  }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      await profileService.changePassword(
        ctx.prisma,
        ctx.session.user.id,
        input.currentPassword,
        input.newPassword,
      );

      return { success: true };
    }),
});
