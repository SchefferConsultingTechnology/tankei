# ADR 0029: Recursos do consumidor no app

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0006 (parâmetros), 0009 (privacidade), 0024 (confiança), 0025 (e-mails)

## Contexto

Diferenciais do app escolhidos pelo autor:
- calculadora etanol x gasolina;
- postos favoritos e alerta de preço;
- "vale a pena ir até lá?";
- reconhecimento de quem informa preços.

## Decisão

- **Etanol ou gasolina?** (tela própria, atalho na tela inicial e na ficha do posto):
  - **Preços:** já vêm preenchidos (os menores da região, ou os do posto) e podem ser editados.
  - **Conta:** com o consumo do carro, compara o custo por km; sem ele, usa a regra prática dos 70%. Mostra a economia na distância de um tanque.
  - **Onde roda:** a conta é feita no aparelho.
- **Meu carro** (em Conta): tanque e consumo com gasolina e etanol, guardados **só no aparelho** (AsyncStorage). Não é dado do servidor.
- **Favoritos:** estrela na ficha do posto e tela de Favoritos (atalho no cabeçalho). Ficam na conta (`favorite_stations`), para valer em qualquer aparelho.
- **Alerta de preço:**
  - **Regra:** "avise quando o preço exibido de um combustível no posto ficar igual ou abaixo de R$ X".
  - **Conferência:** quando o preço do posto pode ter mudado (novo informe ou promoção). O serviço de preços avisa os ouvintes, sem dependência circular.
  - **Envio:** **por e-mail** (Resend, ADR 0025), no máximo um por alerta a cada `alert.min_interval_hours` (24 h).
  - **Notificação no celular:** fica para depois. No Android, exige um projeto no Firebase (FCM).
- **"Vale a pena ir até lá?"** (na ficha do posto, com a localização real):
  - **Comparação:** com o posto com preço mais perto da pessoa.
  - **Desvio:** ida e volta, com a distância em linha reta × 1,3 e o consumo do carro (ou 10 km/l).
  - **Resultado:** a economia líquida num tanque cheio. A conta é feita no aparelho; a posição não vai para o servidor.
- **Sua contribuição** (em Conta, visível só para a própria pessoa):
  - **Números:** preços aceitos, informes nos últimos 30 dias e postos ajudados.
  - **Selo:**
    - **Iniciante:** conta ainda não confiável (ADR 0024).
    - **Colaborador:** conta confiável.
    - **Informante confiável:** pelo menos `contributor.reliable_min_reports` (20) informes aceitos, sem informe anulado nos últimos 90 dias.
- **Limites em parâmetros:** `favorite.max_per_user` (50), `alert.max_per_user` (20), `alert.min_interval_hours` (24) e `contributor.reliable_min_reports` (20).
- **Exclusão de conta:** apaga favoritos e alertas (ADR 0009).

## Consequências

- Favoritos e alertas exigem conta. A calculadora e "Meu carro" funcionam sem login.
- Alerta por e-mail cobre o piloto. A notificação no celular entra quando houver projeto no Firebase.
- Os textos do selo são incentivo, não ranking público: ninguém vê a contribuição de outra pessoa.
