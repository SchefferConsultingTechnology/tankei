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
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas que mudam pouco em arquivos próprios: o navegador as
        // guarda entre versões e baixa de novo só as telas que mudaram.
        // Por pasta (e não por pacote): entra só o que as telas usam.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // O MUI fica com o empacotador: cada tela leva os componentes que
          // usa, e a entrada só os do cabeçalho e do menu.
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          if (/[\\/](@tanstack|zod)[\\/]/.test(id)) return 'data';
          return undefined;
        },
      },
    },
  },
});
