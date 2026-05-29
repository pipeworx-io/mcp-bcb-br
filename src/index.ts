interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Banco Central do Brasil (Brazil's central bank) MCP.
 * Keyless public APIs: SGS time series + Olinda OData (PTAX FX, Focus expectations).
 */


const SGS = 'https://api.bcb.gov.br/dados/serie';
const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico';
const UA = 'pipeworx-mcp-bcb-br/1.0 (+https://pipeworx.io)';

// Friendly named SGS series. Code = BCB SGS series identifier.
const NAMED_SERIES: Record<string, { code: number; label: string; unit: string }> = {
  selic_target: { code: 432, label: 'Selic target rate (Meta Selic, set by COPOM)', unit: '% p.a.' },
  selic_daily: { code: 11, label: 'Selic effective daily rate', unit: '% p.d.' },
  ipca: { code: 433, label: 'IPCA consumer price inflation (monthly)', unit: '% month' },
  usd_brl_ptax: { code: 1, label: 'USD/BRL PTAX sell rate (daily)', unit: 'BRL' },
  usd_brl: { code: 21619, label: 'USD/BRL exchange rate', unit: 'BRL' },
  cdi: { code: 4389, label: 'CDI interbank deposit rate (annualized)', unit: '% p.a.' },
};

const tools: McpToolExport['tools'] = [
  {
    name: 'sgs_series',
    description:
      'Fetch any Banco Central do Brasil SGS time series by numeric code. ' +
      'Common codes: 432=Selic target, 11=Selic daily, 433=IPCA inflation, 1=USD/BRL PTAX sell, 21619=USD/BRL, 4389=CDI. ' +
      'Returns [{data:"dd/MM/yyyy", valor:"..."}]. Use "last" for the most recent N observations, or a date range.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'integer', description: 'SGS series code, e.g. 432 (Selic target).' },
        last: { type: 'integer', description: 'Return only the most recent N observations, e.g. 12. Omit for full/ranged series.' },
        start: { type: 'string', description: 'Start date dd/MM/yyyy, e.g. "01/01/2025". Optional.' },
        end: { type: 'string', description: 'End date dd/MM/yyyy, e.g. "31/12/2025". Optional.' },
      },
      required: ['code'],
    },
  },
  {
    name: 'indicator',
    description:
      'Convenience lookup for common Brazilian macro indicators by friendly name (no SGS code needed). ' +
      'names: selic_target, selic_daily, ipca, usd_brl_ptax, usd_brl, cdi. ' +
      'Returns the latest N observations with the series label and unit.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'One of: selic_target, selic_daily, ipca, usd_brl_ptax, usd_brl, cdi.' },
        last: { type: 'integer', description: 'How many recent observations to return (default 12, max 1000).' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_indicators',
    description: 'List the friendly indicator names available to the "indicator" tool, with their SGS codes and units.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ptax_usd',
    description:
      'Official PTAX USD/BRL quote for a specific business day (buy + sell rate, timestamp). ' +
      'Returns {cotacaoCompra, cotacaoVenda, dataHoraCotacao}. Quotes are not published on weekends/holidays.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Quote date in MM-dd-yyyy (US order), e.g. "05-27-2026". Must be a business day.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'focus_expectations',
    description:
      'Focus market expectations survey — annual median/mean forecasts from ~150 economists. ' +
      'Filter by indicator (e.g. "IPCA", "Selic", "PIB Total", "Câmbio", "IGP-M") and optionally reference year. ' +
      'Returns latest survey rows with Media, Mediana, Minimo, Maximo, numeroRespondentes.',
    inputSchema: {
      type: 'object',
      properties: {
        indicator: { type: 'string', description: 'Indicador name in Portuguese, e.g. "IPCA", "Selic", "PIB Total", "Câmbio".' },
        reference_year: { type: 'string', description: 'DataReferencia year to filter, e.g. "2026". Optional.' },
        top: { type: 'integer', description: 'Max rows to return (default 10, max 100). Ordered by survey Data descending.' },
      },
      required: ['indicator'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'sgs_series': {
      const code = reqInt(args, 'code', '432 (Selic target rate)');
      const last = optInt(args, 'last');
      const path = last != null ? `/dados/ultimos/${last}` : '/dados';
      const qs = new URLSearchParams({ formato: 'json' });
      const start = args.start as string | undefined;
      const end = args.end as string | undefined;
      if (start) qs.set('dataInicial', start);
      if (end) qs.set('dataFinal', end);
      return bcbGet(`${SGS}/bcdata.sgs.${code}${path}?${qs.toString()}`);
    }
    case 'indicator': {
      const key = reqStr(args, 'name', '"selic_target"').trim();
      const def = NAMED_SERIES[key];
      if (!def) {
        throw new Error(
          `Unknown indicator "${key}". Valid names: ${Object.keys(NAMED_SERIES).join(', ')}. ` +
            `Or use sgs_series with a raw SGS code.`,
        );
      }
      const last = optInt(args, 'last') ?? 12;
      const data = await bcbGet(`${SGS}/bcdata.sgs.${def.code}/dados/ultimos/${last}?formato=json`);
      return { indicator: key, code: def.code, label: def.label, unit: def.unit, observations: data };
    }
    case 'list_indicators':
      return Object.entries(NAMED_SERIES).map(([k, v]) => ({ name: k, code: v.code, label: v.label, unit: v.unit }));
    case 'ptax_usd': {
      const date = reqStr(args, 'date', '"05-27-2026" (MM-dd-yyyy)');
      const url =
        `${OLINDA}/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)` +
        `?@dataCotacao='${encodeURIComponent(date)}'&$format=json`;
      const out = (await bcbGet(url)) as { value?: unknown[] };
      const value = out?.value ?? [];
      if (Array.isArray(value) && value.length === 0) {
        throw new Error(`BCB: no PTAX quote for ${date}. Use a business day in MM-dd-yyyy order (no weekends/holidays).`);
      }
      return value;
    }
    case 'focus_expectations': {
      const indicator = reqStr(args, 'indicator', '"IPCA"').trim();
      const top = Math.min(optInt(args, 'top') ?? 10, 100);
      let filter = `Indicador eq '${indicator.replace(/'/g, "''")}'`;
      const year = args.reference_year as string | undefined;
      if (year) filter += ` and DataReferencia eq '${String(year).replace(/'/g, "''")}'`;
      const qs = new URLSearchParams({ $format: 'json', $top: String(top), $filter: filter, $orderby: 'Data desc' });
      const out = (await bcbGet(`${OLINDA}/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?${qs.toString()}`)) as {
        value?: unknown[];
      };
      const value = out?.value ?? [];
      if (Array.isArray(value) && value.length === 0) {
        throw new Error(
          `BCB: no Focus rows for Indicador "${indicator}"${year ? ` reference year ${year}` : ''}. ` +
            `Check the Portuguese indicator name (e.g. "IPCA", "Selic", "PIB Total", "Câmbio").`,
        );
      }
      return value;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function bcbGet(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`BCB: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

function reqInt(args: Record<string, unknown>, key: string, example: string): number {
  const v = args[key];
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`Required argument "${key}" is missing. Pass a number like ${example}.`);
  }
  return Math.trunc(n);
}

function optInt(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (v == null) return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
