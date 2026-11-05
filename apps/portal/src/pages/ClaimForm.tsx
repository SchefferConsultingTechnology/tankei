import {
  BRAZIL_STATES,
  CLAIM_POSITION_LABELS,
  CLAIM_POSITIONS,
  type ClaimableStation,
  type ClaimPosition,
  type Me,
} from '@tankei/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useClaimSearch, useCreateClaim } from '../api/queries';

/** Atraso da busca enquanto a pessoa digita. */
const SEARCH_DELAY_MS = 350;

/** Pedido de acesso em dois passos: achar o posto e informar o contato. */
export function ClaimForm({
  user,
  onCancel,
  onSent,
}: {
  user: Me;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [station, setStation] = useState<ClaimableStation | null>(null);

  return (
    <section className="stack">
      <h1 className="page-title">Reivindicar posto</h1>
      <p className="muted" style={{ margin: 0 }}>
        Passo {station ? 2 : 1} de 2 ·{' '}
        {station ? 'Seus dados para contato' : 'Encontre o posto'}
      </p>
      {station ? (
        <ContactStep
          user={user}
          station={station}
          onBack={() => setStation(null)}
          onSent={onSent}
        />
      ) : (
        <SearchStep onPick={setStation} onCancel={onCancel} />
      )}
    </section>
  );
}

function SearchStep({
  onPick,
  onCancel,
}: {
  onPick: (station: ClaimableStation) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const search = useClaimSearch(query, state);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const ready = query.trim().length >= 3;
  const results = search.data ?? [];

  return (
    <div className="stack">
      <div className="card stack">
        <div className="field">
          <label htmlFor="claim-q">CNPJ ou nome do posto</label>
          <input
            id="claim-q"
            className="input"
            autoFocus
            autoComplete="off"
            placeholder="00.000.000/0000-00 ou Posto Exemplo"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-state">Estado (para buscar pelo nome)</label>
          <select
            id="claim-state"
            className="input"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">Todos</option>
            {BRAZIL_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {search.isError && <p className="error">{search.error.message}</p>}
      {ready && search.isFetching && <p className="muted">Buscando…</p>}
      {ready && search.isSuccess && results.length === 0 && (
        <p className="card muted">
          Nenhum posto encontrado. Confira o CNPJ (está na nota fiscal) ou tente
          parte do nome.
        </p>
      )}

      {results.length > 0 && (
        <ul className="list card">
          {results.map((station) => (
            <li key={station.id}>
              <button
                type="button"
                className="pick"
                onClick={() => onPick(station)}
              >
                <strong>{station.name}</strong>
                <span className="muted">
                  {station.legalName} · CNPJ {station.cnpj}
                </span>
                <span className="muted">
                  {station.brand} · {station.address} · {station.city}/
                  {station.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="button secondary" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}

function ContactStep({
  user,
  station,
  onBack,
  onSent,
}: {
  user: Me;
  station: ClaimableStation;
  onBack: () => void;
  onSent: () => void;
}) {
  const create = useCreateClaim();
  const [contactName, setContactName] = useState(user.name ?? '');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState<ClaimPosition | null>(null);
  const [message, setMessage] = useState('');

  const phoneDigits = phone.replace(/\D/g, '');
  const valid =
    contactName.trim().length >= 3 &&
    (phoneDigits.length === 10 || phoneDigits.length === 11) &&
    position !== null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !position) return;
    create.mutate(
      {
        stationId: station.id,
        contactName: contactName.trim(),
        phone,
        position,
        message: message.trim() || undefined,
      },
      { onSuccess: onSent },
    );
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="card stack" style={{ gap: 4 }}>
        <strong>{station.name}</strong>
        <span className="muted">
          {station.legalName} · CNPJ {station.cnpj}
        </span>
        <span className="muted">
          {station.address} · {station.city}/{station.state}
        </span>
        <button
          type="button"
          className="button ghost"
          style={{ justifySelf: 'start', paddingLeft: 0 }}
          onClick={onBack}
        >
          Trocar posto
        </button>
      </div>

      <div className="card stack">
        <div className="field">
          <label htmlFor="claim-name">Seu nome</label>
          <input
            id="claim-name"
            className="input"
            autoComplete="name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-phone">Telefone com DDD</label>
          <input
            id="claim-phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(49) 99999-9999"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="field">
          <span
            id="claim-position"
            style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}
          >
            Seu cargo no posto
          </span>
          <div
            className="segmented"
            role="radiogroup"
            aria-labelledby="claim-position"
          >
            {CLAIM_POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={position === p}
                onClick={() => setPosition(p)}
              >
                {CLAIM_POSITION_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="claim-message">Observação (opcional)</label>
          <input
            id="claim-message"
            className="input"
            maxLength={500}
            placeholder="Melhor horário para ligar, por exemplo"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        A equipe Tankei liga nesse número para confirmar que você responde pelo
        posto. O telefone não aparece para ninguém além da equipe.
      </p>

      {create.error && (
        <p className="error">
          {create.error instanceof ApiError
            ? create.error.message
            : 'Não foi possível enviar. Tente de novo.'}
        </p>
      )}

      <button
        type="submit"
        className="button"
        disabled={!valid || create.isPending}
      >
        {create.isPending ? 'Enviando…' : 'Enviar pedido'}
      </button>
    </form>
  );
}
