import { format } from '@formkit/tempo';
import { Content } from 'pdfmake/interfaces';

// "à" e "h" não são tokens do tempo (não precisam de escape); "s" de "às" e
// o "h" final de "HH:mmh" são tokens (segundo/hora), por isso escapados com
// "\\" — ver node_modules/@formkit/tempo/dist/common.mjs (escapeTokens).
function formatEmittedAt(date: Date): string {
  return format(date, 'DD/MM/YYYY à\\s HH:mm\\h', 'pt-BR');
}

// Mesmo padrão do header do admin-web-amip (src/report/header.ts) — logo
// em coluna fixa + nome/título/data em coluna flexível ao lado. Aqui o
// "nome da instituição" é o nome da OFICINA (cada relatório é dela, não
// do ArgilaAuto) — a logo é que é a marca ArgilaAuto, vindo da mesma
// variável de ambiente NEXT_PUBLIC_REPORT_IMAGE_BASE64 (ainda sem valor
// preenchido no .env — fica em branco até alguém colar o base64 da logo
// lá).
export function headerReport(title: string, workshopName: string): Content[] {
  const reportImage = process.env.NEXT_PUBLIC_REPORT_IMAGE_BASE64 ?? '';

  // A env var pode vir tanto como base64 puro quanto já como data URL
  // completa (data:image/png;base64,... ou data:image/jpeg;base64,...) —
  // evita prefixar de novo e gerar uma data URL inválida/duplicada.
  const imageSrc = reportImage.startsWith('data:')
    ? reportImage
    : `data:image/png;base64,${reportImage}`;

  return [
    {
      columns: [
        {
          image: imageSrc,
          width: 56,
        },
        {
          width: '*',
          stack: [
            {
              text: workshopName,
              style: 'institutionName',
            },
            {
              text: title,
              style: 'subtitleHeader',
            },
            {
              text: `Emitido em: ${formatEmittedAt(new Date())}`,
              style: 'headerDataAndHour',
            },
          ],
          marginLeft: 12,
        },
      ],
      style: 'headerTitle',
    },
  ];
}
