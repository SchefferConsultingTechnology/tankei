import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// O @tankei/shared é compilado em CommonJS para a API e o app; o Rollup não lê
// os nomes reexportados desse formato. O portal usa o código-fonte TypeScript.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Uma cópia só de React (o React Router chega com outra versão do react-dom).
    dedupe: ['react', 'react-dom'],
    alias: {
      '@tankei/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
});
