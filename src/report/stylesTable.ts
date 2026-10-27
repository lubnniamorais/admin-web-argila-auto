import { StyleDictionary } from 'pdfmake/interfaces';

// Mesma estrutura de estilos do admin-web-amip (src/report/stylesTable.ts),
// com as cores trocadas pros tokens do ArgilaAuto (ver CLAUDE.md >
// "Identidade visual"). pdfmake não lê CSS/var() — os valores aqui têm que
// ser o hex cru dos tokens do MODO CLARO (um PDF impresso não tem "modo
// escuro").
export const stylesTable: StyleDictionary = {
  headerTitle: {
    fontSize: 18,
    bold: true,
    margin: [0, 0, 0, 0],
    color: '#2B2420', // --text
  },
  // Nome da oficina, ao lado da logo no cabeçalho.
  institutionName: {
    fontSize: 11,
    bold: true,
    color: '#8A431F', // --clay-deep
  },
  subtitleHeader: {
    fontSize: 14,
    marginTop: 6,
    bold: true,
    color: '#2B2420', // --text
  },
  headerDataAndHour: {
    fontSize: 9,
    marginTop: 4,
    color: '#6B5C50', // --text-muted
  },
  tableRegisterCount: {
    alignment: 'right',
    margin: [0, 24, 5, 5],
    color: '#6B5C50', // --text-muted
  },
  tableStyle: {
    margin: [0, 0, 20, 15],
  },
  tableColumnTitle: {
    fontSize: 11,
    bold: true,
    fillColor: '#8A431F', // --clay-deep
    color: '#FFFFFF',
  },
  // Pagamento confirmado (PAID) — destaque verde, mesmo racional do AMIP
  // (bom/ruim visualmente escaneável). CANCELED (estornado) em vermelho,
  // pra chamar atenção na auditoria. Nenhum pagamento PENDING aparece
  // nesta lista de propósito — o relatório filtra por paidAt, que só
  // existe depois de confirmado (ver ShowServiceOrderPaymentsReportUseCase
  // na API).
  tableStatusOk: {
    bold: true,
    color: '#2E8B57', // --good
  },
  tableStatusAlert: {
    bold: true,
    color: '#B23A3A', // --crit
  },
  tableStatusPending: {
    bold: true,
    color: '#3E7CB8', // --info
  },
  footerPagination: {
    fontSize: 9,
    alignment: 'right',
    margin: [0, 10, 20, 40],
    marginTop: 20,
    bold: true,
  },
};
