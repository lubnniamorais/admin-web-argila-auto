// utils/validateCPF.ts
// Mesmo racional de validateCNPJ.ts (ver arquivo irmão) — algoritmo
// padrão de validação de CPF por dígito verificador (módulo 11), usado
// no campo "Documento" de Customer (cliente pessoa física), que aceita
// CPF (11 dígitos) ou CNPJ (14 dígitos) — ver validateDocument.ts, que
// escolhe qual dos dois validadores chamar conforme o tamanho digitado.
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/[^\d]+/g, '');

  if (cleaned.length !== 11) return false;

  // Elimina CPFs com todos os dígitos iguais (ex: 111.111.111-11) —
  // passariam na conta do dígito verificador, mas nunca são documentos
  // reais.
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Primeiro dígito verificador: soma dos 9 primeiros dígitos, cada um
  // multiplicado por um peso decrescente de 10 a 2.
  const calculateDigit = (slice: string, factorStart: number): number => {
    let sum = 0;
    let factor = factorStart;

    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice.charAt(i)) * factor;
      factor -= 1;
    }

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cleaned.substring(0, 9), 10);
  // Segundo dígito verificador: mesma conta, agora sobre os 10 primeiros
  // dígitos (os 9 originais + o primeiro dígito verificador já calculado).
  const secondDigit = calculateDigit(cleaned.substring(0, 10), 11);

  return (
    firstDigit === parseInt(cleaned.charAt(9)) &&
    secondDigit === parseInt(cleaned.charAt(10))
  );
}
