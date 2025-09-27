import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allIndividualDetailsHandler,
  addIndividualDetailsHandler,
  updateIndividualDetailsHandler,
  removeIndividualDetailsHandler,
} from '@/server/controllers/individual.controller';
import {
  createIndividualSchema,
  updateIndividualSchema,
  params,
  createRelationshipSchema,
  relationshipParams,
} from '@/server/schema/individual.schema';
import { getRelationships } from '@/server/services/relationship.service';

export const individualRouter = router({
  // Individual CRUD operations
  saveIndividualDetails: protectedProcedure
    .input(createIndividualSchema)
    .mutation(({ input, ctx: { session } }) =>
      addIndividualDetailsHandler({ input, userId: session.user.id }),
    ),

  updateIndividualDetails: protectedProcedure
    .input(updateIndividualSchema)
    .mutation(({ input, ctx: { session } }) =>
      updateIndividualDetailsHandler({ input, userId: session.user.id }),
    ),

  getAllIndividuals: protectedProcedure.query(({ ctx: { session } }) => {
    return allIndividualDetailsHandler(session.user.id);
  }),

  removeIndividualDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeIndividualDetailsHandler({ params: input })),

  // Relationship management operations
  getAllRelationships: protectedProcedure.query(({ ctx: { session } }) => {
    return getRelationships({ userId: session.user.id });
  }),
});
