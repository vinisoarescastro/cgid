# Guia: Configurar Power BI Embedded no CGID

> **Documento:** 11-guias/01-configurar-power-bi.md  
> **Status:** Aprovado  
> **Criado em:** Junho/2026  
> **Atualizado em:** Junho/2026

---

## Visão Geral

Este guia descreve o passo a passo completo para disponibilizar um relatório do Power BI no CGID, desde a configuração das credenciais no Azure até a liberação de acesso para usuários.

```
Azure AD (Service Principal)
  └─ credenciais salvas no CGID (Configurações → Power BI)
       └─ Workspace cadastrado no CGID (com Workspace ID do PBI)
            └─ Relatório cadastrado no CGID (com Report ID do PBI)
                 └─ Usuário com acesso liberado
                      └─ Usuário clica → backend gera token → relatório abre
```

---

## Etapa 1 — Criar o App Registration no Azure AD

> Feito uma única vez para toda a instalação do CGID.

1. Acesse [portal.azure.com](https://portal.azure.com)
2. Navegue até **Azure Active Directory → App registrations → New registration**
3. Preencha:
   - **Name:** `CGID - Centro de Governança e Inteligência de Dados` (ou outro nome descritivo)
   - **Supported account types:** Accounts in this organizational directory only
4. Clique em **Register**
5. Anote os valores exibidos na tela de Overview:
   - **Application (client) ID** → este é o `PBI_CLIENT_ID`
   - **Directory (tenant) ID** → este é o `PBI_TENANT_ID`

### Gerar o Client Secret

1. No menu lateral do app, clique em **Certificates & secrets**
2. Clique em **New client secret**
3. Defina uma descrição e validade (recomendado: 24 meses)
4. Clique em **Add**
5. **Copie o valor imediatamente** — ele não será exibido novamente → este é o `PBI_CLIENT_SECRET`

> **Segurança:** Nunca compartilhe o Client Secret em chats, e-mails ou repositórios de código. Guarde-o em um gerenciador de senhas ou cofre (ex: Azure Key Vault).

---

## Etapa 2 — Habilitar Service Principals no Power BI Admin Portal

> Necessário para que o Service Principal possa gerar tokens de embed.

1. Acesse [app.powerbi.com/admin-portal](https://app.powerbi.com/admin-portal)
2. Vá em **Configurações de locatário (Tenant settings)**
3. Localize **"Allow service principals to use Power BI APIs"**
4. Habilite para toda a organização ou para um grupo de segurança específico
5. Salve

> Se você não for administrador do tenant do Power BI, solicite ao administrador que realize esta etapa.

---

## Etapa 3 — Adicionar o Service Principal ao Workspace do Power BI

Para cada workspace do Power BI que terá relatórios no CGID:

1. Acesse [app.powerbi.com](https://app.powerbi.com)
2. No menu lateral, abra o workspace desejado
3. Clique em **"..." (reticências) → Gerenciar acesso**
4. No campo de busca, digite o **nome do app** registrado no Azure (ex: `CGID - Centro de Governança...`)
5. Selecione o app na lista e defina o papel como **Membro**
6. Clique em **Adicionar**

> O nível **Membro** é o mínimo necessário. Nível Visualizador não tem permissão para gerar tokens de embed.

---

## Etapa 4 — Configurar as Credenciais no CGID

1. No sistema CGID, acesse **Configurações → Power BI** (requer perfil Administrador ou Super Admin)
2. Preencha os campos:

| Campo | Valor |
|-------|-------|
| Tenant ID | `Directory (tenant) ID` copiado do Azure |
| Client ID | `Application (client) ID` copiado do Azure |
| Client Secret | Valor do secret gerado no Azure |

3. Clique em **Salvar credenciais**
4. Um modal de confirmação será exibido — digite `CONFIRMAR` (exatamente em maiúsculas) e clique em **Confirmar**

---

## Etapa 5 — Obter os IDs do Relatório no Power BI

1. Abra o relatório no Power BI Service
2. Copie a URL do navegador. O formato é:

```
https://app.powerbi.com/groups/{WORKSPACE_ID}/reports/{REPORT_ID}/...
```

3. Extraia os dois GUIDs:
   - O GUID após `/groups/` → **Workspace ID**
   - O GUID após `/reports/` → **Report ID**

**Exemplo:**
```
https://app.powerbi.com/groups/72810fa1-8575-4fc0-95db-1b078bb079a9/reports/6946901b-7ba9-4ad4-88a8-e20b7b4417d7/...
                             └─────────── Workspace ID ───────────┘        └──────────── Report ID ─────────────┘
```

---

## Etapa 6 — Cadastrar o Workspace no CGID

1. No CGID, acesse **Workspaces**
2. Clique em **Novo Workspace**
3. Preencha:
   - **Nome:** nome exibido para os usuários no portal
   - **ID Workspace Power BI:** o Workspace ID obtido na etapa anterior
   - **Ícone, cor e descrição:** opcionais, para organização visual
4. Clique em **Salvar**

---

## Etapa 7 — Cadastrar o Relatório no CGID

1. Dentro do workspace criado, clique em **Novo Relatório**
2. Preencha:
   - **Nome:** nome exibido para os usuários
   - **ID Relatório Power BI:** o Report ID obtido na etapa anterior
   - **Categoria:** opcional, para filtragem
   - **Status:** defina como **Publicado** para que fique visível
3. Clique em **Salvar**

---

## Etapa 8 — Liberar Acesso para Usuários

### Dar acesso ao workspace

1. No workspace, clique na aba **Usuários**
2. Clique em **Adicionar usuário**
3. Selecione o usuário e defina o nível:

| Nível | O que pode fazer |
|-------|-----------------|
| `Total` | Ver relatórios e gerenciar o workspace |
| `Apenas relatórios` | Somente visualizar relatórios liberados |

4. Se escolher **Apenas relatórios**, selecione quais relatórios específicos aquele usuário pode ver
5. Clique em **Adicionar**

---

## Como Funciona o Embed (Fluxo Técnico)

```
1. Usuário clica em um relatório no CGID
2. Frontend chama GET /relatorios/{id}/embed
3. Backend verifica permissão do usuário
4. Backend autentica no Azure AD (client credentials flow)
   POST login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
5. Backend chama API do Power BI para buscar a embed URL
   GET api.powerbi.com/v1.0/myorg/groups/{workspaceId}/reports/{reportId}
6. Backend gera o embed token (V2 — suporta DirectLake/Fabric)
   POST api.powerbi.com/v1.0/myorg/GenerateToken
7. Frontend recebe { embed_url, embed_token, report_id }
8. SDK powerbi-client renderiza o relatório em tela cheia
```

> O token gerado tem validade de ~1 hora. O usuário nunca acessa o Power BI Service diretamente — apenas o CGID controla o acesso.

---

## Observações Importantes

### Datasets DirectLake (Microsoft Fabric)

Relatórios que usam datasets DirectLake (OneLake/Fabric) exigem o endpoint V2 de geração de token (`POST /myorg/GenerateToken`). O CGID já usa este endpoint por padrão.

### Segurança dos Campos Críticos

Os campos **Workspace ID**, **Report ID** e as **Credenciais PBI** são tratados como campos críticos no CGID:

- São exibidos **somente-leitura** por padrão na interface
- Para alterar, clique em **Editar** e depois confirme digitando `CONFIRMAR` no modal
- Toda alteração gera um **log de auditoria** com `tipo_evento='critico'`
- O valor anterior é salvo automaticamente em **histórico** — acessível pelo ícone de relógio ao lado do campo
- Administradores podem consultar o histórico completo de alterações com comparação ANTES → DEPOIS

### Expiração do Client Secret

O Client Secret criado no Azure expira conforme a validade definida (máximo 24 meses). Quando expirar, o sistema não conseguirá mais gerar tokens e os relatórios deixarão de carregar.

**Procedimento de renovação sem downtime:**
1. No Azure Portal, crie um **novo** Client Secret (não delete o antigo ainda)
2. No CGID, em Configurações → Power BI, salve o novo valor
3. Teste abrindo um relatório
4. Confirme que está funcionando e então delete o secret antigo no Azure

---

## Resolução de Problemas

| Mensagem de erro | Causa provável | Solução |
|------------------|----------------|---------|
| "Credenciais do Power BI não configuradas" | Credenciais não salvas no CGID | Acesse Configurações → Power BI e preencha os campos |
| "O workspace não possui ID do Power BI configurado" | Campo Workspace ID vazio no cadastro | Edite o workspace e preencha o ID |
| "Este relatório não possui ID do Power BI configurado" | Campo Report ID vazio no cadastro | Edite o relatório e preencha o ID |
| "Embedding a DirectLake dataset is not supported with V1 embed token" | Versão antiga do backend | Atualize o backend para a versão atual |
| "At least one dataset is required" | Endpoint de token incorreto | Atualize o backend para a versão atual |
| "Unauthorized" ao chamar a API do PBI | Service Principal sem acesso ao workspace | Refaça a Etapa 3 e verifique se o nível é Membro |
| Relatório carrega em branco | Permissões de API insuficientes no Azure | Verifique se Admin Consent foi concedido para `Report.Read.All` e `Dataset.Read.All` |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Junho/2026 | Vinicius Soares | Criação do guia completo com base na implementação real |
| 1.1 | Junho/2026 | Vinicius Soares | Adicionada seção sobre segurança de campos críticos; Etapa 4 atualizada com confirmação "CONFIRMAR" |
