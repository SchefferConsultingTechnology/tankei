import type { ReactNode } from 'react';
import type { SiteConfig } from './config';
import { SITE_CSS } from './styles';

/** Páginas do site, na ordem do menu. */
export const NAV = [
  { path: '/', label: 'Início' },
  { path: '/como-funciona/', label: 'Como funciona' },
  { path: '/para-postos/', label: 'Para postos' },
] as const;

export interface PageProps {
  config: SiteConfig;
  /** Caminho publicado, com barra no fim ("/", "/para-postos/"). */
  path: string;
  title: string;
  description: string;
  /** Página sem lugar no Google (ex.: 404). */
  noindex?: boolean;
  children: ReactNode;
}

/** Estrutura comum: cabeçalho, menu, conteúdo e rodapé. */
export function Page({
  config,
  path,
  title,
  description,
  noindex,
  children,
}: PageProps) {
  const url = `${config.url}${path}`;
  const fullTitle = path === '/' ? title : `${title} · Tankei`;
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        {(noindex || !config.indexing) && (
          <meta name="robots" content="noindex" />
        )}
        <link rel="canonical" href={url} />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Tankei" />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta
          property="og:image"
          content={`${config.url}/logo-horizontal.png`}
        />
        <meta name="theme-color" content="#012049" />
        <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      </head>
      <body>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        <header className="top">
          <div className="wrap">
            <a className="logo" href="/" aria-label="Tankei, página inicial">
              <picture>
                <source
                  media="(prefers-color-scheme: dark)"
                  srcSet="/logo-horizontal-dark.png"
                />
                <img
                  src="/logo-horizontal.png"
                  width={122}
                  height={36}
                  alt="Tankei"
                />
              </picture>
            </a>
            <nav aria-label="Principal">
              <ul>
                {NAV.map((item) => (
                  <li key={item.path}>
                    <a
                      href={item.path}
                      aria-current={item.path === path ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main id="conteudo">{children}</main>
        <Footer config={config} />
      </body>
    </html>
  );
}

function Footer({ config }: { config: SiteConfig }) {
  return (
    <footer>
      <div className="wrap">
        <div>
          <p>
            <strong>Tankei</strong>: preço e qualidade dos postos de
            combustível.
          </p>
          <p>
            Nada que é pago altera a nota de um posto nem a ordem por menor
            preço.
          </p>
        </div>
        <ul>
          <li>
            <a href="/como-funciona/">Como funciona</a>
          </li>
          <li>
            <a href="/para-postos/">Para postos</a>
          </li>
          <li>
            <a href="/privacidade/">Privacidade</a>
          </li>
          <li>
            <a href="/termos/">Termos de uso</a>
          </li>
          {config.contactEmail && (
            <li>
              <a href={`mailto:${config.contactEmail}`}>Contato</a>
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
