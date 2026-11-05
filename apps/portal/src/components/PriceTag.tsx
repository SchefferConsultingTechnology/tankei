import Box from '@mui/material/Box';
import { formatPrice, type CurrentPrice } from '@tankei/shared';

/**
 * Preço com a cor da origem (ADR 0003); desatualizado fica esmaecido; sem
 * preço, traço. As cores das origens vêm das variáveis do tema (index.css),
 * as mesmas do app.
 */
export function PriceTag({
  price,
  large = false,
}: {
  price: CurrentPrice | null | undefined;
  large?: boolean;
}) {
  const color = price ? `var(--badge-${price.badge})` : 'text.secondary';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        border: '1.5px solid',
        borderColor: price ? color : 'divider',
        borderRadius: 1.5,
        color,
        fontWeight: 700,
        fontSize: large ? '1.25rem' : '1rem',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        lineHeight: 1.5,
        opacity: price?.stale ? 0.55 : 1,
      }}
    >
      {price ? `R$ ${formatPrice(price.price)}` : '—'}
    </Box>
  );
}
