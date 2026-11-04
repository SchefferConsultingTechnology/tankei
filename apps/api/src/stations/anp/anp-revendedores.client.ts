import { Injectable } from '@nestjs/common';

/**
 * Cliente da API Revendedores da ANP (pública, sem autenticação).
 * Swagger: https://revendedoresapi.anp.gov.br/swagger/index.html
 */
const BASE_URL = 'https://revendedoresapi.anp.gov.br/v1';
const TIMEOUT_MS = 120_000;

export interface AnpProduto {
  produto: string;
  tancagem: number;
  unidMedidaTancagem: string;
  qtdeBicos: number;
}

/** Campos usados da consulta de postos. Coordenadas vêm como texto e podem ser vazias. */
export interface AnpPosto {
  codigoSIMP: string;
  autorizacao: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  distribuidora: string;
  produtos: AnpProduto[] | null;
  latitude: string;
  longitude: string;
  srid: string;
}

interface AnpResposta {
  succeeded: boolean;
  title: string;
  data: AnpPosto[] | null;
  searchPageFilter: { numeroPagina: number; totalPagina: number };
}

/** Recorte da importação: um município (com UF), uma UF ou, vazio, o Brasil. */
export interface AnpFiltro {
  uf?: string;
  municipio?: string;
}

@Injectable()
export class AnpRevendedoresClient {
  /** Postos de combustíveis em operação no recorte (percorre as páginas). */
  async listarPostos(filtro: AnpFiltro = {}): Promise<AnpPosto[]> {
    if (filtro.municipio && !filtro.uf) {
      throw new Error('Informe a UF junto com o município.');
    }
    const postos: AnpPosto[] = [];
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const url = new URL(`${BASE_URL}/combustivel`);
      if (filtro.uf) url.searchParams.set('uf', filtro.uf);
      if (filtro.municipio) url.searchParams.set('municipio', filtro.municipio);
      url.searchParams.set('numeropagina', String(pagina));

      if (pagina > 1) await this.wait(this.timing.pageIntervalMs);
      const resposta = await this.fetchWithRetry(url);

      const corpo = (await resposta.json()) as AnpResposta;
      if (!corpo.succeeded) {
        throw new Error(`API da ANP retornou erro: ${corpo.title}`);
      }

      postos.push(...(corpo.data ?? []));
      totalPaginas = corpo.searchPageFilter.totalPagina;
      pagina++;
    } while (pagina <= totalPaginas);

    return postos;
  }

  /** Esperas configuráveis só para os testes não demorarem. */
  timing = {
    pageIntervalMs: 2_000,
    retryBaseMs: 5_000,
    maxAttempts: 5,
  };

  /**
   * A ANP limita a frequência de chamadas (429) e às vezes falha
   * temporariamente (5xx): tenta de novo com espera crescente, respeitando o
   * Retry-After quando vier.
   */
  private async fetchWithRetry(url: URL): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const temporary = resposta.status === 429 || resposta.status >= 500;
      if (resposta.ok || !temporary || attempt >= this.timing.maxAttempts) {
        if (!resposta.ok) {
          throw new Error(`API da ANP respondeu ${resposta.status} em ${url}`);
        }
        return resposta;
      }
      const retryAfter = Number(resposta.headers.get('retry-after'));
      await this.wait(
        retryAfter > 0
          ? retryAfter * 1000
          : this.timing.retryBaseMs * 2 ** (attempt - 1),
      );
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
