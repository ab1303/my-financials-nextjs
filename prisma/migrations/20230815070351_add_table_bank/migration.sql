-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "postcode" INTEGER NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);
