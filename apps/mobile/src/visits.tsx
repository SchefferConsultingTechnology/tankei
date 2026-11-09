import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  visitBatchResultSchema,
  type VisitAction,
  type VisitCloseReason,
  type VisitInput,
  type VisitSource,
} from '@tankei/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { apiRequest } from '@/api/client';
import { useAppConfig } from '@/api/queries';

/**
 * Visitas ao posto (spec 0003, ADR 0039). Uma visita começa no toque no
 * cartão (ou ao abrir a ficha direto) e termina quando o cartão fecha ou ao
 * sair da ficha. Anônima: sem conta e sem localização, só um identificador
 * aleatório desta instalação. O app junta as visitas e envia em lote.
 */

const ENABLED_KEY = 'tankei:shareVisits';
const VISITOR_KEY = 'tankei:visitorId';
const QUEUE_KEY = 'tankei:visits:queue';
/** Visita em andamento quando o app foi para segundo plano. */
const ACTIVE_KEY = 'tankei:visits:active';
/** Contribuição feita logo depois de fechar a visita ainda conta para ela. */
const LINGER_MS = 30 * 60_000;
const BATCH = 50;
const DAY_MS = 86_400_000;

interface Active {
  id: string;
  stationId: string;
  source: VisitSource;
  drivingMode: boolean;
  openedAt: string;
  detailOpenedAt: string | null;
  detailMs: number;
  /** Desde quando a ficha está em primeiro plano (nulo: pausada). */
  resumedAt: number | null;
  actions: VisitAction[];
}

/** UUID v4 (só para identificar, não é segredo). */
function uuid(): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

class VisitTracker {
  enabled = false;
  visitorId: string | null = null;
  flushSeconds = 60;
  maxDetailMs = 600_000;
  maxQueueDays = 7;
  private active: Active | null = null;
  private last: { id: string; stationId: string; closedAt: number } | null =
    null;
  private queue: VisitInput[] = [];
  private sending = false;

  // --- Ciclo da visita ---

  /** Toque num posto do mapa (o cartão abre). */
  cardOpened(stationId: string, source: VisitSource, drivingMode: boolean) {
    if (!this.enabled) return;
    if (this.active?.stationId === stationId) return;
    if (this.active) this.close('outro_posto');
    this.start(stationId, source, drivingMode);
  }

  /** O cartão fechou: a visita termina, a não ser que a ficha tenha sido aberta. */
  cardClosed(reason: VisitCloseReason) {
    if (this.active && this.active.detailOpenedAt === null) this.close(reason);
  }

  /** A ficha abriu (pelo cartão, pela lista ou direto). */
  detailOpened(stationId: string, source: VisitSource) {
    if (!this.enabled) return;
    if (this.active && this.active.stationId !== stationId) {
      this.close('outro_posto');
    }
    if (!this.active) this.start(stationId, source, false);
    const active = this.active;
    if (active && active.detailOpenedAt === null) {
      active.detailOpenedAt = new Date().toISOString();
    }
  }

  /** Ficha em primeiro plano ou não (outra tela por cima, app em segundo plano). */
  detailFocus(stationId: string, focused: boolean) {
    const active = this.active;
    if (!active || active.stationId !== stationId || !active.detailOpenedAt) {
      return;
    }
    if (focused) {
      active.resumedAt ??= Date.now();
    } else if (active.resumedAt !== null) {
      active.detailMs += Date.now() - active.resumedAt;
      active.resumedAt = null;
    }
  }

  detailLeft(stationId: string) {
    if (this.active?.stationId !== stationId) return;
    this.detailFocus(stationId, false);
    this.close('saiu_da_ficha');
  }

  action(stationId: string, action: VisitAction) {
    const active = this.active;
    if (active?.stationId === stationId && !active.actions.includes(action)) {
      active.actions.push(action);
    }
  }

  /** Visita a que um informe de preço ou avaliação deste posto pertence. */
  visitIdFor(stationId: string): string | undefined {
    if (this.active?.stationId === stationId) return this.active.id;
    if (
      this.last?.stationId === stationId &&
      Date.now() - this.last.closedAt < LINGER_MS
    ) {
      return this.last.id;
    }
    return undefined;
  }

  private start(stationId: string, source: VisitSource, drivingMode: boolean) {
    this.active = {
      id: uuid(),
      stationId,
      source,
      drivingMode,
      openedAt: new Date().toISOString(),
      detailOpenedAt: null,
      detailMs: 0,
      resumedAt: null,
      actions: [],
    };
  }

  private close(reason: VisitCloseReason) {
    const active = this.active;
    if (!active) return;
    this.active = null;
    if (active.resumedAt !== null) {
      active.detailMs += Date.now() - active.resumedAt;
    }
    this.last = { id: active.id, stationId: active.stationId, closedAt: Date.now() };
    this.enqueue(this.toInput(active, reason));
  }

  private toInput(active: Active, reason: VisitCloseReason): VisitInput {
    return {
      id: active.id,
      stationId: active.stationId,
      visitorId: this.visitorId ?? uuid(),
      source: active.source,
      drivingMode: active.drivingMode,
      openedAt: active.openedAt,
      detailOpenedAt: active.detailOpenedAt,
      detailMs: active.detailOpenedAt
        ? Math.min(Math.round(active.detailMs), this.maxDetailMs)
        : null,
      actions: active.actions,
      closeReason: reason,
    };
  }

  // --- Fila e envio ---

  private enqueue(visit: VisitInput) {
    if (!this.enabled) return;
    this.queue.push(visit);
    this.persistQueue();
  }

  private persistQueue() {
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue)).catch(
      () => undefined,
    );
  }

  async load() {
    try {
      const [enabled, visitor, queue, active] = await Promise.all([
        AsyncStorage.getItem(ENABLED_KEY),
        AsyncStorage.getItem(VISITOR_KEY),
        AsyncStorage.getItem(QUEUE_KEY),
        AsyncStorage.getItem(ACTIVE_KEY),
      ]);
      this.enabled = enabled !== 'false';
      if (!this.enabled) return;
      this.visitorId = visitor ?? uuid();
      if (!visitor) await AsyncStorage.setItem(VISITOR_KEY, this.visitorId);
      this.queue = queue ? (JSON.parse(queue) as VisitInput[]) : [];
      // O app foi fechado com uma visita aberta: termina como "segundo plano".
      if (active) {
        const snapshot = JSON.parse(active) as Active;
        snapshot.resumedAt = null;
        this.queue.push(this.toInput(snapshot, 'segundo_plano'));
        await AsyncStorage.removeItem(ACTIVE_KEY);
        this.persistQueue();
      }
    } catch {
      this.queue = [];
    }
  }

  /** Ao ir para segundo plano: pausa o tempo da ficha e guarda a visita aberta. */
  pause() {
    const active = this.active;
    if (active) {
      if (active.resumedAt !== null) {
        active.detailMs += Date.now() - active.resumedAt;
        // Volta a contar ao reabrir o app (resume), se ainda estiver na ficha.
        active.resumedAt = null;
        this.resumeOnForeground = true;
      }
      AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(active)).catch(
        () => undefined,
      );
    }
    void this.flush();
  }

  private resumeOnForeground = false;

  resume() {
    AsyncStorage.removeItem(ACTIVE_KEY).catch(() => undefined);
    if (this.resumeOnForeground && this.active) {
      this.active.resumedAt = Date.now();
    }
    this.resumeOnForeground = false;
  }

  async flush() {
    if (!this.enabled || this.sending || this.queue.length === 0) return;
    const oldest = Date.now() - this.maxQueueDays * DAY_MS;
    this.queue = this.queue.filter((v) => Date.parse(v.openedAt) >= oldest);
    const batch = this.queue.slice(0, BATCH);
    if (batch.length === 0) {
      this.persistQueue();
      return;
    }
    this.sending = true;
    try {
      await apiRequest('/telemetry/visits', visitBatchResultSchema, {
        method: 'POST',
        body: { visits: batch },
      });
      const sent = new Set(batch.map((v) => v.id));
      this.queue = this.queue.filter((v) => !sent.has(v.id));
      this.persistQueue();
    } catch {
      // Sem conexão ou API fora: tenta de novo no próximo envio.
    } finally {
      this.sending = false;
    }
  }

  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    await AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(
      () => undefined,
    );
    if (enabled) {
      this.visitorId = uuid();
      await AsyncStorage.setItem(VISITOR_KEY, this.visitorId).catch(
        () => undefined,
      );
      return;
    }
    // Desligado: apaga a fila, a visita aberta e o identificador.
    this.active = null;
    this.last = null;
    this.queue = [];
    this.visitorId = null;
    await AsyncStorage.multiRemove([QUEUE_KEY, ACTIVE_KEY, VISITOR_KEY]).catch(
      () => undefined,
    );
  }
}

/** Único rastreador do app: as telas chamam direto, sem contexto. */
export const visits = new VisitTracker();

interface ShareVisits {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const ShareVisitsContext = createContext<ShareVisits | null>(null);

/** Carrega a preferência e a fila, e envia as visitas periodicamente. */
export function VisitsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const config = useAppConfig();

  useEffect(() => {
    void visits.load().then(() => {
      setEnabledState(visits.enabled);
      void visits.flush();
    });
  }, []);

  useEffect(() => {
    if (!config.data) return;
    visits.flushSeconds = config.data.visitsFlushSeconds;
    visits.maxDetailMs = config.data.visitsMaxDetailSeconds * 1000;
    visits.maxQueueDays = config.data.visitsMaxQueueDays;
  }, [config.data]);

  const flushSeconds = config.data?.visitsFlushSeconds ?? 60;
  useEffect(() => {
    const timer = setInterval(() => void visits.flush(), flushSeconds * 1000);
    return () => clearInterval(timer);
  }, [flushSeconds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        visits.resume();
        void visits.flush();
      } else if (status === 'background') {
        visits.pause();
      }
    });
    return () => subscription.remove();
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    void visits.setEnabled(next);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return (
    <ShareVisitsContext.Provider value={value}>
      {children}
    </ShareVisitsContext.Provider>
  );
}

export function useShareVisits(): ShareVisits {
  const value = useContext(ShareVisitsContext);
  if (!value) throw new Error('VisitsProvider ausente.');
  return value;
}
