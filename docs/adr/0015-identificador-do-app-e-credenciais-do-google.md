# ADR 0015: Identificador do app e credenciais do Google

- **Status:** aceito
- **Data:** 2026-11-04
- **Complementa:** ADR 0007 (autenticação e permissões).

## Contexto

O login com Google (ADR 0007) exige registrar o app no Google Cloud. A credencial Android é ligada ao identificador do app (package name) e à impressão digital da chave que assina o APK. O identificador também é o da Play Store e da App Store e não pode ser trocado depois da publicação.

## Decisão

- **Identificador do app:** `br.com.tankei.app`, no Android (`android.package`) e no iOS (`ios.bundleIdentifier`). Se a marca mudar, o identificador continua o mesmo: ele não aparece para o usuário.
- **Projeto no Google Cloud:** "Tankei", com tela de consentimento para público externo, em modo de teste (só os usuários de teste cadastrados entram). O app pede apenas e-mail, nome e identificador da conta, que não exigem verificação do Google.
- **Clientes OAuth:**
  - **Web** ("Tankei API"): o app pede o ID token em nome dele, e a API confere que o token foi emitido para ele. O identificador fica em `GOOGLE_CLIENT_IDS` (API) e em `extra.googleWebClientId` (app.json). Não é segredo; o "segredo do cliente" não é usado.
  - **Android** ("Tankei Android (desenvolvimento)"): pacote `br.com.tankei.app` e SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, da chave de depuração padrão do Expo, que assina o APK de desenvolvimento.

## Consequências

- O login com Google não funciona no Expo Go: o app passa a precisar de um APK de desenvolvimento próprio.
- Na publicação, cria-se outro cliente Android com o SHA-1 da chave de publicação (ou da assinatura da Play Store).
- Para sair do modo de teste e abrir o login a qualquer pessoa, basta publicar a tela de consentimento; não há verificação enquanto os escopos forem só os básicos.
