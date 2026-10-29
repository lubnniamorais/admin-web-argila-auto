// utils/validateDocument.ts
import { validateCNPJ } from './validateCNPJ';
import { validateCPF } from './validateCPF';

// Campo "Documento" de Customer (ver api-argila-auto/openapi.yaml,
// schema Customer) aceita cliente pessoa física (CPF, 11 dígitos) OU
// pessoa jurídica (CNPJ, 14 dígitos) — mesmo campo único na API, sem
// flag separada indicando qual tipo é. O formulário usa uma máscara
// dinâmica no InputMask (ver InputMaskFormControl) que já só deixa
// chegar aqui 11 ou 14 dígitos "fechados"; esta função decide qual
// validador de dígito verificador aplicar, e só devolve `true` pra um
// documento realmente válido nos dois formatos.
export function validateDocument(document: string): boolean {
  const cleaned = document.replace(/[^\d]+/g, '');

  if (cleaned.length === 11) {
    return validateCPF(cleaned);
  }

  if (cleaned.length === 14) {
    return validateCNPJ(cleaned);
  }

  return false;
}
