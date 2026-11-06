# ADR 0030: Explicação do IQP e "Como funciona" no app

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0004 (IQP), spec 0001 (escala do IQP no app)

## Contexto

O app só explicava o IQP dentro da ficha do posto, num item fechado. A sigla não aparecia por extenso, e a pílula "IQP 86/100" da lista e do mapa não explicava nada.

## Decisão

- **Ficha do posto:** o bloco se chama "Índice de Qualidade do Posto (IQP)". "Como ler o IQP" começa dizendo o que é o índice (`IQP_SUMMARY`, também no portal).
- **Pílula do IQP** (lista e cartão do mapa): tocar abre "O que é o IQP?", com a nota do posto e o link "Como funciona".
- **Tela "Como funciona"** (pela Conta e pela janela do IQP): de onde vêm os preços, o que dizem os selos (com as cores), o aviso de divergência, o IQP, as promoções e quem informa preços.
- **Textos:** ficam no `@tankei/shared` (`help.ts`: `HOW_IT_WORKS`, `BADGE_DESCRIPTIONS`), para o app, o portal e o futuro site oficial dizerem o mesmo.
