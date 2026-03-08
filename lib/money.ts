const MONEY_SCALE = 100;

export function fromStoredMoney(value: number | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Number(value) / MONEY_SCALE;
}

export function toStoredMoney(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.round(value * MONEY_SCALE);
}

export function formatEuroAmount(value: number | null | undefined): string {
  return fromStoredMoney(value).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRawEuro(value: number): string {
  if (Number.isNaN(value)) return "0,00";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
