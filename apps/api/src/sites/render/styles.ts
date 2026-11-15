/**
 * CSS da página do posto. As cores são as da marca (ADR 0017, as mesmas do
 * portal), com tema claro e escuro pela preferência do aparelho. Sem fontes
 * externas: a página precisa abrir rápido no 4G (spec 0004).
 */
export const SITE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #F5F7FB; --paper: #FFFFFF; --text: #0F1B33; --muted: #5B6B85;
  --divider: #D9E0EA; --primary: #012049; --on-primary: #FFFFFF;
  --accent: #E8590C; --ok: #15803D; --closed: #B91C1C; --notice-bg: #FFF4E5;
  --badge-promocao: #7c3aed; --badge-atualizado_posto: #15803d;
  --badge-confirmado_motoristas: #1d4ed8; --badge-informado_motorista: #b45309;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #07122A; --paper: #0F1E3D; --text: #F1F5FB; --muted: #9AABC6;
    --divider: #24395F; --primary: #FF7A1A; --on-primary: #012049;
    --accent: #FF8A2B; --ok: #4ADE80; --closed: #F87171; --notice-bg: #2A2410;
    --badge-promocao: #c4b5fd; --badge-atualizado_posto: #4ade80;
    --badge-confirmado_motoristas: #93c5fd; --badge-informado_motorista: #fcd34d;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
a { color: inherit; }
img { max-width: 100%; display: block; }
main { max-width: 760px; margin: 0 auto; padding: 0 16px 32px; }
.cover { max-width: 760px; margin: 0 auto; aspect-ratio: 16 / 7; overflow: hidden; }
.cover img { width: 100%; height: 100%; object-fit: cover; }
header.station { padding: 24px 0 8px; }
.brand { color: var(--muted); font-size: 14px; margin: 0 0 4px; }
h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; overflow-wrap: anywhere; }
.address { color: var(--muted); margin: 0 0 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
  border-radius: 999px; border: 1px solid var(--divider); background: var(--paper);
  font-size: 14px; font-weight: 600;
}
a.chip { text-decoration: none; color: var(--text); }
.chip.open { color: var(--ok); }
.chip.closed { color: var(--closed); }
.chip .scale { color: var(--muted); font-weight: 400; }
.notice {
  margin: 16px 0 0; padding: 12px 16px; border-radius: 12px;
  background: var(--notice-bg); font-size: 15px;
}
section { margin-top: 16px; background: var(--paper); border: 1px solid var(--divider); border-radius: 16px; padding: 16px; }
h2 { font-size: 18px; margin: 0 0 12px; }
h3 { font-size: 16px; margin: 0 0 4px; overflow-wrap: anywhere; }
.muted { color: var(--muted); }
.small { font-size: 14px; }
ul.rows { list-style: none; margin: 0; padding: 0; }
ul.rows > li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--divider); }
ul.rows > li:first-child { border-top: 0; padding-top: 0; }
.price { font-size: 22px; font-weight: 700; white-space: nowrap; text-align: right; }
.price .unit { font-size: 14px; font-weight: 400; color: var(--muted); }
.badge { font-size: 13px; font-weight: 600; }
.badge-promocao { color: var(--badge-promocao); }
.badge-atualizado_posto { color: var(--badge-atualizado_posto); }
.badge-confirmado_motoristas { color: var(--badge-confirmado_motoristas); }
.badge-informado_motorista { color: var(--badge-informado_motorista); }
.note { font-size: 13px; color: var(--muted); }
.promos { display: grid; gap: 16px; }
.promo img { border-radius: 12px; margin-bottom: 8px; width: 100%; height: auto; }
.promo .until { color: var(--badge-promocao); font-weight: 600; font-size: 14px; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.photos figure { margin: 0; }
.photos img { border-radius: 12px; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.photos figcaption { font-size: 14px; color: var(--muted); margin-top: 4px; }
.iqp-score { font-size: 40px; font-weight: 800; line-height: 1; }
.iqp-score .scale { font-size: 18px; color: var(--muted); font-weight: 400; }
.bar { height: 8px; border-radius: 4px; background: var(--divider); overflow: hidden; margin-top: 4px; }
.bar > span { display: block; height: 100%; background: var(--primary); }
.dims { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 10px; }
.map { position: relative; height: 220px; overflow: hidden; border-radius: 12px; background: var(--divider); }
.map .grid { position: absolute; width: 768px; height: 768px; }
.map .grid img { position: absolute; width: 256px; height: 256px; max-width: none; }
.map .pin {
  position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -22px 0 0 -11px;
  border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
  background: var(--accent); border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4);
}
.map .credit { position: absolute; right: 0; bottom: 0; font-size: 11px; padding: 2px 6px; background: rgba(255,255,255,.85); color: #333; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.button {
  display: inline-block; padding: 10px 18px; border-radius: 999px; font-weight: 600;
  text-decoration: none; background: var(--primary); color: var(--on-primary);
}
.button.secondary { background: transparent; color: var(--text); border: 1px solid var(--divider); }
footer { max-width: 760px; margin: 0 auto; padding: 24px 16px 40px; color: var(--muted); font-size: 14px; }
footer details { margin-top: 8px; }
footer summary { cursor: pointer; font-weight: 600; color: var(--text); }
.empty { text-align: center; padding: 64px 16px; }
@media (min-width: 600px) { h1 { font-size: 34px; } }
`;
