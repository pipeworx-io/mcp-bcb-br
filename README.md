# mcp-bcb-br

Banco Central do Brasil (Brazil's central bank) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `sgs_series` | Fetch any Banco Central do Brasil SGS time series by numeric code. Common codes: 432=Selic target, 11=Selic daily, 433=IPCA inflation, 1=USD/BRL PTAX sell, 21619=USD/BRL, 4389=CDI. Returns [{data:"dd/MM/yyyy", valor:"..."}]. Use "last" for the most recent N observations, or a date range. |
| `indicator` | Convenience lookup for common Brazilian macro indicators by friendly name (no SGS code needed). names: selic_target, selic_daily, ipca, usd_brl_ptax, usd_brl, cdi. Returns the latest N observations with the series label and unit. |
| `list_indicators` | List the friendly indicator names available to the "indicator" tool, with their SGS codes and units. |
| `ptax_usd` | Official PTAX USD/BRL quote for a specific business day (buy + sell rate, timestamp). Returns {cotacaoCompra, cotacaoVenda, dataHoraCotacao}. Quotes are not published on weekends/holidays. |
| `focus_expectations` | Focus market expectations survey — annual median/mean forecasts from ~150 economists. Filter by indicator (e.g. "IPCA", "Selic", "PIB Total", "Câmbio", "IGP-M") and optionally reference year. Returns latest survey rows with Media, Mediana, Minimo, Maximo, numeroRespondentes. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "bcb-br": {
      "url": "https://gateway.pipeworx.io/bcb-br/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/bcb-br/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Bcb Br data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
