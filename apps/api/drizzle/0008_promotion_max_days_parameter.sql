-- Migration manual: valor inicial da duração máxima de uma promoção.
INSERT INTO parameters (key, value, reason) VALUES
  ('price.promotion_max_days', '7', 'Valor inicial: promoção de até uma semana.');
