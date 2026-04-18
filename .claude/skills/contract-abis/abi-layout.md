# `contracts-abi/` layout

```
contracts-abi/
├── abi/         ← JSON ABIs — authoritative for the web app
├── clients/     ← Go clients — NOT for web consumption
├── go.mod / go.sum
└── script.sh    ← ABI generation script (Go-side)
```

## `abi/` — what the web app consumes

JSON files, one per contract interface. The web app does not read JSON directly; typed bindings in `src/lib/*-abi.ts` are hand-maintained to mirror them (`as const` for viem's type inference).

## `clients/` — off-limits for the web app

Generated Go bindings used by backend services. Do not import, regenerate, or modify these from the Next.js codebase.

## Regenerating clients

If you need to regenerate Go clients, run `contracts-abi/script.sh` from that directory — outside the scope of web-app agent work.

## Version skew

Tables to keep aligned when an ABI changes:

| Layer | File(s) |
|---|---|
| Raw JSON | `contracts-abi/abi/<Contract>.json` |
| TS binding | `src/lib/<contract>-abi.ts` or `fast-settlement-*.ts` |
| Address | `src/lib/contract-config.tsx` |
| Call sites | hooks, components, server helpers (use `abi-tracer`) |
