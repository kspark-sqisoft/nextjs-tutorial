CREATE TYPE "public"."attachment_kind" AS ENUM('AVATAR', 'POST_INLINE', 'POST_ATTACHMENT');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"owner_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_owner_id_idx" ON "attachments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_post_id_idx" ON "attachments" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_object_key_unique" ON "attachments" USING btree ("object_key");