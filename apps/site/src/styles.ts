/**
 * CSS do site oficial. Cores da marca (ADR 0017), as mesmas do portal e da
 * página do posto, com tema claro e escuro pela preferência do aparelho. Sem
 * fontes externas nem JavaScript: o site abre rápido no 4G.
 */
export const SITE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #F5F7FB; --paper: #FFFFFF; --text: #0F1B33; --muted: #5B6B85;
  --divider: #D9E0EA; --primary: #012049; --on-primary: #FFFFFF;
  --accent: #E8590C; --hero: #012049; --on-hero: #FFFFFF; --on-hero-muted: #C9D4E6;
  --notice-bg: #FFF4E5; --notice-border: #F5C27A;
  --badge-promocao: #7c3aed; --badge-atualizado_posto: #15803d;
  --badge-confirmado_motoristas: #1d4ed8; --badge-informado_motorista: #b45309;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #07122A; --paper: #0F1E3D; --text: #F1F5FB; --muted: #9AABC6;
    --divider: #24395F; --primary: #FF7A1A; --on-primary: #012049;
    --accent: #FF8A2B; --hero: #0F1E3D; --on-hero: #F1F5FB; --on-hero-muted: #9AABC6;
    --notice-bg: #2A2410; --notice-border: #7A5A1E;
    --badge-promocao: #c4b5fd; --badge-atualizado_posto: #4ade80;
    --badge-confirmado_motoristas: #93c5fd; --badge-informado_motorista: #fcd34d;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
a { color: inherit; }
img { max-width: 100%; display: block; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 16px; top: 8px; background: var(--paper); padding: 8px 12px; z-index: 10; }

/* Cabeçalho */
.top { background: var(--paper); border-bottom: 1px solid var(--divider); }
.top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 12px; padding-bottom: 12px; }
.logo img { height: 36px; width: auto; }
nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 0; padding: 0; }
nav a { text-decoration: none; font-weight: 600; font-size: 15px; color: var(--muted); }
nav a:hover, nav a[aria-current="page"] { color: var(--text); }
nav a[aria-current="page"] { text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px; text-decoration-color: var(--accent); }

/* Destaque do topo */
.hero { background: var(--hero); color: var(--on-hero); }
.hero .wrap { padding-top: 56px; padding-bottom: 56px; }
.hero h1 { font-size: 34px; line-height: 1.15; margin: 0 0 16px; max-width: 760px; }
.hero p.lead { font-size: 19px; color: var(--on-hero-muted); margin: 0 0 28px; max-width: 680px; }
.hero .eyebrow { color: var(--accent); font-weight: 700; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin: 0 0 12px; }

/* Botões */
.actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.button {
  display: inline-block; padding: 12px 22px; border-radius: 999px; font-weight: 700;
  text-decoration: none; background: var(--accent); color: #fff; border: 2px solid var(--accent);
}
@media (prefers-color-scheme: dark) { .button { color: #012049; } }
.button.ghost { background: transparent; color: inherit; border-color: currentColor; }
.store {
  display: inline-flex; flex-direction: column; padding: 8px 18px; border-radius: 12px;
  border: 1px solid var(--on-hero-muted); color: var(--on-hero); line-height: 1.25;
}
.store small { font-size: 12px; color: var(--on-hero-muted); text-transform: uppercase; letter-spacing: .05em; }
.store strong { font-size: 16px; }

/* Seções */
main section { padding: 48px 0; }
main section + section { border-top: 1px solid var(--divider); }
h2 { font-size: 26px; line-height: 1.2; margin: 0 0 8px; }
h3 { font-size: 18px; margin: 0 0 6px; }
.intro { color: var(--muted); margin: 0 0 28px; max-width: 720px; }
.cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.card { background: var(--paper); border: 1px solid var(--divider); border-radius: 16px; padding: 20px; }
.card p { margin: 0; color: var(--muted); font-size: 16px; }
.card .icon { font-size: 26px; line-height: 1; margin-bottom: 10px; }
.badges { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.badges li { background: var(--paper); border: 1px solid var(--divider); border-radius: 12px; padding: 14px 16px; }
.badge { font-weight: 700; }
.badge-promocao { color: var(--badge-promocao); }
.badge-atualizado_posto { color: var(--badge-atualizado_posto); }
.badge-confirmado_motoristas { color: var(--badge-confirmado_motoristas); }
.badge-informado_motorista { color: var(--badge-informado_motorista); }
.rules { padding-left: 20px; margin: 0; }
.rules li { margin-bottom: 8px; }
.steps { counter-reset: step; list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.steps li { counter-increment: step; background: var(--paper); border: 1px solid var(--divider); border-radius: 16px; padding: 20px; }
.steps li::before { content: counter(step); display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: var(--on-primary); font-weight: 800; margin-bottom: 10px; }
.steps p { margin: 0; color: var(--muted); font-size: 16px; }
.band { background: var(--paper); border: 1px solid var(--divider); border-radius: 20px; padding: 28px; display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: center; justify-content: space-between; }
.band h2 { margin: 0 0 4px; }
.band p { margin: 0; color: var(--muted); }

/* Textos longos (como funciona, privacidade, termos) */
.prose { max-width: 760px; }
.prose h2 { margin-top: 36px; }
.prose h2:first-child { margin-top: 0; }
.prose p, .prose li { color: var(--text); }
.prose ul { padding-left: 22px; }
.prose ul.toc, .prose ul.badges { padding-left: 0; }
.prose a { overflow-wrap: anywhere; }
.notice { background: var(--notice-bg); border: 1px solid var(--notice-border); border-radius: 12px; padding: 14px 16px; margin: 0 0 28px; }
.toc { list-style: none; padding: 0; margin: 0 0 32px; display: flex; flex-wrap: wrap; gap: 8px; }
.toc a { display: inline-block; padding: 6px 12px; border: 1px solid var(--divider); border-radius: 999px; text-decoration: none; font-size: 15px; background: var(--paper); }

/* Fotos e colunas */
.hero-grid { display: grid; gap: 32px; align-items: center; }
.photo { width: 100%; max-width: 440px; height: auto; aspect-ratio: 1; object-fit: cover; margin: 0 auto; border-radius: 24px; box-shadow: 0 12px 32px rgba(1, 32, 73, .18); }
.photo.wide { max-width: 520px; aspect-ratio: 4 / 3; }
.photo.landscape { max-width: 540px; aspect-ratio: 3 / 2; }
.split { display: grid; gap: 32px; align-items: center; }
.points { list-style: none; padding: 0; margin: 0 0 16px; display: grid; gap: 12px; }
.points li { padding-left: 30px; position: relative; }
.points li::before { content: "⚡"; position: absolute; left: 0; top: 0; }
.note { color: var(--muted); font-size: 15px; margin: 0; }
.band.with-photo { display: grid; gap: 20px; padding: 16px; }
.band.with-photo > div { padding: 4px 8px 12px; }
.band.with-photo .actions { margin-top: 20px; }
.band-photo { width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 14px; }
@media (min-width: 860px) {
  .hero-grid { grid-template-columns: 1.25fr 1fr; }
  .split { grid-template-columns: 1fr 1fr; gap: 48px; }
  .split.reverse > :first-child { order: 2; }
  .band { flex-wrap: nowrap; }
  .band.with-photo { grid-template-columns: 1.15fr 1fr; gap: 32px; align-items: center; }
}

/* Rodapé */
footer { border-top: 1px solid var(--divider); background: var(--paper); color: var(--muted); font-size: 15px; }
footer .wrap { padding-top: 32px; padding-bottom: 40px; display: flex; flex-wrap: wrap; gap: 16px 40px; justify-content: space-between; }
footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }
footer p { margin: 0 0 4px; }

@media (min-width: 720px) {
  .hero h1 { font-size: 48px; }
  .hero .wrap { padding-top: 88px; padding-bottom: 88px; }
  h2 { font-size: 30px; }
  main section { padding: 64px 0; }
}
`;
