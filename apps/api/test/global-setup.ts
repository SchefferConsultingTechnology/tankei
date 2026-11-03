import { loadEnv } from '../src/load-env';

// Roda no processo principal do Jest, antes de cada arquivo de teste copiar process.env.
export default function globalSetup(): void {
  loadEnv();
}
