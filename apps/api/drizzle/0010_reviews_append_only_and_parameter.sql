-- Migration manual: avaliações e cálculos do IQP são só de inserção (ADR 0004),
-- e o intervalo entre avaliações recebe o valor inicial.
CREATE TRIGGER reviews_append_only
  BEFORE UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER reviews_no_truncate
  BEFORE TRUNCATE ON reviews
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER iqp_scores_append_only
  BEFORE UPDATE OR DELETE ON iqp_scores
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
CREATE TRIGGER iqp_scores_no_truncate
  BEFORE TRUNCATE ON iqp_scores
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();
--> statement-breakpoint
INSERT INTO parameters (key, value, reason) VALUES
  ('review.min_interval_days', '30', 'Valor inicial (ADR 0004).');
