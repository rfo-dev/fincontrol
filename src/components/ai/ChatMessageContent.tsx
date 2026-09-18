import React from 'react';

type Props = {
  content: string;
  tone?: 'assistant' | 'user';
};

type Block =
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

function normalizeNewlines(text: string): string {
  let value = text.replace(/\r\n/g, '\n');

  // Model sometimes emits markdown tables without line breaks between rows.
  if (value.includes('|') && !value.includes('\n|') && (value.match(/\|/g) || []).length >= 6) {
    value = value.replace(/\|\|/g, '|\n|');
  }

  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')));
}

function parseBlocks(content: string): Block[] {
  const lines = normalizeNewlines(content).split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }

      const parsedRows = tableLines
        .map(splitCells)
        .filter((cells) => cells.some((cell) => cell.length > 0));

      if (parsedRows.length >= 2) {
        const headers = parsedRows[0];
        const body = parsedRows.slice(1).filter((row) => !isSeparatorRow(row));
        if (body.length > 0) {
          blocks.push({ type: 'table', headers, rows: body });
          continue;
        }
      }

      blocks.push({ type: 'paragraph', text: tableLines.join('\n') });
      continue;
    }

    if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, '').trim());
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('|') &&
      !/^\s*([-*•]|\d+\.)\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function pickCell(row: string[], headers: string[], aliases: string[]): string | undefined {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const alias of aliases) {
    const idx = lowerHeaders.findIndex((h) => h.includes(alias));
    if (idx >= 0 && row[idx]) return row[idx];
  }
  return undefined;
}

function TableCards({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="space-y-2">
      {rows.map((row, rowIndex) => {
        const description =
          pickCell(row, headers, ['descri', 'nome', 'lançamento', 'item']) || row[0] || '—';
        const amount = pickCell(row, headers, ['valor', 'amount', 'total']);
        const date = pickCell(row, headers, ['data', 'date']);
        const category = pickCell(row, headers, ['categ']);
        const status = pickCell(row, headers, ['status', 'pago', 'recebido']);
        const meta = [date, category, status].filter(Boolean);

        return (
          <div
            key={`row-${rowIndex}`}
            className="rounded-xl border border-mist-line/80 bg-mist/50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink">{description}</p>
              {amount && (
                <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{amount}</p>
              )}
            </div>
            {meta.length > 0 && (
              <p className="mt-1 text-[11px] leading-relaxed text-ink/55">{meta.join(' · ')}</p>
            )}
            {!amount && !meta.length && row.length > 1 && (
              <p className="mt-1 text-[11px] text-ink/55">{row.slice(1).join(' · ')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ChatMessageContent: React.FC<Props> = ({ content, tone = 'assistant' }) => {
  const cleaned = content.replace(/\n*\[Anexo:[^\]]*\]\s*/gi, '\n').trim();

  if (tone === 'user') {
    return <span className="whitespace-pre-wrap">{cleaned}</span>;
  }

  const blocks = parseBlocks(cleaned);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return <TableCards key={`b-${index}`} headers={block.headers} rows={block.rows} />;
        }

        if (block.type === 'list') {
          return (
            <ul key={`b-${index}`} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <li
                  key={`li-${itemIndex}`}
                  className="rounded-xl border border-mist-line/70 bg-mist/40 px-3 py-2"
                >
                  {renderInline(item, `li-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        const isTotal = /total/i.test(block.text);
        return (
          <p
            key={`b-${index}`}
            className={`whitespace-pre-wrap ${
              isTotal
                ? 'rounded-xl bg-mint/10 px-3 py-2 text-ink'
                : 'text-ink/90'
            }`}
          >
            {renderInline(block.text, `p-${index}`)}
          </p>
        );
      })}
    </div>
  );
};

export default ChatMessageContent;
