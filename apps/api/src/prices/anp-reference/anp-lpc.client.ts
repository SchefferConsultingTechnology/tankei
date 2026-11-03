import { Injectable } from '@nestjs/common';
import { readSheet } from 'read-excel-file/node';
import type { SheetRow } from './resumo-parser';

/** Página do Levantamento de Preços de Combustíveis (LPC) com os resumos semanais. */
export const LPC_PAGE_URL =
  'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas';

const TIMEOUT_MS = 120_000;

@Injectable()
export class AnpLpcClient {
  /**
   * Links dos resumos semanais, na ordem da página (mais recente primeiro).
   * O nome dos arquivos não segue um padrão fixo, por isso o link vem da página.
   */
  async listarResumos(): Promise<string[]> {
    const html = await this.get(LPC_PAGE_URL).then((r) => r.text());
    const links = [
      ...html.matchAll(/href="([^"]*resumo_semanal_lpc[^"]*\.xlsx)"/gi),
    ].map((m) => new URL(m[1], LPC_PAGE_URL).toString());
    return [...new Set(links)];
  }

  /** Linhas da aba ESTADOS de um resumo semanal. */
  async baixarEstados(url: string): Promise<SheetRow[]> {
    const resposta = await this.get(url);
    const arquivo = Buffer.from(await resposta.arrayBuffer());
    // A tipagem do read-excel-file declara datas como `typeof Date` (o construtor),
    // mas os valores são instâncias de Date.
    return (await readSheet(arquivo, 'ESTADOS')) as unknown as SheetRow[];
  }

  private async get(url: string): Promise<Response> {
    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) {
      throw new Error(`ANP respondeu ${resposta.status} em ${url}`);
    }
    return resposta;
  }
}
