import type { FuelType } from '@tankei/shared';
import type { AnpPosto } from './anp-revendedores.client';

/**
 * Converte o nome do produto da ANP no nosso tipo de combustível.
 * Versões aditivadas de etanol e diesel contam como o mesmo combustível.
 * Retorna null para o que não é combustível automotivo (aviação, querosene, marítimo).
 */
export function mapAnpProduct(produto: string): FuelType | null {
  const nome = normalize(produto);

  if (nome.startsWith('GASOLINA C PREMIUM')) return 'gasolina_premium';
  if (nome === 'GASOLINA C COMUM ADITIVADA') return 'gasolina_aditivada';
  if (nome === 'GASOLINA C COMUM') return 'gasolina_comum';
  if (nome.startsWith('ETANOL HIDRATADO')) return 'etanol';
  if (/^OLEO DIESEL B S10\b/.test(nome)) return 'diesel_s10';
  if (/^OLEO DIESEL B S500\b/.test(nome)) return 'diesel_s500';
  if (nome === 'GAS NATURAL VEICULAR') return 'gnv';
  return null;
}

export interface StationFromAnp {
  cnpj: string;
  anpAuthorization: string;
  legalName: string;
  brand: string;
  address: string;
  complement: string | null;
  district: string | null;
  postalCode: string | null;
  city: string;
  state: string;
  /** Longitude e latitude em WGS 84, ou null quando a ANP não informa. */
  location: { x: number; y: number } | null;
  fuels: FuelType[];
}

/**
 * Converte um posto da ANP no formato do nosso cadastro.
 * Retorna null quando o posto não vende nenhum combustível automotivo.
 */
export function mapAnpStation(posto: AnpPosto): StationFromAnp | null {
  const fuels = [
    ...new Set(
      (posto.produtos ?? [])
        .map((p) => mapAnpProduct(p.produto))
        .filter((f): f is FuelType => f !== null),
    ),
  ];
  if (fuels.length === 0) return null;

  if (!/^\d{14}$/.test(posto.cnpj)) {
    throw new Error(`CNPJ inválido na ANP: "${posto.cnpj}"`);
  }

  return {
    cnpj: posto.cnpj,
    anpAuthorization: posto.autorizacao.trim(),
    legalName: squash(posto.razaoSocial),
    brand: squash(posto.distribuidora),
    address: squash(posto.endereco),
    complement: optional(posto.complemento),
    district: optional(posto.bairro),
    postalCode: /^\d{8}$/.test(posto.cep) ? posto.cep : null,
    city: squash(posto.municipio),
    state: posto.uf.trim(),
    location: parseLocation(posto.latitude, posto.longitude),
    fuels,
  };
}

// A ANP usa SIRGAS 2000 (SRID 4674). Gravamos como WGS 84: para o mapa a diferença é desprezível (ADR 0005).
function parseLocation(
  latitude: string,
  longitude: string,
): { x: number; y: number } | null {
  if (!latitude.trim() || !longitude.trim()) return null;

  const y = Number(latitude);
  const x = Number(longitude);
  // Limites aproximados do território brasileiro.
  const dentroDoBrasil = y >= -34 && y <= 6 && x >= -74 && x <= -28;
  return Number.isFinite(x) && Number.isFinite(y) && dentroDoBrasil
    ? { x, y }
    : null;
}

function normalize(texto: string): string {
  return squash(texto.normalize('NFD').replace(/\p{M}/gu, '')).toUpperCase();
}

function squash(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function optional(texto: string): string | null {
  return squash(texto) || null;
}
