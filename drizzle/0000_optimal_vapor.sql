CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bilty_number" text NOT NULL,
	"description" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"payment_type" text NOT NULL,
	"amount_due" numeric,
	"status" text DEFAULT 'IN_STORE' NOT NULL,
	"received_by" uuid,
	"received_at" timestamp DEFAULT now(),
	"released_by" uuid,
	"released_at" timestamp,
	"receiver_name" text,
	"receiver_phone" text,
	"receiver_cnic" text,
	"cash_collected" numeric,
	"location_id" text DEFAULT 'main',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "parcels_bilty_number_unique" UNIQUE("bilty_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'STAFF' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;