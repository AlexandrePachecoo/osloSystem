// Geração do PDF do relatório da portaria com pdf-lib (JS puro — funciona em
// serverless sem binários). Usa fontes padrão (Helvetica, encoding WinAnsi):
// acentos do pt-BR passam; qualquer caractere fora do encoding é removido
// para o encode nunca lançar.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { formatarData } from '@/lib/format';
import {
  agruparJornaisPorTorre,
  type DadosRelatorioPortaria,
  type EncomendaSnapshot,
} from '@/lib/portaria';

const A4 = { width: 595.28, height: 841.89 };
const MARGEM = 50;
const LARGURA_UTIL = A4.width - MARGEM * 2;

// Mantém ASCII imprimível, Latin-1 (acentos pt-BR) e a pontuação tipográfica
// que o WinAnsi cobre (travessão, aspas curvas, reticências, bullet, euro).
function sanitizar(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(
      /[^\n\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g,
      '',
    );
}

class EscritorPdf {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private doc: PDFDocument,
    private fonte: PDFFont,
    private fonteBold: PDFFont,
  ) {
    this.novaPagina();
  }

  private novaPagina() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGEM;
  }

  private garantirEspaco(altura: number) {
    if (this.y - altura < MARGEM) this.novaPagina();
  }

  private quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
    const linhas: string[] = [];
    for (const paragrafo of texto.split('\n')) {
      let atual = '';
      for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
          atual = tentativa;
          continue;
        }
        if (atual) linhas.push(atual);
        // palavra maior que a linha: corta no que couber
        let resto = palavra;
        while (fonte.widthOfTextAtSize(resto, tamanho) > largura && resto.length > 1) {
          let corte = resto.length - 1;
          while (corte > 1 && fonte.widthOfTextAtSize(resto.slice(0, corte), tamanho) > largura) {
            corte--;
          }
          linhas.push(resto.slice(0, corte));
          resto = resto.slice(corte);
        }
        atual = resto;
      }
      linhas.push(atual);
    }
    return linhas;
  }

  texto(
    conteudo: string,
    opts: { tamanho?: number; bold?: boolean; recuo?: number; cinza?: boolean } = {},
  ) {
    const tamanho = opts.tamanho ?? 10;
    const fonte = opts.bold ? this.fonteBold : this.fonte;
    const recuo = opts.recuo ?? 0;
    const largura = LARGURA_UTIL - recuo;
    const alturaLinha = tamanho * 1.45;

    for (const linha of this.quebrarLinhas(sanitizar(conteudo), fonte, tamanho, largura)) {
      this.garantirEspaco(alturaLinha);
      this.page.drawText(linha, {
        x: MARGEM + recuo,
        y: this.y - tamanho,
        size: tamanho,
        font: fonte,
        color: opts.cinza ? rgb(0.42, 0.45, 0.5) : rgb(0.1, 0.12, 0.16),
      });
      this.y -= alturaLinha;
    }
  }

  espaco(altura = 10) {
    this.y -= altura;
  }

  divisor() {
    this.garantirEspaco(14);
    this.page.drawLine({
      start: { x: MARGEM, y: this.y - 4 },
      end: { x: A4.width - MARGEM, y: this.y - 4 },
      thickness: 0.5,
      color: rgb(0.8, 0.83, 0.87),
    });
    this.y -= 14;
  }
}

function linhaEncomenda(e: EncomendaSnapshot): string {
  const tipo = e.tipo === 'externa' ? `externa — retirada por ${e.retiradaPor ?? '?'}` : 'interna';
  const baixa = e.entregueEm ? ` — entregue em ${formatarData(new Date(e.entregueEm))}` : '';
  return `Apto ${e.apto} — ${e.descricao} (${tipo}) — recebida em ${formatarData(
    new Date(e.registradaEm),
  )} por ${e.colaborador}${baixa}`;
}

export async function gerarPdfRelatorioPortaria(params: {
  subtitulo: string;
  dados: DadosRelatorioPortaria;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new EscritorPdf(doc, fonte, fonteBold);
  const { dados } = params;

  w.texto('Relatório da portaria', { tamanho: 18, bold: true });
  w.espaco(2);
  w.texto('Oslo — Administração de condomínio', { tamanho: 10, cinza: true });
  w.texto(params.subtitulo, { tamanho: 10, cinza: true });
  w.divisor();

  w.texto(`Ocorrências (${dados.ocorrencias.length})`, { tamanho: 13, bold: true });
  w.espaco(4);
  if (dados.ocorrencias.length === 0) {
    w.texto('Sem ocorrências no período.', { cinza: true });
  } else {
    for (const o of dados.ocorrencias) {
      w.texto(`${formatarData(new Date(o.registradaEm))} — ${o.colaborador}`, {
        tamanho: 9,
        cinza: true,
      });
      w.texto(o.texto, { recuo: 12 });
      w.espaco(8);
    }
  }
  w.divisor();

  w.texto(`Encomendas entregues (${dados.entregues.length})`, { tamanho: 13, bold: true });
  w.espaco(4);
  if (dados.entregues.length === 0) {
    w.texto('Nenhuma entrega baixada no período.', { cinza: true });
  } else {
    for (const e of dados.entregues) {
      w.texto(`• ${linhaEncomenda(e)}`, { recuo: 4 });
      w.espaco(4);
    }
  }
  w.divisor();

  const jornais = dados.jornais ?? [];
  w.texto('Jornais entregues', { tamanho: 13, bold: true });
  w.espaco(4);
  if (jornais.length === 0) {
    w.texto('Nenhum jornal entregue no período.', { cinza: true });
  } else {
    for (const [torre, doTorre] of agruparJornaisPorTorre(jornais)) {
      if (torre) {
        w.texto(`Torre ${torre}`, { tamanho: 11, bold: true });
        w.espaco(2);
      }
      for (const j of doTorre) {
        w.texto(`${j.nome}: ${j.aptosEntregues.join(', ')}`, { recuo: 4 });
        w.espaco(2);
      }
      w.espaco(4);
    }
  }
  w.divisor();

  w.texto(`Encomendas aguardando retirada (${dados.pendentes.length})`, {
    tamanho: 13,
    bold: true,
  });
  w.espaco(4);
  if (dados.pendentes.length === 0) {
    w.texto('Nenhuma encomenda pendente.', { cinza: true });
  } else {
    for (const e of dados.pendentes) {
      w.texto(`• ${linhaEncomenda(e)}`, { recuo: 4 });
      w.espaco(4);
    }
    w.espaco(4);
    w.texto('Encomendas pendentes seguem automaticamente para o próximo relatório.', {
      tamanho: 9,
      cinza: true,
    });
  }

  return doc.save();
}
