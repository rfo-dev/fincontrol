-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'WhatsApp',
    "waba_id" TEXT,
    "phone_number_id" TEXT,
    "display_phone" TEXT,
    "business_id" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "raw_session" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);
