export const formatAmount = (amount: number) => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(navigator.language || 'en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeAmount);
};
