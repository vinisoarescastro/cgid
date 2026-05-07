# Integrações Necessárias e Recomendadas

> **Documento:** 07-estrategias/03-integracoes.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Mapa de Integrações

```
                    ┌─────────────────────┐
                    │  BrasilTerrenos     │
                    │  Portal Backend     │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
  ┌───────────────┐  ┌─────────────────┐  ┌────────────────┐
  │  Azure Active │  │  Power BI REST  │  │  E-mail (SMTP) │
  │  Directory    │  │  API            │  │  SendGrid/SES  │
  │  (v1.0)       │  │  (v1.0)         │  │  (v1.1)        │
  └───────────────┘  └─────────────────┘  └────────────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │                             │
                                    ▼                             ▼
                          ┌─────────────────┐          ┌─────────────────┐
                          │  Azure AD SSO   │          │  SIEM / Splunk  │
                          │  OIDC (v2.0)    │          │  (v2.0 opcional)│
                          └─────────────────┘          └─────────────────┘
```

---

## 2. Integração 1 — Azure Active Directory (Service Principal)

**Tipo:** Obrigatória — MVP (v1.0)  
**Propósito:** Autenticar o backend como Service Principal para gerar tokens de embed do Power BI.

### Como funciona

```
Portal Backend
  │
  │ POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
  │   grant_type: client_credentials
  │   client_id: {clientId}
  │   client_secret: {clientSecret}
  │   scope: https://analysis.windows.net/powerbi/api/.default
  │
  ▼
Azure AD
  │
  │ → access_token (valid ~1h)
  │
  ▼
Portal Backend usa o token para chamar a API do Power BI
```

### Setup Necessário no Azure Portal

1. Criar App Registration no Azure AD:
   - Nome: `BrasilTerrenos Portal`
   - Tipo: `Web application`
   - Redirect URIs: não obrigatório para client_credentials
2. Gerar Client Secret (anotar com validade de 24 meses)
3. Adicionar permissões de API:
   - `Microsoft Power BI Service → App.Read.All`
   - `Microsoft Power BI Service → Report.Read.All`
   - `Microsoft Power BI Service → Dataset.Read.All`
4. Conceder "Admin Consent" para as permissões
5. Adicionar o Service Principal como membro dos Workspaces no PBI Service

### Configuração no Portal
```env
PBI_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PBI_CLIENT_SECRET=<valor do secret>
```

### Renovação do Client Secret
- Client Secret tem validade de até 24 meses no Azure
- Criar lembrete/alerta 60 dias antes da expiração
- Rotação sem downtime: criar novo secret → atualizar config → remover antigo

---

## 3. Integração 2 — Power BI REST API

**Tipo:** Obrigatória — MVP (v1.0)  
**Propósito:** Listar relatórios disponíveis e gerar tokens de embed para renderização inline.

### Endpoints Utilizados

| Endpoint | Propósito | Versão |
|----------|-----------|--------|
| `GET /v1.0/myorg/groups/{groupId}/reports` | Listar relatórios do workspace | v1.0 |
| `POST /v1.0/myorg/groups/{groupId}/reports/{reportId}/GenerateToken` | Gerar embed token | v1.0 |
| `GET /v1.0/myorg/groups` | Listar workspaces do tenant | v1.1 (sync) |

### Geração de Embed Token

```typescript
// pbi.service.ts
async generateEmbedToken(workspaceId: string, reportId: string): Promise<EmbedTokenResult> {
  // 1. Obter access token do Azure AD (com cache Redis)
  const azureToken = await this.getAzureAccessToken();

  // 2. Chamar API do Power BI
  const response = await axios.post(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`,
    { accessLevel: 'View' },
    { headers: { Authorization: `Bearer ${azureToken}` } }
  );

  return {
    embedToken: response.data.token,
    embedUrl: response.data.embedUrl || `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${workspaceId}`,
    tokenExpiry: response.data.expiration,
  };
}
```

### Limites e Throttling da API PBI

| Limite | Valor | Mitigação |
|--------|-------|-----------|
| Requisições por hora (por tenant) | ~200 para GenerateToken | Cache de tokens no Redis (55 min) |
| Usuários simultâneos por capacidade PBI | Depende da SKU | Upgrade de capacidade |
| Tamanho máximo do payload de resposta | — | Paginação nos endpoints de listagem |

### SKUs de Capacidade Power BI Embedded

| SKU | vCores | Sessões concorrentes | Custo estimado |
|-----|:------:|:-------------------:|----------------|
| A1 | 1 | ~5 | $ baixo |
| A2 | 2 | ~10 | $ médio-baixo |
| A3 | 4 | ~20 | $ médio |
| A4 | 8 | ~40 | $ médio-alto |
| P1 Premium | 8 | Sem limite teórico | $$ alto |

> Recomendação inicial: **A2 ou A3** para o MVP dependendo do número de usuários simultâneos esperado.

---

## 4. Integração 3 — Serviço de E-mail Transacional

**Tipo:** Necessária — v1.1  
**Propósito:** Envio de e-mails de recuperação de senha, senha temporária e alertas de segurança.

### Provedores Recomendados

| Provedor | Vantagens | Quando usar |
|---------|-----------|-------------|
| **SendGrid** | Integração simples, alta entregabilidade, free tier | Padrão recomendado |
| **AWS SES** | Custo muito baixo, integrado ao ecossistema AWS | Se infraestrutura AWS |
| **Azure Communication Services** | Integrado ao ecossistema Azure | Se infraestrutura Azure |
| **Resend** | API moderna, suporte a React Email | Alternativa moderna |

### Templates de E-mail Previstos

| Template | Gatilho |
|----------|---------|
| Senha temporária | Criação de novo usuário |
| Recuperação de senha | Solicitação de reset |
| Conta bloqueada | Bloqueio automático (5 tentativas) |
| Alerta de segurança | Múltiplos acessos negados / IP suspeito |
| Confirmação de alteração de senha | Após redefinição bem-sucedida |

---

## 5. Integração 4 — Azure Active Directory SSO (OIDC)

**Tipo:** Planejada — v2.0  
**Propósito:** Permitir login único com conta Microsoft corporativa, eliminando a necessidade de senha separada.

### Fluxo PKCE (Recomendado para SPAs)

```
Browser                    Portal API              Azure AD
   │                           │                     │
   │ → Clicar "Entrar com      │                     │
   │   Microsoft"              │                     │
   │ ← Redirect URI gerado     │                     │
   │                           │                     │
   │ → Redirecionar para Azure AD Authorization Endpoint
   │   ?client_id=...&response_type=code&scope=openid+profile+email
   │   &code_challenge=...&code_challenge_method=S256
   │                           │                     │
   │ ←─────────────────────────── code ──────────────│
   │                           │                     │
   │ → POST /auth/azure-callback { code }            │
   │                           │── POST /token ─────▶│
   │                           │◀── id_token ────────│
   │                           │── Validar JWT ────── │
   │                           │── Criar/sincronizar  │
   │                           │   usuário no banco   │
   │◀── accessToken + refresh ─│                     │
```

### Considerações de Implementação
- Usar biblioteca `@nestjs/passport` + `passport-azure-ad`
- Sincronizar grupos do Azure AD com perfis do portal (via MS Graph API)
- Primeiro acesso via SSO cria o usuário automaticamente com perfil `operator` (configurável)
- Usuários criados manualmente ainda podem coexistir com usuários SSO

---

## 6. Integração 5 — Exportação de Logs para SIEM (Opcional)

**Tipo:** Opcional — v2.0+  
**Propósito:** Centralizar logs do portal em um sistema de gestão de eventos de segurança corporativo.

### Opções

| Solução | Mecanismo | Quando considerar |
|---------|-----------|-------------------|
| **Splunk** | Forwarder ou HEC (HTTP Event Collector) | Empresa já usa Splunk |
| **Azure Sentinel** | Azure Monitor Logs + conector | Infraestrutura Azure |
| **Elastic SIEM** | Elasticsearch + Logstash | Stack open-source |
| **Datadog Security** | Datadog Agent | Se Datadog para APM |

### Implementação Básica
```
Fluent Bit (sidecar container)
  → Coleta logs do stdout do container NestJS
  → Filtra e enriquece com metadata de ambiente
  → Encaminha para destino configurado (Splunk HEC, Azure Monitor, etc.)
```

---

## 7. Riscos das Integrações

| Integração | Risco | Mitigação |
|-----------|-------|-----------|
| Azure AD / PBI | Expiração do Client Secret | Alerta 60 dias antes; rotação sem downtime |
| Power BI API | Rate limiting (throttling) | Cache de tokens no Redis |
| Power BI API | Indisponibilidade do serviço | Graceful degradation; mensagem amigável |
| E-mail transacional | E-mails na caixa de spam | SPF + DKIM + DMARC configurados |
| Azure AD SSO (v2.0) | Usuário SSO vs. usuário manual | Política de deduplicação por e-mail |
| PBI Service | Mudança de breaking na API | Versionamento da API; monitoramento do changelog da Microsoft |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |