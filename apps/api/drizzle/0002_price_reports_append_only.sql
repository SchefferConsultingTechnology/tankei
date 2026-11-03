-- Migration manual: informes de preço são só de inserção (ADR 0003).
-- Correções criam um informe novo; nada é alterado nem apagado.
CREATE FUNCTION reject_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é só de inserção: % não é permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER price_reports_append_only
  BEFORE UPDATE OR DELETE ON price_reports
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER price_reports_no_truncate
  BEFORE TRUNCATE ON price_reports
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
