# Referência de Colunas — Land Bank Mapa

Este documento descreve quais colunas da planilha Excel o sistema lê, o que cada uma representa e quais regras devem ser respeitadas para o sistema funcionar corretamente.

---

## Regras gerais

| Regra | Detalhe |
|---|---|
| **Os nomes das colunas não podem mudar** | O sistema localiza cada coluna pelo nome exato (sem distinção de maiúsculas/minúsculas, mas o texto precisa ser idêntico). |
| **A ordem das colunas não importa** | O sistema busca cada coluna pelo nome, não pela posição. Reordenar as colunas na planilha não quebra nada. |
| **Linhas completamente vazias são ignoradas** | Linhas onde todas as células estão em branco são puladas automaticamente. |
| **A primeira linha deve ser o cabeçalho** | O sistema lê a primeira linha da aba ativa como cabeçalho. Não pode haver linhas de título ou mesclagem acima dela. |

---

## Colunas lidas pelo sistema

### Identificação e controle

| Nome na planilha | Campo interno | O que o sistema espera |
|---|---|---|
| `ID` | `id` | Texto no formato `MAPnnn` (ex.: `MAP001`, `MAP135`). Deve ser único por área. É a chave que vincula a linha ao arquivo KML correspondente. **Não pode ser alterado depois que o KML já foi nomeado.** |
| `Nome` | `nome` | Texto livre com o nome da área. Usado na busca e como rótulo quando não há empreendimento definido. |
| `[ON / OFF]` | `on_off` | Número: `1` = ativo (ON), qualquer outro valor ou vazio = inativo (OFF). Controla o filtro de Status na página. |

### Localização

| Nome na planilha | Campo interno | O que o sistema espera |
|---|---|---|
| `Regional` | `regional` | Texto. Deve ser um dos valores configurados no mapa de cores (ex.: `SUDESTE`, `NORDESTE I`). Controla a cor do polígono e o filtro de localização. |
| `Cidade` | `cidade` | Texto com o nome da cidade. Usado nos filtros e no popup do mapa. |
| `UF` | `uf` | Sigla do estado com 2 letras (ex.: `SP`, `MG`). Usado no contador de estados. |
| `Empreendimento` | `empreendimento` | Texto com o nome do empreendimento. Exibido como título no popup do mapa e na lista lateral. |

### Características do projeto

| Nome na planilha | Campo interno | O que o sistema espera |
|---|---|---|
| `Tipo` | `tipo` | Texto livre (ex.: `Residencial`, `Misto`). Exibido no popup. |
| `Year` | `year` | Número com o ano previsto de lançamento (ex.: `2026`). Usado no filtro de Ano Previsto. |
| `Código Modelo` | `codigo` | Texto livre com o código do modelo. Armazenado mas não exibido diretamente na interface atual. |
| `Area Total m2` | `area_total` | Número em m². O sistema converte para hectares (÷ 10.000) para exibição. |
| `Total de Unidades` | `total_unidades` | Número inteiro. Somado nos totalizadores do painel lateral. |

### Financeiro

| Nome na planilha | Campo interno | O que o sistema espera |
|---|---|---|
| `VGV Total` + quebra de linha + `(R$mm)` | `vgv_total` | Número em R$ milhões. A célula do cabeçalho no Excel tem uma quebra de linha (Alt+Enter) entre "VGV Total" e "(R$mm)". |
| `VGV Total` + quebra de linha + `(R$mm) BT` | `vgv_bt` | Número em R$ milhões. Mesma regra — cabeçalho tem quebra de linha. |
| `Custo Total do Terreno` + quebra de linha + `(Pré Rateio - R$mm)` | `custo_terreno` | Número em R$ milhões. Cabeçalho tem quebra de linha. |
| `Custo de Construção` + quebra de linha + `(Pré Rateio - R$mm)` | `custo_construcao` | Número em R$ milhões. Cabeçalho tem quebra de linha. |
| `Participação Buriti` | `participacao_buriti` | Número decimal entre 0 e 1 (ex.: `0,35` para 35%). O sistema multiplica por 100 e exibe com `%`. |

### Data

| Nome na planilha | Campo interno | O que o sistema espera |
|---|---|---|
| `Data de Lançamento` | `data_lancamento` | Data (formato Excel ou texto). Armazenada mas não exibida diretamente na interface atual. |

---

## Colunas que existem na planilha mas o sistema não lê

As colunas abaixo estão presentes no arquivo Excel e podem ser editadas livremente sem nenhum impacto no mapa:

```
Links, Status da área, # UAU LAND-BANK, # Workflow, Empresa UAU, Obra UAU,
Tipo de Contrato, Valor de Compra da Área - Aquisição (R$mm),
Projeto Feito, Data de Inicio de Construção, Participação Terreneiro (não paga obra),
Participação Buriti + Terreneiro, Comisão / Terreneiro,
Adm. E Manutenção / Terreneiro, Tributos / Terreneiro,
Participação Líquida Terreneiro, Participação de Sócios Minoritários (paga obra),
Valor m2 Obra, m2 por Unidade, Valor m2 Venda, VGV Total (R$mm) BT,
Valor médio por terreno, Custo médio por terreno, % Paga obra, Margem
```

---

## O que NÃO pode ser alterado

1. **O nome das colunas lidas** (listadas nas tabelas acima). Renomear quebra o vínculo.
2. **O ID de uma área que já tem KML** — o nome do arquivo KML é baseado nesse ID. Se mudar o ID na planilha sem renomear o KML (ou vice-versa), a área perde os dados.
3. **A primeira linha como cabeçalho** — não inserir linhas extras acima do cabeçalho.
