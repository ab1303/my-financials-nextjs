-- CreateTable
CREATE TABLE "Zakat" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "amountDue" MONEY NOT NULL,

    CONSTRAINT "Zakat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZakatPayment" (
    "id" TEXT NOT NULL,
    "datePaid" TIMESTAMP(3) NOT NULL,
    "amount" MONEY NOT NULL,
    "beneficiaryType" "BeneficiaryEnumType",
    "businessId" TEXT,
    "zakatId" TEXT,

    CONSTRAINT "ZakatPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Zakat" ADD CONSTRAINT "Zakat_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CalendarYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZakatPayment" ADD CONSTRAINT "ZakatPayment_zakatId_fkey" FOREIGN KEY ("zakatId") REFERENCES "Zakat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
