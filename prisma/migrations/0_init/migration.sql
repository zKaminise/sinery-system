-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClinicSegment" AS ENUM ('ODONTOLOGY', 'PHYSIOTHERAPY', 'AESTHETICS', 'PSYCHOLOGY', 'MEDICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SETUP_PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'RECEPTIONIST', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProfessionalStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CreatedBySource" AS ENUM ('USER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'INTERNAL_SIMULATOR');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('AI_HANDLING', 'WAITING_HUMAN', 'HUMAN_HANDLING', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('PATIENT', 'AI', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('INTERNAL_ONLY', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'MOCK_SENT');

-- CreateEnum
CREATE TYPE "WhatsAppIntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED', 'INVALID_CONFIG', 'DISABLED', 'READY_FOR_WEBHOOK', 'READY_FOR_SEND', 'ERROR');

-- CreateEnum
CREATE TYPE "AssistProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'SENT', 'INTERNAL_ONLY', 'TRANSFERRED_TO_HUMAN', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('FOUNDER', 'PLATFORM_ADMIN', 'SUPPORT', 'FINANCE');

-- CreateEnum
CREATE TYPE "PlatformUserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('FREE', 'MONTHLY', 'YEARLY', 'ONE_TIME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('MANUAL', 'CHECKOUT', 'API', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'PIX', 'BOLETO', 'CREDIT_CARD', 'BANK_TRANSFER', 'FREE', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'MANUALLY_CONFIRMED');

-- CreateEnum
CREATE TYPE "BillingNotificationType" AS ENUM ('PAYMENT_DUE_SOON', 'PAYMENT_DUE_TODAY', 'PAYMENT_OVERDUE', 'PAYMENT_SUSPENSION_WARNING', 'PAYMENT_SUSPENDED', 'PAYMENT_CONFIRMED');

-- CreateEnum
CREATE TYPE "BillingNotificationStatus" AS ENUM ('PENDING', 'MOCKED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PASSWORD_RESET_CODE', 'OWNER_WELCOME_FOUNDER', 'OWNER_WELCOME_CHECKOUT', 'TEMPORARY_PASSWORD_RESET', 'BILLING_PAYMENT_CONFIRMED', 'BILLING_PAYMENT_OVERDUE', 'CHECKOUT_PAYMENT_PENDING', 'CONTACT_FORM');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'MOCKED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'MOCK');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'PROVISIONING', 'PROVISIONED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT,
    "document" TEXT,
    "segment" "ClinicSegment" NOT NULL DEFAULT 'ODONTOLOGY',
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "logoUrl" TEXT,
    "status" "ClinicStatus" NOT NULL DEFAULT 'SETUP_PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "businessStartHour" INTEGER,
    "businessEndHour" INTEGER,
    "appointmentSlotMinutes" INTEGER NOT NULL DEFAULT 30,
    "allowAiScheduling" BOOLEAN NOT NULL DEFAULT false,
    "allowAiRescheduling" BOOLEAN NOT NULL DEFAULT false,
    "allowAiCancellation" BOOLEAN NOT NULL DEFAULT false,
    "aiTone" TEXT NOT NULL DEFAULT 'professional',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RECEPTIONIST',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "temporaryPassword" BOOLEAN NOT NULL DEFAULT false,
    "firstLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "document" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "status" "ProfessionalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "priceInCents" INTEGER,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingHour" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdBySource" "CreatedBySource" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "channel" "ConversationChannel" NOT NULL DEFAULT 'INTERNAL_SIMULATOR',
    "externalContactId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'AI_HANDLING',
    "assignedUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "externalMessageId" TEXT,
    "externalChannel" TEXT,
    "externalTimestamp" TIMESTAMP(3),
    "deliveryStatus" "MessageDeliveryStatus",
    "deliveryErrorCode" TEXT,
    "deliveryErrorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL DEFAULT 'Sinery Assist',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "fallbackToHuman" BOOLEAN NOT NULL DEFAULT true,
    "humanFallbackMessage" TEXT,
    "canAnswerPricing" BOOLEAN NOT NULL DEFAULT false,
    "canSchedule" BOOLEAN NOT NULL DEFAULT false,
    "canReschedule" BOOLEAN NOT NULL DEFAULT false,
    "canCancel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeBase" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "mode" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostInCents" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "toolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppIntegration" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'META_CLOUD_API',
    "businessAccountId" TEXT,
    "phoneNumberId" TEXT,
    "appId" TEXT,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "webhookPath" TEXT,
    "webhookVerifyTokenConfigured" BOOLEAN NOT NULL DEFAULT false,
    "sendMessagesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "WhatsAppIntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastConfigCheckAt" TIMESTAMP(3),
    "lastConfigCheckStatus" TEXT,
    "lastConfigCheckMessage" TEXT,
    "lastWebhookVerifiedAt" TIMESTAMP(3),
    "lastMessageReceivedAt" TIMESTAMP(3),
    "lastMessageSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "integrationId" TEXT,
    "eventType" TEXT NOT NULL,
    "whatsappMessageId" TEXT,
    "whatsappStatusId" TEXT,
    "phoneNumberId" TEXT,
    "fromPhone" TEXT,
    "payloadHash" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistProcessingRun" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "inboundMessageId" TEXT NOT NULL,
    "outboundMessageId" TEXT,
    "mode" TEXT NOT NULL,
    "trigger" TEXT,
    "status" "AssistProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'FOUNDER',
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "temporaryPassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceInCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "maxUsers" INTEGER,
    "maxProfessionals" INTEGER,
    "maxPatients" INTEGER,
    "maxAppointmentsPerMonth" INTEGER,
    "maxAiMessagesPerMonth" INTEGER,
    "maxWhatsappMessagesPerMonth" INTEGER,
    "includesWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "includesAi" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSubscription" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "planId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingType" "BillingType" NOT NULL DEFAULT 'MANUAL',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
    "amountInCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "graceDays" INTEGER NOT NULL DEFAULT 20,
    "overdueSince" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "freeReason" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceNumber" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "externalProvider" TEXT,
    "externalInvoiceId" TEXT,
    "externalPaymentUrl" TEXT,
    "manualPaymentReference" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdByPlatformUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingNotificationLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" "BillingNotificationType" NOT NULL,
    "status" "BillingNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT,
    "preview" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "userId" TEXT,
    "platformUserId" TEXT,
    "toEmail" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyToEmail" TEXT,
    "subject" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "EmailProvider" NOT NULL DEFAULT 'RESEND',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "platformUserId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "planId" TEXT,
    "clinicId" TEXT,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'PENDING',
    "clinicName" TEXT NOT NULL,
    "desiredSlug" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "companyDocument" TEXT,
    "city" TEXT,
    "state" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billingInterval" "BillingInterval" NOT NULL,
    "externalProvider" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "externalPaymentId" TEXT,
    "externalPaymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "externalPaymentId" TEXT,
    "externalSubscriptionId" TEXT,
    "checkoutSessionId" TEXT,
    "clinicId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_slug_key" ON "Clinic"("slug");

-- CreateIndex
CREATE INDEX "Clinic_status_idx" ON "Clinic"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicSettings_clinicId_key" ON "ClinicSettings"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clinicId_email_key" ON "User"("clinicId", "email");

-- CreateIndex
CREATE INDEX "Patient_clinicId_phone_idx" ON "Patient"("clinicId", "phone");

-- CreateIndex
CREATE INDEX "Professional_clinicId_name_idx" ON "Professional"("clinicId", "name");

-- CreateIndex
CREATE INDEX "Service_clinicId_name_idx" ON "Service"("clinicId", "name");

-- CreateIndex
CREATE INDEX "ProfessionalService_clinicId_idx" ON "ProfessionalService"("clinicId");

-- CreateIndex
CREATE INDEX "ProfessionalService_serviceId_idx" ON "ProfessionalService"("serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalService_professionalId_idx" ON "ProfessionalService"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalService_professionalId_serviceId_key" ON "ProfessionalService"("professionalId", "serviceId");

-- CreateIndex
CREATE INDEX "WorkingHour_clinicId_idx" ON "WorkingHour"("clinicId");

-- CreateIndex
CREATE INDEX "WorkingHour_professionalId_idx" ON "WorkingHour"("professionalId");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_startAt_idx" ON "Appointment"("clinicId", "startAt");

-- CreateIndex
CREATE INDEX "Conversation_clinicId_contactPhone_idx" ON "Conversation"("clinicId", "contactPhone");

-- CreateIndex
CREATE INDEX "Message_clinicId_idx" ON "Message"("clinicId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_externalMessageId_idx" ON "Message"("externalMessageId");

-- CreateIndex
CREATE INDEX "Message_externalChannel_idx" ON "Message"("externalChannel");

-- CreateIndex
CREATE INDEX "Message_deliveryStatus_idx" ON "Message"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AiSettings_clinicId_key" ON "AiSettings"("clinicId");

-- CreateIndex
CREATE INDEX "AiKnowledgeBase_clinicId_idx" ON "AiKnowledgeBase"("clinicId");

-- CreateIndex
CREATE INDEX "AiUsageLog_clinicId_createdAt_idx" ON "AiUsageLog"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_clinicId_success_idx" ON "AiUsageLog"("clinicId", "success");

-- CreateIndex
CREATE INDEX "AiUsageLog_clinicId_provider_idx" ON "AiUsageLog"("clinicId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIntegration_clinicId_key" ON "WhatsAppIntegration"("clinicId");

-- CreateIndex
CREATE INDEX "WhatsAppIntegration_status_idx" ON "WhatsAppIntegration"("status");

-- CreateIndex
CREATE INDEX "WhatsAppIntegration_enabled_idx" ON "WhatsAppIntegration"("enabled");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_clinicId_idx" ON "WhatsAppWebhookEvent"("clinicId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_integrationId_idx" ON "WhatsAppWebhookEvent"("integrationId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_eventType_idx" ON "WhatsAppWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_whatsappMessageId_idx" ON "WhatsAppWebhookEvent"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_phoneNumberId_idx" ON "WhatsAppWebhookEvent"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_receivedAt_idx" ON "WhatsAppWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_payloadHash_key" ON "WhatsAppWebhookEvent"("payloadHash");

-- CreateIndex
CREATE INDEX "AssistProcessingRun_clinicId_idx" ON "AssistProcessingRun"("clinicId");

-- CreateIndex
CREATE INDEX "AssistProcessingRun_conversationId_idx" ON "AssistProcessingRun"("conversationId");

-- CreateIndex
CREATE INDEX "AssistProcessingRun_status_idx" ON "AssistProcessingRun"("status");

-- CreateIndex
CREATE INDEX "AssistProcessingRun_createdAt_idx" ON "AssistProcessingRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistProcessingRun_inboundMessageId_key" ON "AssistProcessingRun"("inboundMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_clinicId_createdAt_idx" ON "AuditLog"("clinicId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicSubscription_clinicId_key" ON "ClinicSubscription"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicSubscription_status_idx" ON "ClinicSubscription"("status");

-- CreateIndex
CREATE INDEX "ClinicSubscription_nextDueDate_idx" ON "ClinicSubscription"("nextDueDate");

-- CreateIndex
CREATE INDEX "BillingInvoice_clinicId_idx" ON "BillingInvoice"("clinicId");

-- CreateIndex
CREATE INDEX "BillingInvoice_subscriptionId_idx" ON "BillingInvoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_idx" ON "BillingInvoice"("status");

-- CreateIndex
CREATE INDEX "BillingInvoice_dueDate_idx" ON "BillingInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "BillingEvent_clinicId_idx" ON "BillingEvent"("clinicId");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "BillingEvent_invoiceId_idx" ON "BillingEvent"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingEvent_type_idx" ON "BillingEvent"("type");

-- CreateIndex
CREATE INDEX "BillingNotificationLog_clinicId_idx" ON "BillingNotificationLog"("clinicId");

-- CreateIndex
CREATE INDEX "BillingNotificationLog_invoiceId_idx" ON "BillingNotificationLog"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingNotificationLog_type_idx" ON "BillingNotificationLog"("type");

-- CreateIndex
CREATE INDEX "BillingNotificationLog_status_idx" ON "BillingNotificationLog"("status");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_platformUserId_idx" ON "PlatformAuditLog"("platformUserId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_clinicId_idx" ON "EmailLog"("clinicId");

-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_platformUserId_idx" ON "EmailLog"("platformUserId");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_platformUserId_idx" ON "PasswordResetToken"("platformUserId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_publicId_key" ON "CheckoutSession"("publicId");

-- CreateIndex
CREATE INDEX "CheckoutSession_status_idx" ON "CheckoutSession"("status");

-- CreateIndex
CREATE INDEX "CheckoutSession_ownerEmail_idx" ON "CheckoutSession"("ownerEmail");

-- CreateIndex
CREATE INDEX "CheckoutSession_desiredSlug_idx" ON "CheckoutSession"("desiredSlug");

-- CreateIndex
CREATE INDEX "CheckoutSession_externalProvider_idx" ON "CheckoutSession"("externalProvider");

-- CreateIndex
CREATE INDEX "CheckoutSession_externalSubscriptionId_idx" ON "CheckoutSession"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "CheckoutSession_externalPaymentId_idx" ON "CheckoutSession"("externalPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderEvent_payloadHash_key" ON "PaymentProviderEvent"("payloadHash");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_provider_idx" ON "PaymentProviderEvent"("provider");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_eventType_idx" ON "PaymentProviderEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_externalPaymentId_idx" ON "PaymentProviderEvent"("externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_externalSubscriptionId_idx" ON "PaymentProviderEvent"("externalSubscriptionId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_checkoutSessionId_idx" ON "PaymentProviderEvent"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "PaymentProviderEvent_clinicId_idx" ON "PaymentProviderEvent"("clinicId");

-- AddForeignKey
ALTER TABLE "ClinicSettings" ADD CONSTRAINT "ClinicSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeBase" ADD CONSTRAINT "AiKnowledgeBase_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppIntegration" ADD CONSTRAINT "WhatsAppIntegration_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "WhatsAppIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistProcessingRun" ADD CONSTRAINT "AssistProcessingRun_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistProcessingRun" ADD CONSTRAINT "AssistProcessingRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistProcessingRun" ADD CONSTRAINT "AssistProcessingRun_inboundMessageId_fkey" FOREIGN KEY ("inboundMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistProcessingRun" ADD CONSTRAINT "AssistProcessingRun_outboundMessageId_fkey" FOREIGN KEY ("outboundMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSubscription" ADD CONSTRAINT "ClinicSubscription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSubscription" ADD CONSTRAINT "ClinicSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ClinicSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingNotificationLog" ADD CONSTRAINT "BillingNotificationLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

