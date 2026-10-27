// utils/validateCNPJ.ts
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/[^\d]+/g, '');

  if (cleaned.length !== 14) return false;

  // Elimina CNPJs com todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação dos dígitos verificadores
  const calculateDigit = (slice: string, factor: number): number => {
    let sum = 0;
    let currentFactor = factor;

    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice.charAt(i)) * currentFactor;
      currentFactor = currentFactor === 2 ? 9 : currentFactor - 1;
    }

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cleaned.substring(0, 12), 5);
  const secondDigit = calculateDigit(cleaned.substring(0, 13), 6);

  return (
    firstDigit === parseInt(cleaned.charAt(12)) &&
    secondDigit === parseInt(cleaned.charAt(13))
  );
}
