import {
  BADGE_LABELS,
  CHARGER_ACCESS_LABELS,
  CHARGER_CURRENT_LABELS,
  CONFIDENCE_LABELS,
  CONNECTOR_LABELS,
  DAY_TYPE_LABELS,
  DAY_TYPES,
  FUEL_LABELS,
  FUEL_TYPES,
  FUEL_UNITS,
  IQP_EXPLANATION,
  IQP_FULL_NAME,
  IQP_SCALE_MAX,
  IQP_SUMMARY,
  STATION_MODE_NOTICES,
  STATION_SERVICE_LABELS,
  describeDay,
  describeDiscount,
  formatAge,
  formatPrice,
  openingStatus,
  priceNote,
  type CurrentPrice,
  type FuelType,
  type Promotion,
  type StationCharger,
} from '@tankei/shared';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StationPageData } from '../sites.service';
import { gasStationJsonLd, mapTiles, routeLinks, safeJson } from './seo';
import { SITE_CSS } from './styles';

export interface RenderOptions {
  /** Endereço canônico da página. */
  url: string;
  /** false no ambiente de teste: a página não deve aparecer no Google. */
  indexing: boolean;
  /** Site oficial do Tankei (ADR 0043), para os links do rodapé; vazio omite. */
  officialSiteUrl?: string;
  now?: Date;
}

/** HTML completo da página do posto (spec 0004, fase A, página básica). */
export function renderStationPage(
  data: StationPageData,
  options: RenderOptions,
): string {
  const { station, showcase } = data;
  const now = options.now ?? new Date();
  const cover = showcase.photos[0] ?? null;
  const title = pageTitle(station);
  const description = describeStation(data);

  return document(
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        {!options.indexing && <meta name="robots" content="noindex" />}
        <link rel="canonical" href={options.url} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="Tankei" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={options.url} />
        {cover && <meta property="og:image" content={cover.url} />}
        {cover && (
          <meta property="og:image:width" content={String(cover.width)} />
        )}
        {cover && (
          <meta property="og:image:height" content={String(cover.height)} />
        )}
        <meta
          name="twitter:card"
          content={cover ? 'summary_large_image' : 'summary'}
        />
        <meta name="theme-color" content="#012049" />
        <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJson(
              gasStationJsonLd(station, options.url, cover?.url ?? null),
            ),
          }}
        />
      </head>
      <body>
        {cover && (
          <div className="cover">
            <img
              src={cover.url}
              width={cover.width}
              height={cover.height}
              alt={cover.caption ?? `Foto do ${station.name}`}
            />
          </div>
        )}
        <main>
          <Header data={data} now={now} />
          <Promotions promotions={showcase.promotions} state={station.state} />
          <Prices data={data} now={now} />
          <Agreements data={data} />
          <HoursAndServices data={data} />
          <Photos data={data} />
          <Iqp data={data} />
          <Directions data={data} />
          <InTheApp data={data} />
        </main>
        <Footer siteUrl={options.officialSiteUrl} />
      </body>
    </html>,
  );
}

/** Página para endereço inexistente, posto oculto ou tirado do ar. */
export function renderUnavailablePage(): string {
  return document(
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Página indisponível · Tankei</title>
        <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      </head>
      <body>
        <main className="empty">
          <h1>Página indisponível</h1>
          <p className="muted">
            Este endereço não existe ou o posto não está disponível no Tankei.
          </p>
        </main>
      </body>
    </html>,
  );
}

function document(element: ReactNode): string {
  return `<!doctype html>${renderToStaticMarkup(element)}`;
}

/** Descrição para o Google e a prévia do WhatsApp. */
function describeStation({ station }: StationPageData): string {
  const where = [station.address, station.district, station.city]
    .filter(Boolean)
    .join(', ');
  // Os preços de hoje no resultado da busca (os três primeiros na ordem do
  // app), quando o posto mostra preços.
  const prices = FUEL_TYPES.flatMap((fuel) => {
    const price = station.prices.find((p) => p.fuelType === fuel);
    return price ? [`${FUEL_LABELS[fuel]} R$ ${formatPrice(price.price)}`] : [];
  }).slice(0, 3);
  const pricesText = prices.length > 0 ? `${prices.join(', ')}. ` : '';
  return `${pricesText}${station.name}: endereço, horário e avaliação de quem abastece. ${where} - ${station.state}.`;
}

/** Título com o que se busca: posto, cidade e preço de hoje. */
function pageTitle(station: StationPageData['station']): string {
  const place = `${station.name} em ${station.city}-${station.state}`;
  if (station.mode === 'precos_ocultos') return `${place} · Tankei`;
  const fuel = station.prices.some((p) => p.fuelType === 'gasolina_comum')
    ? 'preço da gasolina hoje'
    : 'preços de combustível hoje';
  return `${place}: ${fuel}`;
}

// ---------- Blocos ----------

function Header({ data, now }: { data: StationPageData; now: Date }) {
  const { station } = data;
  const status = openingStatus(station.hours, station.state, now);
  const notice = STATION_MODE_NOTICES[station.mode];
  return (
    <header className="station">
      <p className="brand">{station.brand}</p>
      <h1>{station.name}</h1>
      <p className="address">
        {[station.address, station.district].filter(Boolean).join(', ')} ·{' '}
        {station.city}-{station.state}
      </p>
      <div className="chips">
        {status && (
          <span className={`chip ${status.open ? 'open' : 'closed'}`}>
            {status.label}
          </span>
        )}
        <a className="chip" href="#iqp">
          {station.iqp.score === null ? (
            'IQP: sem dados'
          ) : (
            <>
              IQP {station.iqp.score}
              <span className="scale">/{IQP_SCALE_MAX}</span>
            </>
          )}
        </a>
      </div>
      {notice && <p className="notice">{notice}</p>}
    </header>
  );
}

function Promotions({
  promotions,
  state,
}: {
  promotions: Promotion[];
  state: string;
}) {
  if (promotions.length === 0) return null;
  return (
    <section id="promocoes">
      <h2>Promoções</h2>
      <div className="promos">
        {promotions.map((promotion) => (
          <article className="promo" key={promotion.id}>
            {promotion.imageUrl && (
              <img
                src={promotion.imageUrl}
                alt={`Arte da promoção ${promotion.title}`}
                loading="lazy"
              />
            )}
            <h3>{promotion.title}</h3>
            <p className="until">
              Até {formatLocalDateTime(promotion.endsAt, state)}
            </p>
            {promotion.description && <p>{promotion.description}</p>}
            {promotion.prices.length > 0 && (
              <ul className="rows">
                {promotion.prices.map((p) => (
                  <li key={p.fuelType}>
                    <span>{FUEL_LABELS[p.fuelType]}</span>
                    <PriceValue price={p.price} fuel={p.fuelType} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Prices({ data, now }: { data: StationPageData; now: Date }) {
  const { station } = data;
  // Preços ocultos (ADR 0028): o aviso no cabeçalho já explica.
  if (station.mode === 'precos_ocultos') return null;
  const byFuel = new Map(station.prices.map((p) => [p.fuelType, p]));
  const fuels = FUEL_TYPES.filter(
    (fuel) => byFuel.has(fuel) || station.fuels.includes(fuel),
  );
  if (fuels.length === 0) return null;
  return (
    <section id="precos">
      <h2>Preços</h2>
      <ul className="rows">
        {fuels.map((fuel) => {
          const price = byFuel.get(fuel);
          return (
            <li key={fuel}>
              <div>
                <div>{FUEL_LABELS[fuel]}</div>
                {price ? (
                  <PriceOrigin price={price} state={station.state} now={now} />
                ) : (
                  <div className="note">Sem preço recente</div>
                )}
              </div>
              {price && <PriceValue price={price.price} fuel={fuel} />}
            </li>
          );
        })}
      </ul>
      <p className="note">
        Preços do posto e de consumidores, com a origem de cada um. Confira na
        bomba antes de abastecer.
      </p>
    </section>
  );
}

/** Origem e idade do preço, como no app (describePrice), na hora local. */
function PriceOrigin({
  price,
  state,
  now,
}: {
  price: CurrentPrice;
  state: string;
  now: Date;
}) {
  const note = priceNote(price);
  return (
    <>
      <div className={`badge badge-${price.badge}`}>
        {price.promotion
          ? `Promoção até ${formatLocalDateTime(price.promotion.endsAt, state)}`
          : `${BADGE_LABELS[price.badge]} · ${price.stale ? 'desatualizado, ' : ''}${formatAge(price.updatedAt, now.getTime())}`}
      </div>
      {note && <div className="note">{note}</div>}
    </>
  );
}

function PriceValue({ price, fuel }: { price: number; fuel: FuelType }) {
  return (
    <span className="price">
      R$ {formatPrice(price)}
      <span className="unit">/{FUEL_UNITS[fuel]}</span>
    </span>
  );
}

function Agreements({ data }: { data: StationPageData }) {
  const { agreements } = data.station;
  if (agreements.length === 0) return null;
  return (
    <section id="convenios">
      <h2>Convênios</h2>
      <ul className="rows">
        {agreements.map((a) => (
          <li key={a.agreement.id}>
            <div>
              <h3>{a.agreement.name}</h3>
              <div className="small">
                {a.discounts
                  .map(
                    (d) => `${FUEL_LABELS[d.fuelType]} ${describeDiscount(d)}`,
                  )
                  .join(' · ')}
              </div>
              {a.note && <div className="note">{a.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HoursAndServices({ data }: { data: StationPageData }) {
  const { hours, services, charging } = data.station;
  if (!hours && services.length === 0 && !charging) return null;
  return (
    <section id="horario">
      <h2>Horário e serviços</h2>
      {hours && (
        <ul className="rows">
          {DAY_TYPES.map((type) => (
            <li key={type}>
              <span>{DAY_TYPE_LABELS[type]}</span>
              <span>{describeDay(hours[type])}</span>
            </li>
          ))}
        </ul>
      )}
      {services.length > 0 && (
        <p>
          <strong>Serviços:</strong>{' '}
          {services.map((s) => STATION_SERVICE_LABELS[s]).join(', ')}
        </p>
      )}
      {charging && charging.chargers.length > 0 && (
        <>
          <h3>Recarga elétrica</h3>
          <ul className="rows small">
            {charging.chargers.map((c, i) => (
              <li key={i}>
                <span>{describeCharger(c)}</span>
              </li>
            ))}
          </ul>
          {charging.source === 'usuarios' && (
            <p className="note">Informado por consumidores.</p>
          )}
        </>
      )}
    </section>
  );
}

function describeCharger(c: StationCharger): string {
  return [
    `${c.count ? `${c.count}× ` : ''}${CHARGER_CURRENT_LABELS[c.current]}`,
    c.powerKw ? `${c.powerKw.toLocaleString('pt-BR')} kW` : null,
    c.connector ? CONNECTOR_LABELS[c.connector] : null,
    c.access ? CHARGER_ACCESS_LABELS[c.access] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Photos({ data }: { data: StationPageData }) {
  const { photos } = data.showcase;
  if (photos.length === 0) return null;
  return (
    <section id="fotos">
      <h2>Fotos</h2>
      <div className="photos">
        {photos.map((photo) => (
          <figure key={photo.id}>
            <img
              src={photo.url}
              width={photo.width}
              height={photo.height}
              alt={photo.caption ?? `Foto do ${data.station.name}`}
              loading="lazy"
            />
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

/** IQP sempre visível e nunca editável (spec 0004, decisão 3 em aberto). */
function Iqp({ data }: { data: StationPageData }) {
  const { iqp } = data;
  return (
    <section id="iqp">
      <h2>{IQP_FULL_NAME} (IQP)</h2>
      {iqp.score === null ? (
        <p>
          Este posto ainda tem poucas avaliações: a nota aparece quando mais
          pessoas diferentes avaliarem.
        </p>
      ) : (
        <>
          <div className="iqp-score">
            {iqp.score}
            <span className="scale">/{IQP_SCALE_MAX}</span>
          </div>
          <p className="muted small">
            {iqp.confidence ? `${CONFIDENCE_LABELS[iqp.confidence]} · ` : ''}
            {iqp.reviewers === 1
              ? '1 pessoa avaliou'
              : `${iqp.reviewers} pessoas avaliaram`}
          </p>
          <ul className="dims">
            {iqp.dimensions.map((d) => (
              <li key={d.dimension}>
                <div className="small">
                  {d.label}: {d.score === null ? 'sem dados' : d.score}
                </div>
                {d.score !== null && (
                  <div className="bar">
                    <span style={{ width: `${d.score}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="note">{IQP_SUMMARY} Preço e anúncios não alteram a nota.</p>
    </section>
  );
}

function Directions({ data }: { data: StationPageData }) {
  const { location, name } = data.station;
  if (!location) return null;
  const map = mapTiles(location.lat, location.lng);
  const links = routeLinks(location.lat, location.lng);
  return (
    <section id="como-chegar">
      <h2>Como chegar</h2>
      <div
        className="map"
        role="img"
        aria-label={`Mapa com a localização do ${name}`}
      >
        <div
          className="grid"
          style={{
            left: `calc(50% - ${map.pointX}px)`,
            top: `calc(50% - ${map.pointY}px)`,
          }}
        >
          {map.tiles.map((tile) => (
            <img
              key={tile.url}
              src={tile.url}
              alt=""
              loading="lazy"
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
        </div>
        <span className="pin" />
        <a
          className="credit"
          href="https://www.openstreetmap.org/copyright"
          rel="noopener"
        >
          © OpenStreetMap
        </a>
      </div>
      <div className="actions">
        <a className="button" href={links.google} rel="noopener">
          Rota no Google Maps
        </a>
        <a className="button secondary" href={links.waze} rel="noopener">
          Rota no Waze
        </a>
      </div>
    </section>
  );
}

function InTheApp({ data }: { data: StationPageData }) {
  return (
    <section id="no-app">
      <h2>Veja este posto no Tankei</h2>
      <p>
        No app, você compara preços com os postos da região, informa o preço que
        encontrou e avalia o atendimento.
      </p>
      <div className="actions">
        <a className="button" href={`tankei://station/${data.station.id}`}>
          Abrir no app
        </a>
      </div>
    </section>
  );
}

/** Rodapé fixo: o posto não pode remover (spec 0004). */
function Footer({ siteUrl }: { siteUrl?: string }) {
  return (
    <footer id="sobre-os-dados">
      <p>
        Dados de preço e avaliação:{' '}
        {siteUrl ? <a href={`${siteUrl}/`}>Tankei</a> : 'Tankei'}.
        {siteUrl && (
          <>
            {' '}
            <a href={`${siteUrl}/como-funciona/`}>Como funciona</a>
          </>
        )}
      </p>
      <details>
        <summary>Como funcionam os preços e o IQP</summary>
        <p>
          Cada preço mostra a origem:{' '}
          {BADGE_LABELS.atualizado_posto.toLowerCase()},{' '}
          {BADGE_LABELS.confirmado_motoristas.toLowerCase()} ou{' '}
          {BADGE_LABELS.informado_motorista.toLowerCase()}, e há quanto tempo
          foi informado. Nenhum preço é apagado: correções viram um registro
          novo.
        </p>
        {IQP_EXPLANATION.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </details>
    </footer>
  );
}

// ---------- Datas ----------

/** Fuso de cada UF (o Brasil não tem horário de verão desde 2019). */
const TIME_ZONES: Record<string, string> = {
  AC: 'America/Rio_Branco',
  AM: 'America/Manaus',
  RO: 'America/Porto_Velho',
  RR: 'America/Boa_Vista',
  MT: 'America/Cuiaba',
  MS: 'America/Campo_Grande',
};

/**
 * "sáb., 15/11, 18:00" na hora do posto. O servidor roda em UTC, então as
 * funções do app (hora do aparelho) não servem aqui.
 */
export function formatLocalDateTime(iso: string, state: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONES[state] ?? 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
