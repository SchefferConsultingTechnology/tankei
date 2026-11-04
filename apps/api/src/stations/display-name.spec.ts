import { brandDisplayName, stationDisplayName } from './display-name';

describe('stationDisplayName', () => {
  it('prefere o nome fantasia cadastrado', () => {
    expect(stationDisplayName('Posto do Zé', 'JOSE DA SILVA LTDA')).toBe(
      'Posto do Zé',
    );
  });

  it.each([
    ['CENTRO AUTOMOTIVO CURITIBANOS LTDA', 'Centro Automotivo Curitibanos'],
    ['AUTO POSTO R.A.O.T. LTDA', 'Auto Posto R.A.O.T.'],
    [
      'ZUZU COMERCIO DE COMBUSTIVEIS CURITIBANOS LTDA',
      'Zuzu Comércio de Combustíveis Curitibanos',
    ],
    [
      'POSTO DE COMBUSTIVEL REAL PARAISO LTDA',
      'Posto de Combustível Real Paraíso',
    ],
    ['GERHARDT & PELEGRINI LTDA', 'Gerhardt & Pelegrini'],
    ['AUTO POSTO FREI LTDA', 'Auto Posto Frei'],
    ['POSTO EXEMPLO EIRELI', 'Posto Exemplo'],
    ['POSTO EXEMPLO LTDA ME', 'Posto Exemplo'],
    ['POSTO EXEMPLO S/A', 'Posto Exemplo'],
  ])('"%s" → "%s"', (legalName, expected) => {
    expect(stationDisplayName(null, legalName)).toBe(expected);
  });

  it('ignora nome fantasia vazio', () => {
    expect(stationDisplayName('  ', 'AUTO POSTO FREI LTDA')).toBe(
      'Auto Posto Frei',
    );
  });
});

describe('brandDisplayName', () => {
  it.each([
    ['BANDEIRA BRANCA', 'Bandeira Branca'],
    ['IPIRANGA', 'Ipiranga'],
    ['RAIZEN MIME', 'Raizen Mime'],
  ])('"%s" → "%s"', (brand, expected) => {
    expect(brandDisplayName(brand)).toBe(expected);
  });
});
