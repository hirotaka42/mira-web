# reference/ — 常設リファレンス区画

作業エピソード(`issue` / `future` / `project` の連番バケット)とは別に、**持続的に保つ文書**を置く。
ここは連番バケットに入れず、**その場で更新(in-place)**する。区分は上流 → 下流の順:

| 区分 | 役割 |
|---|---|
| `00_requirements/` | 要求・要求分析(何のためか) |
| `01_spec/` | 仕様・契約 |
| `02_architecture/` | アーキテクチャ・設計の構造(arc42 + C4 等) |
| `03_decisions/` | 設計決定の記録(ADR)。**追記専用・編集せず supersede**。テンプレは `../_templates/adr-template.md` |
| `04_usage/` | 使い方(how-to と reference を分ける) |
| `05_explanation/` | 背景・なぜ(補足理解) |

- 番号付き区分は**例外的にアンダースコア**を使う(他の命名はハイフン)。
- 横断の常設はここ(repo 直下 `docs/reference/`)、プロジェクト固有は `<project>/docs/reference/`。
- 詳細は `AGENTS-SHARED.md §8` の「常設リファレンス」を参照。
