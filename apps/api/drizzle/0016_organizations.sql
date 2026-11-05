CREATE TYPE "public"."org_role" AS ENUM('proprietario', 'gestor', 'operador', 'leitura');--> statement-breakpoint
CREATE TYPE "public"."org_scope" AS ENUM('todas', 'selecionadas');--> statement-breakpoint
CREATE TABLE "organization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" NOT NULL,
	"scope" "org_scope" NOT NULL,
	"station_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"declined_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_member_stations" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	CONSTRAINT "organization_member_stations_organization_id_user_id_station_id_pk" PRIMARY KEY("organization_id","user_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"scope" "org_scope" DEFAULT 'todas' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organization_stations" (
	"organization_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"added_by_user_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_stations_organization_id_station_id_pk" PRIMARY KEY("organization_id","station_id"),
	CONSTRAINT "organization_stations_station_unique" UNIQUE("station_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_events" ADD CONSTRAINT "organization_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_stations" ADD CONSTRAINT "organization_member_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_stations" ADD CONSTRAINT "organization_stations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_stations" ADD CONSTRAINT "organization_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_stations" ADD CONSTRAINT "organization_stations_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_events_org_idx" ON "organization_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_idx" ON "organization_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
-- Parte manual (ADR 0021).
-- Migração: cada responsável vira proprietário de uma rede com os postos que
-- já gerenciava. Posto que já entrou na rede de outra pessoa (dois
-- responsáveis): a pessoa entra como proprietária dessa rede.
DO $$
DECLARE
  r record;
  sid uuid;
  own_org uuid;
  existing uuid;
BEGIN
  FOR r IN
    SELECT user_id, array_agg(station_id ORDER BY created_at) AS station_ids
    FROM station_managers
    WHERE role = 'responsavel'
    GROUP BY user_id
  LOOP
    own_org := NULL;
    FOREACH sid IN ARRAY r.station_ids LOOP
      SELECT organization_id INTO existing FROM organization_stations WHERE station_id = sid;
      IF existing IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role, scope)
          VALUES (existing, r.user_id, 'proprietario', 'todas')
          ON CONFLICT DO NOTHING;
      ELSE
        IF own_org IS NULL THEN
          INSERT INTO organizations (name, created_by_user_id)
            SELECT coalesce(s.trade_name, s.legal_name), r.user_id FROM stations s WHERE s.id = sid
            RETURNING id INTO own_org;
          INSERT INTO organization_members (organization_id, user_id, role, scope)
            VALUES (own_org, r.user_id, 'proprietario', 'todas');
          INSERT INTO organization_events (organization_id, action, details)
            VALUES (own_org, 'rede_criada', jsonb_build_object('origem', 'migracao'));
        END IF;
        INSERT INTO organization_stations (organization_id, station_id, added_by_user_id)
          VALUES (own_org, sid, r.user_id);
        INSERT INTO organization_events (organization_id, action, details)
          VALUES (own_org, 'unidade_adicionada', jsonb_build_object('stationId', sid, 'origem', 'migracao'));
      END IF;
    END LOOP;
  END LOOP;
END $$;--> statement-breakpoint
CREATE TRIGGER organization_events_append_only
  BEFORE UPDATE OR DELETE ON organization_events
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
CREATE TRIGGER organization_events_no_truncate
  BEFORE TRUNCATE ON organization_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('team.invitation_valid_days', '14', 'Valor inicial: convite vale duas semanas.');
