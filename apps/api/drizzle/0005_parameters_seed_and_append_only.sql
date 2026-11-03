-- Migration manual: parâmetros e referências de preço são só de inserção,
-- e os parâmetros recebem os valores iniciais do ADR 0006.
CREATE TRIGGER parameters_append_only
  BEFORE UPDATE OR DELETE ON parameters
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER parameters_no_truncate
  BEFORE TRUNCATE ON parameters
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER price_references_append_only
  BEFORE UPDATE OR DELETE ON price_references
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER price_references_no_truncate
  BEFORE TRUNCATE ON price_references
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('price.reference_state', '"SC"', 'Valor inicial (ADR 0006): cidade-piloto em SC.'),
  ('price.reference_normal_pct', '25', 'Valor inicial (ADR 0006).'),
  ('price.reference_max_pct', '60', 'Valor inicial (ADR 0006).'),
  ('price.variation_confirm_pct', '10', 'Valor inicial (ADR 0006).'),
  ('price.confirmation_window_hours', '48', 'Valor inicial (ADR 0006).'),
  ('price.confirmations_required', '2', 'Valor inicial (ADR 0006).'),
  ('price.stale_after_days', '7', 'Valor inicial (ADR 0006).'),
  ('price.hide_after_days', '30', 'Valor inicial (ADR 0006).'),
  ('price.report_min_interval_hours', '2', 'Valor inicial (ADR 0006).'),
  ('price.reports_per_day_max', '30', 'Valor inicial (ADR 0006).');
