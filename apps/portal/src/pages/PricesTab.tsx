import {
  describePrice,
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  type FuelType,
  type Station,
} from '@tankei/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useReportPrice, type PriceUpdate } from '../api/queries';
import { PriceTag } from '../components/PriceTag';

/** Preços vigentes do posto, com atualização rápida por combustível. */
export function PricesTab({ station }: { station: Station }) {
  const [editing, setEditing] = useState<FuelType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fuels = FUEL_TYPES.filter((fuel) => station.fuels.includes(fuel));

  if (fuels.length === 0) {
    return (
      <p className="card muted">
        Os combustíveis deste posto ainda não foram informados pela ANP.
      </p>
    );
  }

  return (
    <div className="stack">
      <h2 className="section-title">Atualizar preços</h2>
      {notice && (
        <p className="card" role="status" style={{ color: 'var(--success)' }}>
          {notice}
        </p>
      )}
      <ul className="list card">
        {fuels.map((fuel) => {
          const price = station.prices.find((p) => p.fuelType === fuel);
          return (
            <li key={fuel} className="stack">
              <div className="row">
                <div className="grow">
                  <strong>{FUEL_LABELS[fuel]}</strong>
                  <div className="muted">
                    {price ? describePrice(price) : 'Sem preço informado'}
                  </div>
                  {price?.promotion && (
                    <div
                      className="muted"
                      style={{ color: 'var(--badge-promocao)' }}
                    >
                      {price.promotion.label}
                    </div>
                  )}
                </div>
                <PriceTag price={price} large />
              </div>
              {editing === fuel ? (
                <PriceForm
                  stationId={station.id}
                  fuel={fuel}
                  current={price?.price}
                  onDone={(message) => {
                    setEditing(null);
                    setNotice(message);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setEditing(fuel);
                    setNotice(null);
                  }}
                >
                  Atualizar preço
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted">
        Os preços informados aqui aparecem no app com o selo “Atualizado pelo
        posto”. Correções criam um registro novo; o histórico é mantido.
      </p>
    </div>
  );
}

/** "6,29" ou "6.299" → 6.299; nulo se inválido. */
function parsePrice(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Valor para <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function PriceForm({
  stationId,
  fuel,
  current,
  onDone,
  onCancel,
}: {
  stationId: string;
  fuel: FuelType;
  current: number | undefined;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const report = useReportPrice(stationId);
  const [text, setText] = useState(current ? formatPrice(current) : '');
  const [isPromotion, setIsPromotion] = useState(false);
  const [label, setLabel] = useState('');
  const [endsAt, setEndsAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 2 * 86_400_000)),
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const price = parsePrice(text);

  function send(confirmed: boolean) {
    if (price === null) return;
    const body: PriceUpdate = { fuelType: fuel, price, confirmed };
    if (isPromotion) {
      body.promotion = {
        label: label.trim(),
        startsAt: new Date().toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };
    }
    setConfirming(null);
    report.mutate(body, {
      onSuccess: (result) => onDone(result.message),
      onError: (error) => {
        if (
          error instanceof ApiError &&
          error.code === 'CONFIRMATION_REQUIRED'
        ) {
          setConfirming(error.message);
        }
      },
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send(false);
  }

  const error =
    report.error && !confirming
      ? report.error instanceof ApiError
        ? report.error.message
        : 'Não foi possível enviar. Tente de novo.'
      : null;

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`price-${fuel}`}>Novo preço (R$ por litro)</label>
        <input
          id={`price-${fuel}`}
          className="input"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder="6,29"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      <label className="row" style={{ gap: 8 }}>
        <input
          type="checkbox"
          checked={isPromotion}
          onChange={(event) => setIsPromotion(event.target.checked)}
        />
        É um preço promocional
      </label>

      {isPromotion && (
        <div className="stack">
          <div className="field">
            <label htmlFor={`promo-${fuel}`}>Nome da promoção</label>
            <input
              id={`promo-${fuel}`}
              className="input"
              maxLength={60}
              placeholder="Semana do motorista"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`ends-${fuel}`}>Válida até</label>
            <input
              id={`ends-${fuel}`}
              className="input"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
        </div>
      )}

      {confirming ? (
        <div className="card stack" role="alert">
          <strong>Confira o valor</strong>
          <p style={{ margin: 0 }}>{confirming}</p>
          <div className="row">
            <button
              type="button"
              className="button secondary grow"
              onClick={() => setConfirming(null)}
            >
              Corrigir
            </button>
            <button
              type="button"
              className="button grow"
              onClick={() => send(true)}
            >
              Está correto
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button
            type="button"
            className="button secondary grow"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button grow"
            disabled={
              price === null ||
              report.isPending ||
              (isPromotion && !label.trim())
            }
          >
            {report.isPending ? 'Enviando…' : 'Publicar preço'}
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
