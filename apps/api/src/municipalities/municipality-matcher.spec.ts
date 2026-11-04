import {
  MunicipalityMatcher,
  normalizeMunicipalityName,
} from './municipality-matcher';

describe('normalizeMunicipalityName', () => {
  it.each([
    ['São José', 'SAO JOSE'],
    ["Sant'Ana do Livramento", 'SANT ANA DO LIVRAMENTO'],
    ["Espigão D'Oeste", 'ESPIGAO D OESTE'],
    ['Pingo-d’Água', 'PINGO D AGUA'],
    ['  CURITIBANOS ', 'CURITIBANOS'],
  ])('"%s" → "%s"', (name, expected) => {
    expect(normalizeMunicipalityName(name)).toBe(expected);
  });
});

describe('MunicipalityMatcher', () => {
  const matcher = new MunicipalityMatcher(
    [
      { code: '4204806', state: 'SC', name: 'Curitibanos' },
      { code: '4216602', state: 'SC', name: 'São José' },
      { code: '3549805', state: 'SP', name: 'São José do Rio Preto' },
      { code: '4317103', state: 'RS', name: "Sant'Ana do Livramento" },
    ].map((m) => ({ ...m, normalizedName: normalizeMunicipalityName(m.name) })),
  );

  it('casa o nome da ANP, em maiúsculas e sem acento, com o IBGE', () => {
    expect(matcher.match('SC', 'SAO JOSE')).toBe('4216602');
    expect(matcher.match('SC', 'CURITIBANOS')).toBe('4204806');
  });

  it('considera a UF: mesmo nome em outro estado não casa', () => {
    expect(matcher.match('PR', 'CURITIBANOS')).toBeNull();
  });

  it('usa a tabela de grafias diferentes da ANP', () => {
    expect(matcher.match('RS', 'SANTANA DO LIVRAMENTO')).toBe('4317103');
    expect(matcher.match('RN', 'BOA SAUDE')).toBe('2405306');
  });

  it('devolve nulo para município desconhecido', () => {
    expect(matcher.match('SC', 'ATLANTIDA')).toBeNull();
  });
});
