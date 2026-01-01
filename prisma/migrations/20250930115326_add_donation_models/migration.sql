-- CreateTable
CREATE TABLE "public"."Donation" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DonationPayment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "beneficiaryType" "public"."BeneficiaryEnumType" NOT NULL,
    "taxCategory" TEXT NOT NULL,
    "businessId" TEXT,
    "individualId" TEXT,
    "donationId" TEXT NOT NULL,

    CONSTRAINT "DonationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_calendarId_key" ON "public"."Donation"("calendarId");

-- AddForeignKey
ALTER TABLE "public"."Donation" ADD CONSTRAINT "Donation_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "public"."CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DonationPayment" ADD CONSTRAINT "DonationPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DonationPayment" ADD CONSTRAINT "DonationPayment_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "public"."Individual"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DonationPayment" ADD CONSTRAINT "DonationPayment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "public"."Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
