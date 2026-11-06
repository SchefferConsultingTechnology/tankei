import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

/** Aviso de sucesso no rodapé (ADR 0022). */
export function Notice({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={5000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="filled"
        onClose={onClose}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
