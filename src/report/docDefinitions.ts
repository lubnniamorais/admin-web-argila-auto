import {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

import { footerPDF } from './footer';

interface IDocDefinitionsProps {
  header: Content;
  details: Content;
  styles: StyleDictionary;
  haveFooter?: boolean;
}

// Mesmo módulo de relatório do admin-web-amip (src/report/), adaptado pra
// ArgilaAuto — decisão confirmada com o usuário: estrutura genérica
// (docDefinitions/header/footer/table) reaproveitável se outro relatório
// aparecer depois, em vez de montar o docDefinition direto na página.
export function docDefinitions({
  header,
  details,
  styles,
  haveFooter = false,
}: IDocDefinitionsProps): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [20, 40, 20, 40],
    content: [header, details],
    footer: haveFooter ? footerPDF : [],
    styles,
  };
}
