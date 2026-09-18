-- CreateTable
CREATE TABLE "whatsapp_meta_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_id" TEXT NOT NULL DEFAULT '',
    "app_secret_enc" TEXT,
    "embedded_signup_config_id" TEXT NOT NULL DEFAULT '',
    "graph_api_version" TEXT NOT NULL DEFAULT 'v21.0',
    "webhook_verify_token" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "whatsapp_meta_settings_pkey" PRIMARY KEY ("id")
);
