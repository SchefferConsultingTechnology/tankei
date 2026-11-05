-- Migration manual: raio da concorrência local no portal do posto (ADR 0018).
INSERT INTO parameters (key, value, reason) VALUES
  ('portal.competition_radius_m', '5000', 'Valor inicial: 5 km, a cidade-piloto inteira.');
