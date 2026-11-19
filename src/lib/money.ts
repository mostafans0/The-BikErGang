// The storefront operates in Egyptian Pounds (EGP).
export function formatPrice(amountEgp: number): string {
  return `EGP ${Math.round(amountEgp).toLocaleString('en-US')}`
}
