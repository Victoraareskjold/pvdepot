const nf0 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const nfMill = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const int = (n: number) => nf0.format(Math.round(n));
export const dec = (n: number) => nf1.format(n);

/** 1 234 567 → «1,23 mill. kr», 12 345 678 → «12,3 mill. kr», 845 000 → «845 000 kr» */
export function kr(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `${nf1.format(n / 1_000_000)} mill. kr`;
  if (abs >= 1_000_000) return `${nfMill.format(n / 1_000_000)} mill. kr`;
  return `${nf0.format(Math.round(n / 1000) * 1000)} kr`;
}

export const krExact = (n: number) => `${nf0.format(Math.round(n))} kr`;
export const pct = (n: number) => `${nf0.format(Math.round(n * 100))} %`;
