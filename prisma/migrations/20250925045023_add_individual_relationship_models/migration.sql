/*
  Warnings:

  - You are about to drop the column `relationship` on the `Individual` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,userId]` on the table `Individual` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Individual` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Individual" DROP COLUMN "relationship",
ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "postcode" INTEGER,
ADD COLUMN     "relationshipId" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "suburb" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Relationship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_name_userId_key" ON "public"."Relationship"("name", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Individual_name_userId_key" ON "public"."Individual"("name", "userId");

-- AddForeignKey
ALTER TABLE "public"."Relationship" ADD CONSTRAINT "Relationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Individual" ADD CONSTRAINT "Individual_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "public"."Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
