import {
  formatDistance,
  formatPrice,
  formatUntil,
  FUEL_LABELS,
  type Competitor,
} from '@tankei/shared';
import { useCompetition } from '../api/queries';
import { useStationContext } from './station-context';

/** Promoções vigentes dos postos no raio máximo (o que o app já mostra). */
export function CompetitorPromotionsPage() {
  const { station } = useStationContext();
  const competition = useCompetition(station.id);

  if (competition.isPending) return <p className="muted">Carregando…</p>;
  if (competition.isError) {
    return <p className="error">{competition.error.message}</p>;
  }

  // Um posto com promoção em vários combustíveis aparece agrupado.
  const byStation = new Map<
    string,
    {
      station: Competitor;
      offers: { fuel: string; price: number; label: string; endsAt: string }[];
    }
  >();
  for (const fuel of competition.data.fuels) {
    for (const c of fuel.nearby) {
      if (!c.price.promotion) continue;
      const entry = byStation.get(c.id) ?? { station: c, offers: [] };
      entry.offers.push({
        fuel: FUEL_LABELS[fuel.fuelType],
        price: c.price.price,
        label: c.price.promotion.label,
        endsAt: c.price.promotion.endsAt,
      });
      byStation.set(c.id, entry);
    }
  }
  const promotions = [...byStation.values()].sort(
    (a, b) => a.station.distanceMeters - b.station.distanceMeters,
  );

  return (
    <div className="stack">
      <h2 className="section-title">Promoções da concorrência</h2>
      <p className="muted" style={{ margin: 0 }}>
        Postos a até {formatDistance(competition.data.radiusMeters)} com preço
        promocional vigente no app.
      </p>
      {promotions.length === 0 ? (
        <p className="card muted">Nenhuma promoção vigente na região.</p>
      ) : (
        <ul className="list card">
          {promotions.map(({ station: s, offers }) => (
            <li key={s.id} className="stack" style={{ gap: 4 }}>
              <div>
                <strong>{s.name}</strong>
                <div className="muted">
                  {s.brand} · {formatDistance(s.distanceMeters)}
                </div>
              </div>
              {offers.map((o) => (
                <div key={o.fuel} className="row">
                  <span className="grow">
                    {o.fuel} · “{o.label}” · {formatUntil(o.endsAt)}
                  </span>
                  <span
                    className="price-tag"
                    style={{ color: 'var(--badge-promocao)' }}
                  >
                    R$ {formatPrice(o.price)}
                  </span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
