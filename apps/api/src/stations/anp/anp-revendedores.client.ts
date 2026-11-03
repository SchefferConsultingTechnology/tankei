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

@Injectable()
export class AnpRevendedoresClient {
  /** Todos os postos de combustíveis em operação no município (percorre as páginas). */
  async listarPostos(uf: string, municipio: string): Promise<AnpPosto[]> {
    const postos: AnpPosto[] = [];
    let pagina = 1;
    let totalPaginas = 1;

    do {
      const url = new URL(`${BASE_URL}/combustivel`);
      url.searchParams.set('uf', uf);
      url.searchParams.set('municipio', municipio);
      url.searchParams.set('numeropagina', String(pagina));

      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        throw new Error(`API da ANP respondeu ${resposta.status} em ${url}`);
      }

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
}
