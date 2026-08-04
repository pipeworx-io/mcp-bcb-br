# mcp-bcb-br

Banco Central do Brasil (Brazil's central bank) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Bcb Br data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
