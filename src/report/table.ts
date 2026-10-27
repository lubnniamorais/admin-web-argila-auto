import { Content, TableCell } from 'pdfmake/interfaces';

// `any[]` igual ao admin-web-amip — o formato de corpo de tabela do
// pdfmake (mistura string crua e TableCell com `style`) é incômodo de
// tipar estritamente, e `noExplicitAny` é só warning neste projeto (ver
// biome.json).
let bodyTable: any[] = [];

export function columnsTitleTable(columnsTitle: string[]) {
  const columns = columnsTitle.map((column) => {
    const structureColumn: TableCell = {
      text: column,
      style: 'tableColumnTitle',
    };

    return structureColumn;
  });

  bodyTable.push(columns);
}

export function rowsTable(rows: unknown[]) {
  bodyTable.push(rows);
}

interface ITableProps {
  registerCount?: string;
  countLabel?: string;
  columnWidths?: string[];
}

// Mesma função genérica do admin-web-amip (src/report/table.ts) — monta
// a tabela a partir do que columnsTitleTable/rowsTable já empilharam em
// bodyTable (module-level, por isso cleanTableData() precisa rodar antes
// de cada novo relatório).
export function tableContent({
  registerCount = '',
  countLabel = 'registros',
  columnWidths = ['64%', '20%', '20%'],
}: ITableProps): Content {
  return [
    {
      text:
        registerCount !== '' ? `Total de ${countLabel}: ${registerCount}` : '',
      style: 'tableRegisterCount',
    },
    {
      table: {
        widths: columnWidths,
        headerRows: 1,
        body: bodyTable,
      },
      style: 'tableStyle',
      layout: {
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 7,
        paddingBottom: () => 7,
        hLineColor: (i, node) =>
          i === 0 || i === node.table.body.length ? '#FFF' : '#E4D9CE',
        vLineColor: () => '#FFF',
      },
    },
  ];
}

export function cleanTableData() {
  bodyTable = [];
}
