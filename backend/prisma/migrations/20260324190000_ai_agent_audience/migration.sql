-- AlterTable
ALTER TABLE "ai_agents" ADD COLUMN "audience_mode" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "ai_agents" ADD COLUMN "enabled_roles" JSONB NOT NULL DEFAULT '[]';
