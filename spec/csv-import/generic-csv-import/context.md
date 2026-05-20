# Generic CSV Parser — Context

## Problem
Support multiple bank CSV formats beyond CommBank by introducing a pluggable parser model. The parser must detect or resolve format configuration, map rows into canonical `CsvTransaction`, and preserve compatibility with existing CSV import flows.

## Domain Dependencies
- Uses domain `CsvTransaction` contract and CSV validation limits from [../hld.md](../hld.md).
- Uses parsing algorithm and row normalization strategy from [../hld.md](../hld.md).
- Consumed by `csv-import` feature upload flow.

## Scope
**In scope**
- Bank format configuration types (`BankCsvFormat`, `AmountStructure`).
- Registry-first format resolution for known banks.
- Optional auto-detection fallback based on headers/structure confidence.
- Generic parser service handling header and headerless CSVs.

**Out of scope**
- Upload API route ownership and auth checks.
- Category classification and review/confirm workflows.
- Binary storage and non-CSV formats.
