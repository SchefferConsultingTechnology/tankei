/** Nome sem acentos nem pontuação, em maiúsculas: "Sant'Ana" → "SANT ANA". */
export function normalizeMunicipalityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Municípios em que a ANP usa grafia diferente da do IBGE, ou nome antigo
 * (UF|nome normalizado da ANP → código IBGE). Levantados em 04/11/2026 sobre
 * a base nacional; cada caso conferido pelo CEP dos postos.
 */
export const ANP_MUNICIPALITY_ALIASES: Record<string, string> = {
  'BA|JEQUIRICA': '2918209', // Jiquiriçá
  'BA|MUQUEM DE SAO FRANCISCO': '2922250', // Muquém do São Francisco
  'BA|SANTA TERESINHA': '2928505', // Santa Terezinha
  'GO|BOM JESUS': '5203500', // Bom Jesus de Goiás
  'MG|BARAO DE MONTE ALTO': '3105509', // Barão do Monte Alto
  'MG|SAO THOME DAS LETRAS': '3165206', // São Tomé das Letras
  'MT|SANTO ANTONIO DO LEVERGER': '5107800', // Santo Antônio de Leverger
  'PA|SANTA ISABEL DO PARA': '1506500', // Santa Izabel do Pará
  'RN|ACU': '2400208', // Assú
  'RN|BOA SAUDE': '2405306', // Januário Cicco
  'RO|ESPIGAO DO OESTE': '1100098', // Espigão D'Oeste
  'RR|SAO LUIZ': '1400605', // São Luiz do Anauá
  'RS|SANTANA DO LIVRAMENTO': '4317103', // Sant'Ana do Livramento
  'SP|FLORINIA': '3516101', // Florínea
  'TO|COUTO DE MAGALHAES': '1706001', // Couto Magalhães
  'TO|FORTALEZA DO TABOCAO': '1708254', // Tabocão
};

export interface MunicipalityRef {
  code: string;
  state: string;
  normalizedName: string;
}

/** Liga o município informado pela ANP (nome + UF) ao código do IBGE. */
export class MunicipalityMatcher {
  private readonly byKey: Map<string, string>;

  constructor(municipalities: MunicipalityRef[]) {
    this.byKey = new Map(
      municipalities.map((m) => [`${m.state}|${m.normalizedName}`, m.code]),
    );
  }

  match(state: string, city: string): string | null {
    const key = `${state}|${normalizeMunicipalityName(city)}`;
    return ANP_MUNICIPALITY_ALIASES[key] ?? this.byKey.get(key) ?? null;
  }
}
