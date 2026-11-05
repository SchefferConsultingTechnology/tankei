import { formatPrice, type CurrentPrice } from '@tankei/shared';

/** Preço com a cor da origem (ADR 0003); desatualizado fica esmaecido. */
export function PriceTag({
  price,
  large = false,
}: {
  price: CurrentPrice | null | undefined;
  large?: boolean;
}) {
  if (!price) {
    return <span className={`price-tag none${large ? ' lg' : ''}`}>—</span>;
  }
  return (
    <span
      className={`price-tag${large ? ' lg' : ''}${price.stale ? ' stale' : ''}`}
      style={{ color: `var(--badge-${price.badge})` }}
    >
      R$ {formatPrice(price.price)}
    </span>
  );
}
