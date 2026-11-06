/**
 * Contas do consumidor (ADR 0029), puras e testáveis: etanol x gasolina e
 * a economia de ir a um posto mais barato descontando o desvio.
 */

/** Regra prática: etanol compensa até 70% do preço da gasolina. */
export const ETHANOL_RULE_RATIO = 0.7;

export interface FuelChoice {
  best: 'etanol' | 'gasolina' | 'empate';
  /** Preço do etanol dividido pelo da gasolina. */
  ratio: number;
  /** Limite usado: 70% ou a razão de consumo do carro. */
  threshold: number;
  /** Custo por km de cada um, quando o consumo do carro é conhecido. */
  costPerKm: { etanol: number; gasolina: number } | null;
  /** Economia num tanque, em reais, abastecendo com o melhor. */
  savingsPerTank: number;
}

export function chooseFuel(
  ethanolPrice: number,
  gasolinePrice: number,
  tankLiters: number,
  kmPerLiter?: { etanol: number; gasolina: number } | null,
): FuelChoice {
  const ratio = ethanolPrice / gasolinePrice;
  const threshold = kmPerLiter
    ? kmPerLiter.etanol / kmPerLiter.gasolina
    : ETHANOL_RULE_RATIO;
  const costPerKm = kmPerLiter
    ? {
        etanol: ethanolPrice / kmPerLiter.etanol,
        gasolina: gasolinePrice / kmPerLiter.gasolina,
      }
    : null;
  const diff = Math.abs(ratio - threshold);
  const best = diff < 0.005 ? 'empate' : ratio < threshold ? 'etanol' : 'gasolina';

  // Mesma distância de um tanque de gasolina, rodada com cada combustível:
  // gasolina custa tanque × preço; etanol, tanque × preço do etanol ÷ limite.
  const savingsPerTank =
    tankLiters * Math.abs(gasolinePrice - ethanolPrice / threshold);

  return { best, ratio, threshold, costPerKm, savingsPerTank };
}

export interface DetourSavings {
  /** Diferença de preço vezes o tanque. */
  gross: number;
  /** Custo estimado de ida e volta até o posto (desvio). */
  detourCost: number;
  /** Economia líquida (pode ser negativa: não vale a pena). */
  net: number;
}

/** Fator para a distância em linha reta virar distância de rua. */
export const ROAD_FACTOR = 1.3;

export function detourSavings(input: {
  thisPrice: number;
  referencePrice: number;
  tankLiters: number;
  /** Distância extra em linha reta, em metros (ida). */
  extraMeters: number;
  kmPerLiter: number;
}): DetourSavings {
  const gross = (input.referencePrice - input.thisPrice) * input.tankLiters;
  const extraKm = Math.max(0, input.extraMeters) / 1000;
  const detourCost =
    ((extraKm * 2 * ROAD_FACTOR) / input.kmPerLiter) * input.thisPrice;
  return { gross, detourCost, net: gross - detourCost };
}
