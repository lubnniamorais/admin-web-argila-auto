import { Content } from 'pdfmake/interfaces';

export function footerPDF(currentPage: number, pageCount: number): Content[] {
  return [
    {
      text: `Página ${currentPage.toString()} de ${pageCount}`,
      style: 'footerPagination',
    },
  ];
}
