import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlined';
import HighlightOff from '@mui/icons-material/HighlightOffOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  CLAIM_POSITION_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUSES,
  VERIFICATION_METHOD_LABELS,
  type AdminClaim,
  type ClaimStatus,
  type VerificationMethod,
} from '@tankei/shared';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useClaims, useDecideClaim } from '../api/queries';

/** Formas que o administrador registra à mão (e-CNPJ e carta virão automáticas). */
const MANUAL_METHODS: VerificationMethod[] = [
  'telefone',
  'presencial',
  'documentos',
];

const STATUS_COLOR: Record<ClaimStatus, 'warning' | 'success' | 'error'> = {
  em_analise: 'warning',
  aprovado: 'success',
  recusado: 'error',
};

function formatPhone(digits: string): string {
  return digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível registrar a decisão.';
}

/** Fila de pedidos de acesso a postos (ADR 0019). */
export function ClaimsQueuePage() {
  const [status, setStatus] = useState<ClaimStatus>('em_analise');
  const claims = useClaims(status);
  // A contagem de "em análise" aparece na aba mesmo vendo outra situação.
  const pending = useClaims('em_analise');
  const [approving, setApproving] = useState<AdminClaim | null>(null);
  const [rejecting, setRejecting] = useState<AdminClaim | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Pedidos de acesso a postos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ligue para o contato, confirme que a pessoa responde pelo posto e
          registre como o vínculo foi verificado.
        </Typography>
      </Box>

      <Tabs
        value={status}
        onChange={(_, value: ClaimStatus) => setStatus(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Situação"
      >
        {CLAIM_STATUSES.map((s) => (
          <Tab
            key={s}
            value={s}
            label={
              s === 'em_analise' && (pending.data?.length ?? 0) > 0 ? (
                <Badge
                  badgeContent={pending.data?.length}
                  color="secondary"
                  sx={{ pr: 1.5 }}
                >
                  {CLAIM_STATUS_LABELS[s]}
                </Badge>
              ) : (
                CLAIM_STATUS_LABELS[s]
              )
            }
          />
        ))}
      </Tabs>

      {claims.isPending && (
        <Typography color="text.secondary">Carregando…</Typography>
      )}
      {claims.isError && <Alert severity="error">{claims.error.message}</Alert>}
      {claims.isSuccess && claims.data.length === 0 && (
        <Alert severity="info">
          {status === 'em_analise'
            ? 'Nenhum pedido aguardando análise.'
            : 'Nenhum pedido nesta situação.'}
        </Alert>
      )}
      {claims.data?.map((claim) => (
        <ClaimCard
          key={claim.id}
          claim={claim}
          onApprove={() => setApproving(claim)}
          onReject={() => setRejecting(claim)}
        />
      ))}

      {approving && (
        <ApproveDialog
          claim={approving}
          onClose={() => setApproving(null)}
          onDone={() => {
            setNotice(
              `Acesso de ${approving.contactName ?? 'pessoa'} a ${approving.station.name} aprovado.`,
            );
            setApproving(null);
          }}
        />
      )}
      {rejecting && (
        <RejectDialog
          claim={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setNotice(`Pedido para ${rejecting.station.name} recusado.`);
            setRejecting(null);
          }}
        />
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setNotice(null)}
          sx={{ width: '100%' }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {children}
      </Typography>
    </>
  );
}

function ClaimCard({
  claim,
  onApprove,
  onReject,
}: {
  claim: AdminClaim;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = claim.status === 'em_analise';

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{claim.station.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {claim.station.legalName} · CNPJ {claim.station.cnpj}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {claim.station.brand} · {claim.station.address} ·{' '}
            {claim.station.city}/{claim.station.state}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={STATUS_COLOR[claim.status]}
          label={CLAIM_STATUS_LABELS[claim.status]}
          sx={{ flexShrink: 0 }}
        />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr)',
          columnGap: 2,
          rowGap: 0.5,
          mt: 2,
        }}
      >
        <Fact label="Contato">
          {claim.contactName ?? '(conta excluída)'} ·{' '}
          {CLAIM_POSITION_LABELS[claim.position]}
        </Fact>
        <Fact label="Telefone">
          {claim.phone ? (
            <Link href={`tel:+55${claim.phone}`} sx={{ fontWeight: 600 }}>
              {formatPhone(claim.phone)}
            </Link>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label="Conta">
          {claim.account.name ?? 'Sem nome'}
          {claim.account.email ? ` · ${claim.account.email}` : ''}
        </Fact>
        <Fact label="Pedido em">
          {new Date(claim.createdAt).toLocaleString('pt-BR')}
        </Fact>
        {claim.message && <Fact label="Observação">{claim.message}</Fact>}
        {claim.decidedAt && (
          <Fact label={`${CLAIM_STATUS_LABELS[claim.status]} em`}>
            {new Date(claim.decidedAt).toLocaleString('pt-BR')}
            {claim.verificationMethod &&
              ` · ${VERIFICATION_METHOD_LABELS[claim.verificationMethod]}`}
          </Fact>
        )}
        {claim.reason && <Fact label="Motivo">{claim.reason}</Fact>}
      </Box>

      {claim.disputes.map((d) => (
        <Alert
          key={d.createdAt}
          severity="error"
          icon={<WarningAmberOutlined />}
          sx={{ mt: 2 }}
        >
          <strong>{d.by ?? 'O proprietário'}</strong>, proprietário do posto,
          não reconhece este pedido ({new Date(d.createdAt).toLocaleString('pt-BR')}
          ): {d.reason}
        </Alert>
      ))}

      {pending && claim.currentManagers > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberOutlined />}
          sx={{ mt: 2 }}
        >
          Este posto já tem {claim.currentManagers}{' '}
          {claim.currentManagers === 1
            ? 'responsável verificado'
            : 'responsáveis verificados'}
          . Confirme com o posto antes de liberar mais alguém.
        </Alert>
      )}

      {pending && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: 'flex-end', mt: 2, flexWrap: 'wrap' }}
        >
          {claim.phone && (
            <Button
              href={`tel:+55${claim.phone}`}
              startIcon={<PhoneOutlined />}
              sx={{ mr: 'auto' }}
            >
              Ligar
            </Button>
          )}
          <Button color="error" startIcon={<HighlightOff />} onClick={onReject}>
            Recusar
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckCircleOutline />}
            onClick={onApprove}
          >
            Aprovar
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

function useMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

function ApproveDialog({
  claim,
  onClose,
  onDone,
}: {
  claim: AdminClaim;
  onClose: () => void;
  onDone: () => void;
}) {
  const decide = useDecideClaim();
  const [method, setMethod] = useState<VerificationMethod>('telefone');
  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={useMobile()}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Aprovar acesso</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {claim.contactName ?? 'A pessoa'} passa a ser responsável por{' '}
          <strong>{claim.station.name}</strong> no portal, com a rede dela.
        </DialogContentText>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Como o vínculo foi confirmado?
        </Typography>
        <RadioGroup
          value={method}
          onChange={(event) =>
            setMethod(event.target.value as VerificationMethod)
          }
        >
          {MANUAL_METHODS.map((m) => (
            <FormControlLabel
              key={m}
              value={m}
              control={<Radio />}
              label={VERIFICATION_METHOD_LABELS[m]}
            />
          ))}
        </RadioGroup>
        {errorText(decide.error) && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {errorText(decide.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={decide.isPending}
          onClick={() =>
            decide.mutate(
              {
                claimId: claim.id,
                action: 'approve',
                verificationMethod: method,
              },
              { onSuccess: onDone },
            )
          }
        >
          Aprovar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RejectDialog({
  claim,
  onClose,
  onDone,
}: {
  claim: AdminClaim;
  onClose: () => void;
  onDone: () => void;
}) {
  const decide = useDecideClaim();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;
  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={useMobile()}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Recusar pedido</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {claim.station.name} · {claim.contactName ?? 'conta excluída'}
        </DialogContentText>
        <TextField
          label="Motivo"
          helperText="A pessoa vê este texto no portal."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {errorText(decide.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(decide.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!valid || decide.isPending}
          onClick={() =>
            decide.mutate(
              { claimId: claim.id, action: 'reject', reason: reason.trim() },
              { onSuccess: onDone },
            )
          }
        >
          Recusar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
