/*
  Warnings:

  - A unique constraint covering the columns `[calendarId]` on the table `Zakat` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Zakat_calendarId_key" ON "Zakat"("calendarId");
