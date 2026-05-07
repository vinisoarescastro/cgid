# Fluxos do Sistema

> **Documento:** 05-modelagem/03-fluxos-do-sistema.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Fluxo de Autenticação e Controle de Acesso

Este é o fluxo mais crítico do sistema. Toda tentativa de login passa por este pipeline de validações em sequência.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE AUTENTICAÇÃO                              │
└──────────────────────────────────────────────────────────────────────┘

[Usuário] → POST /auth/login { email, password }
                │
                ▼
        ┌───────────────┐
        │ Usuário existe │──── NÃO ──→ 401 "Credenciais inválidas"
        │ no banco?      │             (não revelar que e-mail não existe)
        └───────┬───────┘
                │ SIM
                ▼
        ┌──────────────────┐
        │ bcrypt.compare() │──── FALHA ──→ Incrementa login_attempts
        │ senha válida?     │               │
        └────────┬─────────┘               ▼
                │                    login_attempts >= 5?
                │                    SIM → status = 'blocked'
                │                          403 "Conta bloqueada"
                │                    NÃO → 401 "Credenciais inválidas (X/5)"
                │ OK
                ▼
        ┌──────────────────────┐
        │ status === 'active'? │──── NÃO ──→ 403 (inativo ou bloqueado)
        └──────────┬───────────┘
                   │ SIM
                   ▼
        ┌──────────────────────────┐
        │ Verificar expediente     │
        │ checkSchedule(userId,    │
        │ now)                     │
        └──────────┬───────────────┘
                   │
          ┌────────┴─────────┐
          │                  │
     FORA DO             DENTRO DO
    EXPEDIENTE           EXPEDIENTE
          │                  │
          ▼                  ▼
   Tem exceção?        Resetar login_attempts
   grupo ou           Emitir access_token (JWT RS256, 1h)
   individual?        Emitir refresh_token (httpOnly cookie, 24h)
          │           Registrar log: auth/login/success
     SIM  │ NÃO       Retornar { accessToken, user }
          │    │
          │    ▼
          │  403 "Acesso fora do expediente"
          │  Registrar log: access/denied/schedule
          │
          ▼
   Validar janela
   da exceção
          │
     ┌────┴────┐
  DENTRO    FORA DA
   JANELA    JANELA
     │          │
     ▼          ▼
  Prossegue  403 "Fora da janela de exceção"
```

---

## 2. Fluxo de Renovação de Sessão (Refresh Token)

```
[Frontend — Timer/Interceptor]
        │
        │  Token vai expirar em < 5 minutos?
        │  OU requisição retornou 401?
        ▼
POST /auth/refresh
  Cookie: refresh_token (httpOnly)
        │
        ▼
┌─────────────────────────┐
│ Refresh token válido?   │──── NÃO ──→ 401 → Frontend redireciona
│ (não expirado, não      │            para o login
│  revogado no Redis?)    │
└──────────┬──────────────┘
           │ SIM
           ▼
┌────────────────────────┐
│ Verificar se usuário   │──── NÃO ──→ 401 → Logout forçado
│ ainda está ativo?      │
└──────────┬─────────────┘
           │ SIM
           ▼
Emitir novo access_token
Renovar refresh_token (rotação)
Retornar { accessToken }
```

---

## 3. Fluxo de Visualização de Relatório PBI

```
[Usuário] → Clica em relatório
        │
        ▼
GET /api/v1/reports/{reportId}/embed-token
  Authorization: Bearer <access_token>
        │
        ▼
[Backend — Guard]
┌────────────────────────────┐
│ JWT válido e não expirado? │──── NÃO ──→ 401
└──────────┬─────────────────┘
           │ SIM
           ▼
┌──────────────────────────────────┐
│ Usuário tem permissão para       │──── NÃO ──→ 403 "Acesso negado"
│ este relatório? (RBAC check)     │            Log: access/denied/report
└──────────┬───────────────────────┘
           │ SIM
           ▼
┌──────────────────────────────────┐
│ Token em cache Redis?            │──── SIM ──→ Retorna token do cache
│ (TTL > 5 min restantes?)        │            (sem chamar Azure/PBI)
└──────────┬───────────────────────┘
           │ NÃO
           ▼
[Chamada Azure AD]
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
  grant_type: client_credentials
  client_id: {clientId}
  client_secret: {clientSecret}
  scope: https://analysis.windows.net/powerbi/api/.default
        │
        ▼
[Chamada Power BI REST API]
POST https://api.powerbi.com/v1.0/myorg/groups/{groupId}/reports/{reportId}/GenerateToken
  Authorization: Bearer <azure_access_token>
  Body: { accessLevel: "View" }
        │
        ▼
Armazenar token no Redis (TTL = 55 min)
Registrar log: report/accessed
        │
        ▼
Retornar { embedToken, embedUrl, reportId, tokenExpiry }
        │
        ▼
[Frontend]
powerbi.embed(container, {
  type: 'report',
  tokenType: models.TokenType.Embed,
  accessToken: embedToken,
  embedUrl: embedUrl,
  id: reportId,
})
        │
        ▼
Relatório renderizado inline no portal ✓
```

---

## 4. Fluxo de Alteração de Permissão

```
[Admin] → Acessa módulo Permissões → Seleciona alvo
        │
        ▼
GET /api/v1/permissions?target={role|userId}&targetId={id}
        │
        ▼
Sistema carrega permissões atuais
Admin faz alterações nos checkboxes
        │
        ▼
PUT /api/v1/permissions
  { target, targetId, module, action, value }
        │
        ▼
[Backend Guard]
┌──────────────────────────────────────────┐
│ Quem solicita tem permissão para alterar │──── NÃO ──→ 403
│ permissões do alvo selecionado?          │
│ (Admin não pode alterar Super Admin)     │
└──────────┬───────────────────────────────┘
           │ SIM
           ▼
Carregar estado anterior da permissão
        │
        ▼
Persistir nova permissão no banco (transação)
        │
        ▼
Registrar AuditLog:
  { type: 'permission', user: admin, target: userId/role,
    module: 'Permissões', detail: 'Ação X: true → false',
    previousVal: {...}, newVal: {...} }
        │
        ▼
Invalidar cache de permissões do usuário afetado no Redis
        │
        ▼
Retornar 200 OK
Frontend exibe toast "Permissão atualizada com sucesso"
```

---

## 5. Fluxo de Controle de Expediente

```
A cada tentativa de login:

checkSchedule(userId, now):
        │
        ▼
┌──────────────────────────┐
│ Bloqueio ativo fora do   │──── NÃO ──→ Permitir acesso (expediente
│ expediente? (toggle ON)  │            não configurado)
└──────────┬───────────────┘
           │ SIM
           ▼
┌──────────────────────────────────────────┐
│ now está dentro do horário de expediente │──── SIM ──→ Permitir acesso
│ para o dia da semana atual?              │
└──────────┬───────────────────────────────┘
           │ NÃO
           ▼
┌────────────────────────────────────────────┐
│ Usuário pertence a grupo de exceção ativo? │──── NÃO ──→ Bloquear acesso
└──────────┬─────────────────────────────────┘             403 + log
           │ SIM
           ▼
┌──────────────────────────────────────────────────────┐
│ now está dentro da janela de horário do grupo/       │──── NÃO ──→ Bloquear
│ ou da exceção individual do usuário?                 │
└──────────┬───────────────────────────────────────────┘
           │ SIM
           ▼
Permitir acesso ✓
```

---

## 6. Fluxo de Auditoria (Transversal)

Todo evento relevante gera um registro de auditoria de forma assíncrona:

```
[Qualquer evento relevante no sistema]
        │
        ▼
auditService.log({
  userId,           // quem fez
  userName,         // snapshot do nome (imutável)
  eventType,        // auth | user | permission | access | report | security | system
  module,           // módulo onde ocorreu
  detail,           // descrição legível
  ipAddress,        // IP da requisição
  previousVal,      // estado anterior (JSON) — para mudanças
  newVal,           // novo estado (JSON) — para mudanças
})
        │
        ▼
INSERT INTO audit_logs (...)
  -- tabela com restrição: sem UPDATE, sem DELETE
        │
        ▼
Eventos críticos? (type: 'security' ou múltiplas falhas de auth)
        │
     SIM│
        ▼
Publicar evento em fila de notificações
  → Atualizar contador de alertas no painel admin
  → (v1.1) Enviar e-mail de alerta para admins
```

---

## 7. Fluxo de Logout

```
[Usuário] → Clica em Sair
        │
        ▼
POST /auth/logout
  Authorization: Bearer <access_token>
  Cookie: refresh_token
        │
        ▼
Adicionar access_token à blocklist no Redis (TTL = tempo restante do token)
Remover refresh_token do Redis
Limpar cookie httpOnly no response (Max-Age: 0)
Registrar log: auth/logout
        │
        ▼
Retornar 200
Frontend redireciona para tela de login ✓
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |