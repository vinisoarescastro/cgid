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

[Usuário] → POST /api/v1/auth/entrar { email, senha }
                │
                ▼
        ┌────────────────┐
        │ Usuário existe │──── NÃO ──→ 401 "Credenciais inválidas"
        │ no banco?      │             (não revelar que e-mail não existe)
        └───────┬────────┘
                │ SIM
                ▼
        ┌──────────────────┐
        │ bcrypt.compare() │──── FALHA ──→ Incrementa tentativas_login
        │ senha válida?    │               │
        └────────┬─────────┘               ▼
                 │                    tentativas_login >= 5?
                 │                    SIM → status = 'bloqueado'
                 │                          403 "Conta bloqueada"
                 │                    NÃO → 401 "Credenciais inválidas (X/5)"
                 │ OK
                 ▼
        ┌──────────────────────┐
        │ status === 'ativo'?  │──── NÃO ──→ 403 (inativo ou bloqueado)
        └──────────┬───────────┘
                   │ SIM
                   ▼
        ┌──────────────────────────┐
        │ Verificar expediente     │
        │ validar_expediente(      │
        │ usuario_id,              │
        │ now)                     │
        └──────────┬───────────────┘
                   │
          ┌────────┴─────────┐
          │                  │
     FORA DO             DENTRO DO
    EXPEDIENTE           EXPEDIENTE
          │                  │
          ▼                  ▼
   Tem exceção?        Resetar tentativas_login
   grupo ou           Criar sessão em sessoes_autenticacao
   individual?        Emitir access_token (JWT HS256, 1h)
          │           Emitir refresh_token opaco (cookie httpOnly, 24h)
     SIM  │ NÃO       Registrar log: autenticacao/login/sucesso
          │           Retornar { token_acesso, usuario }
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
POST /api/v1/auth/renovar
  Cookie: refresh_token (httpOnly)
        │
        ▼
┌─────────────────────────┐
│ Refresh token válido?   │──── NÃO ──→ 401 → Frontend redireciona
│ (não expirado, sessão   │            para o login
│  não revogada no SQL?)  │
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
Rotacionar refresh_token na tabela sessoes_autenticacao
Retornar { token_acesso }
```

---

## 3. Fluxo de Visualização de Relatório PBI

```
[Usuário] → Clica em relatório
        │
        ▼
GET /api/v1/relatorios/{relatorio_id}/embed-token
  Authorization: Bearer <access_token>
        │
        ▼
[Backend - Guard]
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
│ Token em cache seguro do backend?│──── SIM ──→ Retorna token do cache
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
Armazenar token em cache temporário do backend (TTL menor que a expiração)
Registrar log: relatorio/acessado
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
GET /api/v1/permissoes?alvo={perfil|usuario_id}&alvo_id={id}
        │
        ▼
Sistema carrega permissões atuais
Admin faz alterações nos checkboxes
        │
        ▼
PUT /api/v1/permissoes
  { alvo, alvo_id, modulo, acao, valor }
        │
        ▼
[Backend Guard]
┌──────────────────────────────────────────┐
│ Quem solicita tem permissão para alterar │──── NÃO ──→ 403
│ permissões do alvo selecionado?          │
│ (Admin não pode alterar Master)          │
└──────────┬───────────────────────────────┘
           │ SIM
           ▼
Carregar estado anterior da permissão
        │
        ▼
Persistir nova permissão no banco (transação)
        │
        ▼
Registrar LogAuditoria:
  { tipo_evento: 'permissao', usuario: admin, alvo: usuario_id/perfil,
    modulo: 'Permissões', detalhe: 'Ação X: true → false',
    valor_anterior: {...}, valor_novo: {...} }
        │
        ▼
Invalidar consultas/cache de permissões do usuário afetado
        │
        ▼
Retornar 200 OK
Frontend exibe toast "Permissão atualizada com sucesso"
```

---

## 5. Fluxo de Controle de Expediente

```
A cada tentativa de login:

validar_expediente(usuario_id, agora):
        │
        ▼
┌─────────────────────────────────┐
│ Existe regra para o dia atual?  │──── NÃO ──→ Permitir acesso (sem restrição)
└──────────┬──────────────────────┘
           │ SIM
           ▼
┌────────────────────────────────┐
│ Dia está ativo? (ativo = true) │──── NÃO (dia bloqueado) ──→ Usuário pertence a grupo
└──────────┬─────────────────────┘                            com ignora_dia_inativo = true?
           │ SIM                                               │ SIM → Permitir acesso ✓
           ▼                                                   │ NÃO → Bloquear 403 + log
┌──────────────────────────┐
│ bloquear_fora = true?    │──── NÃO ──→ Permitir acesso (expediente não obrigatório)
└──────────┬───────────────┘
           │ SIM
           ▼
┌──────────────────────────────────────────┐
│ now está dentro do horário de expediente │──── SIM ──→ Permitir acesso ✓
│ (hora_inicio ≤ now ≤ hora_fim)?          │
└──────────┬───────────────────────────────┘
           │ NÃO (fora do horário base)
           ▼
┌──────────────────────────────────────────────────────┐
│ Usuário pertence a grupo de exceção ativo com        │──── NÃO ──→ Bloquear 403 + log
│ fora_horario = true?                                 │
└──────────┬───────────────────────────────────────────┘
           │ SIM
           ▼
┌──────────────────────────────────────────────────────┐
│ Grupo tem janela definida (janela_inicio/fim)?        │
│ SIM → now dentro da janela?                          │──── NÃO ──→ Bloquear
│ NÃO → acesso irrestrito pelo grupo                   │
└──────────┬───────────────────────────────────────────┘
           │ SIM
           ▼
Permitir acesso ✓ (excecao_ativa = true → exibido no topbar)
```

### Estados do indicador de expediente (topbar)

| Estado | Dot | Label | Badge |
|--------|-----|-------|-------|
| Dentro do expediente (base) | Verde | Expediente · HH:MM–HH:MM | — |
| Fora do expediente (bloqueado) | Vermelho | Fora do expediente · HH:MM–HH:MM | — |
| Acesso via exceção de horário | Verde | Expediente · HH:MM–HH:MM (janela exceção) | 🛡 Exceção |
| Dia bloqueado + ignora_dia_inativo | Âmbar | Acesso especial | 🛡 Dia bloqueado |
| Dia bloqueado sem exceção | Vermelho | Acesso bloqueado | — |

---

## 6. Fluxo de Auditoria (Transversal)

Todo evento relevante gera um registro de auditoria de forma assíncrona:

```
[Qualquer evento relevante no sistema]
        │
        ▼
servico_auditoria.registrar({
  usuario_id,       // quem fez
  nome_usuario,     // snapshot do nome (imutável)
  tipo_evento,      // autenticacao | usuario | permissao | acesso | relatorio | seguranca | sistema
  modulo,           // módulo onde ocorreu
  detalhe,          // descrição legível
  endereco_ip,      // IP da requisição
  valor_anterior,   // estado anterior (JSON) — para mudanças
  valor_novo,       // novo estado (JSON) — para mudanças
})
        │
        ▼
INSERT INTO logs_auditoria (...)
  -- tabela com restrição: sem UPDATE, sem DELETE
        │
        ▼
Eventos críticos? (tipo_evento: 'seguranca' ou múltiplas falhas de autenticacao)
        │
     SIM│
        ▼
Registrar alerta para o painel administrativo
  → Atualizar contador de alertas no dashboard
  → (v1.1) Enviar e-mail de alerta para admins
```

---

## 7. Fluxo de Logout

```
[Usuário] → Clica em Sair
        │
        ▼
POST /api/v1/auth/sair
  Authorization: Bearer <access_token>
  Cookie: refresh_token
        │
        ▼
Marcar sessão como revogada em sessoes_autenticacao
Revogar refresh_token associado à sessão
Limpar cookie httpOnly no response (Max-Age: 0)
Registrar log: autenticacao/logout
        │
        ▼
Retornar 200
Frontend redireciona para tela de login ✓
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Fluxo de expediente reescrito: adiciona `ativo=false` (dia bloqueado), `ignora_dia_inativo`, lógica aditiva de exceções e tabela de estados do indicador no topbar |
