# Guia de Atualização — Land Bank Mapa

Este documento explica como adicionar novas áreas, editar áreas existentes e atualizar o portal CGID após qualquer mudança na planilha ou nos arquivos KML.

---

## Visão geral do fluxo

```
1. Editar a planilha Excel  →  2. Adicionar/renomear KML  →  3. Rodar o script  →  4. Publicar
```

O portal não lê a planilha diretamente. O script `gerar_data.py` combina a planilha com os KMLs e gera o arquivo `data.json`, que é servido pelo backend do CGID. **Toda atualização termina rodando o script e publicando o `data.json`.**

---

## 1. Adicionar uma nova área

### 1.1 Planilha

1. Abra `areas_land_bank_com_id.xlsx`.
2. Insira uma nova linha com os dados da área.
3. Preencha a coluna **ID** com o próximo código disponível no formato `MAPnnn`
   (ex.: se o último era `MAP136`, use `MAP137`).
4. Preencha as demais colunas conforme necessário (ver `referencia-colunas.md`).
5. Salve o arquivo.

### 1.2 Arquivo KML

1. Exporte o polígono da área a partir do Google Earth, QGIS ou outra ferramenta.
2. **Nomeie o arquivo** seguindo a regra abaixo:

---

## Regra de nomenclatura do KML

O sistema extrai o ID do **início do nome do arquivo**. O padrão esperado é:

```
MAP{número}_{qualquer coisa}.kml
```

**Exemplos válidos:**
```
MAP137.kml
MAP137_Fase1.kml
MAP137_Terreno Principal.kml
MAP137_etapa2.kml
```

**Exemplos inválidos (o sistema não conseguirá vincular):**
```
terreno_MAP137.kml        ← ID não está no início
137.kml                   ← falta o prefixo MAP
MAP 137.kml               ← espaço entre MAP e o número
```

> **Área com múltiplas etapas ou fases:** crie um arquivo KML separado para cada etapa, todos começando com o mesmo ID (ex.: `MAP137_Fase1.kml`, `MAP137_Fase2.kml`). O sistema une todos os polígonos automaticamente. Os dados financeiros e de unidades **não são duplicados** — vêm da linha da planilha, independente de quantos KMLs existam para o mesmo ID.

---

## 2. Editar uma área existente

### Alterar dados da planilha (nome, VGV, unidades, etc.)

1. Localize a linha pelo ID da área na planilha.
2. Edite os campos desejados.
3. **Não altere o ID** — ele é a chave que vincula a linha ao KML.
4. Salve e rode o script (passo 4).

### Alterar o polígono (KML)

1. Gere o novo KML com o mesmo nome do arquivo original (mesmo ID).
2. Substitua o arquivo na pasta `kml/`.
3. Rode o script (passo 4).

### Alterar o ID de uma área

Evite ao máximo. Se for necessário:

1. Renomeie o(s) arquivo(s) KML para o novo ID.
2. Atualize o ID na planilha para o mesmo valor.
3. Rode o script.

---

## 3. Remover uma área

- **Remover do mapa mas manter na planilha:** coloque `0` (ou deixe em branco)
  na coluna `[ON / OFF]`. A área continuará na planilha mas aparecerá como
  Inativa nos filtros.
- **Remover completamente:** delete a linha da planilha **e** mova/apague o
  KML correspondente da pasta `kml/`. Depois rode o script.

---

## 4. Rodar o script e publicar

Após qualquer alteração na planilha ou nos KMLs:

```powershell
# No terminal, dentro da pasta backend/static/landbank/:
python -X utf8 gerar_data.py
```

O script vai imprimir um resumo no terminal. Verifique se não há mensagens de erro (❌) ou avisos de ID sem vínculo (⚠️) inesperados.

Depois, inclua o `data.json` gerado no commit do repositório CGID:

```powershell
git add backend/static/landbank/data.json
git commit -m "landbank: atualização de dados"
git push
```

O portal CGID passa a servir os novos dados automaticamente após o deploy.

---

## Resumo rápido

| Situação | O que fazer |
|---|---|
| Novo dado na planilha (sem KML ainda) | Adicionar linha + criar KML com nome `MAPnnn_...kml` + rodar script |
| Só mudou número/texto na planilha | Editar planilha + rodar script |
| Só mudou o polígono (KML) | Substituir arquivo KML + rodar script |
| Nova etapa de uma área existente | Criar `MAPnnn_Fase2.kml` na pasta `kml/` + rodar script |
| Desativar área no mapa | Colocar `0` na coluna `[ON / OFF]` + rodar script |
| Remover área completamente | Deletar linha da planilha + remover KML + rodar script |
