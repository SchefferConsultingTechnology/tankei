import { BADGE_DESCRIPTIONS, BADGE_LABELS, HOW_IT_WORKS } from '@tankei/shared';
import type { SiteConfig } from '../config';
import { Page } from '../layout';
import { BADGE_ORDER } from './home';

/** Mesmos textos do app e do portal (ADR 0030, help.ts). */
export function HowItWorksPage({ config }: { config: SiteConfig }) {
  return (
    <Page
      config={config}
      path="/como-funciona/"
      title="Como funciona"
      description="De onde vêm os preços no Tankei, o que significam os selos, como funciona o IQP e as regras para quem informa preços."
    >
      <section>
        <div className="wrap prose">
          <h1>Como funciona</h1>
          <p className="intro">
            Os mesmos textos que você encontra no app, em &quot;Como
            funciona&quot;.
          </p>
          <ul className="toc">
            {HOW_IT_WORKS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
            <li>
              <a href="#selos">Os selos de preço</a>
            </li>
          </ul>
          {HOW_IT_WORKS.map((s) => (
            <div key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ))}
          <div id="selos">
            <h2>Os selos de preço</h2>
            <ul className="badges">
              {BADGE_ORDER.map((badge) => (
                <li key={badge}>
                  <span className={`badge badge-${badge}`}>
                    {BADGE_LABELS[badge]}
                  </span>
                  : {BADGE_DESCRIPTIONS[badge]}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </Page>
  );
}
