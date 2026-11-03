/** Carrega o .env local, se existir. Em produção as variáveis vêm do ambiente. */
export function loadEnv(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
