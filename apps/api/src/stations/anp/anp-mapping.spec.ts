import { mapAnpProduct, mapAnpStation } from './anp-mapping';
import type { AnpPosto } from './anp-revendedores.client';

describe('mapAnpProduct', () => {
  it.each([
    ['GASOLINA C COMUM', 'gasolina_comum'],
    ['GASOLINA C COMUM ADITIVADA', 'gasolina_aditivada'],
    ['GASOLINA C PREMIUM', 'gasolina_premium'],
    ['GASOLINA C PREMIUM ADITIVADA', 'gasolina_premium'],
    ['ETANOL HIDRATADO COMUM', 'etanol'],
    ['ETANOL HIDRATADO ADITIVADO', 'etanol'],
    ['ÓLEO DIESEL B S10 - COMUM', 'diesel_s10'],
    ['ÓLEO DIESEL B S10 - ADITIVADO', 'diesel_s10'],
    ['ÓLEO DIESEL B S500 - COMUM', 'diesel_s500'],
    ['ÓLEO DIESEL B S500 - ADITIVADO', 'diesel_s500'],
    ['GÁS NATURAL VEICULAR', 'gnv'],
  ])('mapeia "%s" para %s', (produto, esperado) => {
    expect(mapAnpProduct(produto)).toBe(esperado);
  });

  it.each([
    'GASOLINA DE AVIAÇÃO',
    'QUEROSENE DE AVIAÇÃO (JET A-1)',
    'JET A',
    'QUEROSENE ILUMINANTE',
    'DMA - MGO',
  ])('ignora "%s"', (produto) => {
    expect(mapAnpProduct(produto)).toBeNull();
  });
});

describe('mapAnpStation', () => {
  const posto: AnpPosto = {
    codigoSIMP: '1027690',
    autorizacao: 'PR/SC0021217',
    razaoSocial: 'POSTO DE COMBUSTIVEL REAL PARAISO LTDA',
    cnpj: '85306728000107',
    endereco: 'RODOVIA BR 470,  10115',
    complemento: 'KM    252',
    bairro: 'GETULIO VARGAS',
    cep: '89520000',
    uf: 'SC',
    municipio: 'CURITIBANOS',
    distribuidora: 'MAXSUL',
    produtos: [
      {
        produto: 'GASOLINA C COMUM',
        tancagem: 15,
        unidMedidaTancagem: 'm³',
        qtdeBicos: 2,
      },
      {
        produto: 'ÓLEO DIESEL B S10 - COMUM',
        tancagem: 45,
        unidMedidaTancagem: 'm³',
        qtdeBicos: 2,
      },
      {
        produto: 'ÓLEO DIESEL B S10 - ADITIVADO',
        tancagem: 15,
        unidMedidaTancagem: 'm³',
        qtdeBicos: 1,
      },
    ],
    latitude: '-27.3128227',
    longitude: '-50.5875382',
    srid: '4674',
  };

  it('converte o posto e limpa espaços repetidos', () => {
    expect(mapAnpStation(posto)).toEqual({
      cnpj: '85306728000107',
      anpAuthorization: 'PR/SC0021217',
      legalName: 'POSTO DE COMBUSTIVEL REAL PARAISO LTDA',
      brand: 'MAXSUL',
      address: 'RODOVIA BR 470, 10115',
      complement: 'KM 252',
      district: 'GETULIO VARGAS',
      postalCode: '89520000',
      city: 'CURITIBANOS',
      state: 'SC',
      location: { x: -50.5875382, y: -27.3128227 },
      fuels: ['gasolina_comum', 'diesel_s10'],
    });
  });

  it('deixa a localização nula quando a ANP não informa coordenadas', () => {
    expect(
      mapAnpStation({ ...posto, latitude: '', longitude: '' })?.location,
    ).toBeNull();
  });

  it('descarta coordenadas fora do Brasil', () => {
    expect(
      mapAnpStation({ ...posto, latitude: '27.31', longitude: '50.58' })
        ?.location,
    ).toBeNull();
  });

  it('ignora posto sem combustível automotivo', () => {
    expect(
      mapAnpStation({
        ...posto,
        produtos: [
          {
            produto: 'GASOLINA DE AVIAÇÃO',
            tancagem: 15,
            unidMedidaTancagem: 'm³',
            qtdeBicos: 1,
          },
        ],
      }),
    ).toBeNull();
  });

  it('rejeita CNPJ fora do formato', () => {
    expect(() =>
      mapAnpStation({ ...posto, cnpj: '85.306.728/0001-07' }),
    ).toThrow('CNPJ inválido');
  });
});
