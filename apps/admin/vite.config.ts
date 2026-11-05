import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Como no portal: o @tankei/shared entra pelo código-fonte TypeScript (o
// pacote compilado é CommonJS) e há uma cópia só de React.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@tankei/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
});
