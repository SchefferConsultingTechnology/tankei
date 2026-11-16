import type { SiteConfig } from '../config';
import { Page } from '../layout';

export function NotFoundPage({ config }: { config: SiteConfig }) {
  return (
    <Page
      config={config}
      path="/404.html"
      title="Página não encontrada"
      description="Esta página não existe no site do Tankei."
      noindex
    >
      <section>
        <div className="wrap prose">
          <h1>Página não encontrada</h1>
          <p>
            O endereço pode estar errado ou a página mudou de lugar.{' '}
            <a href="/">Voltar ao início</a>.
          </p>
        </div>
      </section>
    </Page>
  );
}
