-- AlterTable
ALTER TABLE "WhatsAppIntegration" ADD COLUMN     "evolutionInstanceId" TEXT,
ADD COLUMN     "evolutionInstanceName" TEXT,
ADD COLUMN     "evolutionStatus" TEXT,
ADD COLUMN     "evolutionWebhookSecretConfigured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEvolutionConfigCheckAt" TIMESTAMP(3),
ADD COLUMN     "lastEvolutionMessageReceivedAt" TIMESTAMP(3),
ADD COLUMN     "lastEvolutionMessageSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MessagingWebhookEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "instanceName" TEXT,
    "fromPhone" TEXT,
    "payloadHash" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_clinicId_idx" ON "MessagingWebhookEvent"("clinicId");

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_provider_idx" ON "MessagingWebhookEvent"("provider");

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_eventType_idx" ON "MessagingWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_externalMessageId_idx" ON "MessagingWebhookEvent"("externalMessageId");

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_instanceName_idx" ON "MessagingWebhookEvent"("instanceName");

-- CreateIndex
CREATE INDEX "MessagingWebhookEvent_receivedAt_idx" ON "MessagingWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingWebhookEvent_payloadHash_key" ON "MessagingWebhookEvent"("payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIntegration_evolutionInstanceName_key" ON "WhatsAppIntegration"("evolutionInstanceName");

-- AddForeignKey
ALTER TABLE "MessagingWebhookEvent" ADD CONSTRAINT "MessagingWebhookEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
