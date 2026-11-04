import Constants from 'expo-constants';
import {
  GoogleOneTapSignIn,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from 'react-native-nitro-google-signin';

let configured = false;

function configure() {
  if (configured) return;
  // Cliente Web do Google Cloud: o ID token sai emitido para ele, e a API confere (ADR 0015).
  const webClientId: unknown = Constants.expoConfig?.extra?.googleWebClientId;
  if (typeof webClientId !== 'string') {
    throw new Error('googleWebClientId ausente no app.json.');
  }
  GoogleOneTapSignIn.configure({ webClientId });
  configured = true;
}

/**
 * ID token do Google, ou `null` se a pessoa desistir. Tenta a conta já usada
 * no aparelho; sem ela, oferece as contas do Google e, por fim, a tela completa.
 */
export async function googleIdToken(): Promise<string | null> {
  configure();
  await GoogleOneTapSignIn.checkPlayServices();
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
  return isSuccessResponse(response) ? response.data.idToken : null;
}

export async function googleSignOut(): Promise<void> {
  configure();
  await GoogleOneTapSignIn.signOut();
}

/** Mensagem para a pessoa a partir de um erro do login com Google. */
export function googleErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Atualize o Google Play Services para entrar com Google.';
      case statusCodes.DEVELOPER_ERROR:
        return 'Login com Google mal configurado neste aparelho (pacote ou SHA-1).';
      case statusCodes.SIGN_IN_CANCELLED:
        return 'Login cancelado.';
    }
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível entrar com Google.';
}
