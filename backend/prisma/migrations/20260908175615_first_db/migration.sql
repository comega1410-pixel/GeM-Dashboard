-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'ANALYZED', 'ERROR');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('FINANCIAL', 'EXPERIENCE', 'CERTIFICATION', 'TECHNICAL', 'LEGAL', 'DOCUMENT_VALIDITY', 'BID_SPECIFIC');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BID_DOCUMENT', 'FINANCIAL_STATEMENT', 'CERTIFICATE', 'PURCHASE_ORDER', 'AUTHORIZATION', 'TECHNICAL_SPEC', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gemBidNumber" TEXT,
    "description" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "operator" TEXT,
    "thresholdValue" DOUBLE PRECISION,
    "unit" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "filePath" TEXT NOT NULL,
    "totalPages" INTEGER,
    "ocrRequired" BOOLEAN NOT NULL DEFAULT false,
    "processedText" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "confidence" DOUBLE PRECISION,
    "rawText" TEXT,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_results" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT,
    "evidenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_results_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_results" ADD CONSTRAINT "compliance_results_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_results" ADD CONSTRAINT "compliance_results_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_results" ADD CONSTRAINT "compliance_results_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
