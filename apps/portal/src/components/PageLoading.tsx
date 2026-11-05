import LinearProgress from '@mui/material/LinearProgress';

/** Enquanto a tela (ou os dados) carrega: barra fina no topo do conteúdo. */
export function PageLoading() {
  return <LinearProgress aria-label="Carregando" sx={{ borderRadius: 1 }} />;
}
