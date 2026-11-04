/**
 * Nome para exibição. A ANP só informa a razão social, em maiúsculas e sem
 * acentos ("CENTRO AUTOMOTIVO CURITIBANOS LTDA"). Enquanto o nome fantasia
 * não é cadastrado, a razão social é apresentada de forma legível.
 */
export function stationDisplayName(
  tradeName: string | null,
  legalName: string,
): string {
  return tradeName?.trim() || readable(stripLegalSuffix(legalName));
}

/** Bandeira legível: "BANDEIRA BRANCA" → "Bandeira Branca". */
export function brandDisplayName(brand: string): string {
  return readable(brand);
}

/** Natureza jurídica no fim da razão social. */
const LEGAL_SUFFIX =
  /(\s*[,-]\s*|\s+)(LTDA\.?|ME|EPP|EIRELI|S\/?A|S\.A\.?|MEI)(\s+(LTDA\.?|ME|EPP))?\s*$/i;

function stripLegalSuffix(name: string): string {
  return name.replace(/\s+/g, ' ').trim().replace(LEGAL_SUFFIX, '').trim();
}

const LOWERCASE = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Termos comuns em razões sociais de postos, que a ANP grava sem acento. */
const ACCENTS: Record<string, string> = {
  comercio: 'Comércio',
  combustivel: 'Combustível',
  combustiveis: 'Combustíveis',
  servicos: 'Serviços',
  conveniencia: 'Conveniência',
  automoveis: 'Automóveis',
  paraiso: 'Paraíso',
};

function readable(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      // Siglas com ponto (R.A.O.T.) ficam como estão.
      if (/^([a-z]\.)+[a-z]?\.?$/i.test(word)) return word.toUpperCase();
      if (index > 0 && LOWERCASE.has(word)) return word;
      return ACCENTS[word] ?? word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Cidade legível quando o município do IBGE não foi ligado: "SAO JOSE" →
 * "Sao Jose" (sem acentos, que a ANP não informa).
 */
export function cityDisplayName(city: string): string {
  return readable(city);
}
