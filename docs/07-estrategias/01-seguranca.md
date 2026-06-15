# Estratégia de Segurança

> **Documento:** 07-estrategias/01-seguranca.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Princípios de Segurança do Sistema

| Princípio | Aplicação no Portal |
|-----------|---------------------|
| **Defense in Depth** | Múltiplas camadas: rate limiting → autenticação → RBAC → validação → auditoria |
| **Least Privilege** | Cada usuário acessa apenas o mínimo necessário para sua função |
| **Fail Secure** | Em caso de dúvida ou erro, o sistema nega o acesso (fail-closed) |
| **Zero Trust** | Cada requisição é validada independentemente, inclusive sessões já autenticadas |
| **Auditability** | Toda ação relevante é registrada em log imutável |
| **Separation of Concerns** | Lógica de autorização nunca no frontend; tokens PBI sempre no backend |

---

## 2. Autenticação

### 2.1 Gestão de Credenciais

| Item | Implementação |
|------|--------------|
| Hash de senha | bcrypt com salt rounds ≥ 12 |
| Comparação | `bcrypt.compare()` — timing-safe, sem comparação direta |
| Senha temporária | Gerada aleatoriamente (32 bytes hex), expirada após primeiro uso |
| Complexidade mínima | 8 caracteres, ao menos 1 maiúscula, 1 número, 1 especial |
| Expiração de senha | A definir (recomendado: 90 dias para admins, 180 para operadores) |

### 2.2 Tokens JWT

```
access_token:
  - Algoritmo: HS256 (chave simétrica forte em JWT_SECRET_KEY)
  - TTL: 3600 segundos (1 hora)
  - Payload: sub, sid, email, perfil, iat, exp
  - Armazenamento: memória React (AuthContext)
  - Transmissão: Authorization: Bearer <token>

refresh_token:
  - Formato: UUID v4 opaco (não-decodificável)
  - TTL: 86400 segundos (24 horas)
  - Armazenamento: hash SHA-256 na tabela sessoes_autenticacao (SQL Server)
  - Transmissão: httpOnly; Secure; SameSite=Strict cookie
  - Rotação: a cada uso (refresh token rotation)

Revogação:
  - Logout: sessão marcada como revogada em sessoes_autenticacao
  - Logout: cookie httpOnly limpo no response
  - Bloqueio de usuário: todas as sessões ativas do usuário são revogadas no SQL Server
  - Toda requisição autenticada valida o sid do JWT contra uma sessão ativa
```

### 2.3 Controle de Sessão Única

```
Mecanismo implementado (v1.0):
  - Cada login bem-sucedido gera um token opaco (32 bytes, secrets.token_urlsafe)
  - Token armazenado como hash SHA-256 na tabela sessoes_autenticacao
  - Token transmitido via header X-Session-Token em cada requisição
  - Middleware validar_sessao verifica o hash em cada requisição autenticada

Revogação por novo login:
  - Ao receber novo login, o backend busca sessões ativas do usuário
    (revogado_em IS NULL e expira_em > agora)
  - Se houver sessão ativa: registra log de segurança com IP anterior e IP atual,
    marca revogado_em = agora para todas as sessões ativas
  - Nova sessão é criada; apenas o novo token é válido

Notificação da sessão revogada:
  - Frontend faz polling a cada 20 segundos via GET /sessao/ping
  - Middleware retorna 401 SESSAO_REVOGADA quando token está revogado
  - apiFetch intercepta o 401 e dispara evento customizado cgid:sessao_revogada
  - SessaoGuard (App.jsx) exibe modal bloqueante com contador regressivo de 15s
  - Ao encerrar: sessionStorage limpo + redirect para /login?motivo=sessao_revogada

Expiração padrão de sessão: 12 horas
```

### 2.4 Proteção Contra Força Bruta

```
Por conta de usuário:
  - Contador de tentativas_login na tabela usuarios
  - Bloqueio automático ao atingir 5 tentativas
  - Reset do contador apenas em login bem-sucedido ou por ação do Admin

Por IP (rate limiting global):
  - 100 requisições/minuto por IP (middleware/dependência FastAPI)
  - 10 tentativas de login/minuto por IP no endpoint /api/v1/auth/entrar
  - Resposta: HTTP 429 com Retry-After
  - Implementação inicial: contador em memória por processo ou tabela SQL Server; Redis pode ser adicionado em v2 para múltiplas instâncias

Proteção adicional:
  - Delay artificial de 300–500ms em respostas de login (evitar timing attacks)
  - Mensagem de erro genérica para e-mails não cadastrados (evitar user enumeration)
```

---

## 3. Autorização

### 3.1 Pipeline de Autorização (Ordem de Execução)

```
Toda requisição autenticada passa por:

1. obter_usuario_atual → Token válido? Não expirado? Sessão ativa no SQL Server?
2. validar_status      → Usuário ainda ativo (não bloqueado/inativado)?
3. validar_expediente  → Perfil é admin/super_admin? Liberado. Caso contrário: dentro do horário de expediente ou pertence a grupo de exceção ativo?
4. exigir_perfil       → Perfil tem acesso ao endpoint?
5. exigir_permissao    → Permissão granular (módulo × ação)?
6. validar_recurso     → Recurso específico pertence ao escopo do usuário?

Se qualquer etapa falhar → 403 Forbidden + registro em logs_auditoria
```

### 3.2 Prevenção de Escalada de Privilégios

- Admin não pode alterar permissões de Super Admin
- Usuário não pode alterar o próprio perfil/status
- Validação server-side: perfil do token é comparado com o banco em cada requisição crítica
- Propriedade de recursos: usuário só pode operar sobre recursos do seu escopo

---

## 4. Proteção de Dados em Trânsito

| Protocolo | Configuração |
|-----------|-------------|
| TLS | Versão mínima: TLS 1.2; Preferencial: TLS 1.3 |
| Cipher suites | Apenas suites com Forward Secrecy (ECDHE) |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` |
| Redirecionamento | HTTP → HTTPS automático em todas as rotas |
| Certificado | Let's Encrypt (renovação automática via Certbot) ou certificado corporativo |

---

## 5. Headers de Segurança HTTP

Configurados via middleware no **FastAPI** ou no proxy reverso (NGINX/IIS):

```python
@app.middleware("http")
async def adicionar_headers_seguranca(request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "connect-src 'self' https://api.powerbi.com; "
        "frame-src 'self' https://app.powerbi.com; "
        "img-src 'self' data: https:; "
        "font-src 'self' https://fonts.gstatic.com; "
        "object-src 'none'"
    )
    return response
```

---

## 6. Proteção contra Ataques Comuns (OWASP Top 10)

| Vulnerabilidade | Mitigação |
|----------------|-----------|
| **A01: Broken Access Control** | Guards no backend; RBAC server-side; sem lógica de autorização no frontend |
| **A02: Cryptographic Failures** | bcrypt, HS256 com chave forte, TLS 1.3, secrets em cofre |
| **A03: Injection** | SQLAlchemy com queries parametrizadas; validação Pydantic em todos os schemas |
| **A04: Insecure Design** | Fail-secure; least privilege; arquitetura em camadas |
| **A05: Security Misconfiguration** | Headers via FastAPI/proxy; variáveis de ambiente; sem defaults inseguros |
| **A06: Vulnerable Components** | `npm audit` no CI; Dependabot alerts; atualizações mensais |
| **A07: Auth Failures** | JWT HS256; refresh rotation; sessão revogável no SQL Server; brute force protection |
| **A08: Software Integrity** | Lockfile (package-lock.json); SAST no CI; verificação de integridade de imagens |
| **A09: Logging Failures** | Auditoria imutável; logs estruturados; alertas de eventos críticos |
| **A10: SSRF** | Whitelist de URLs externas; sem fetch de URLs fornecidas pelo usuário |

---

## 7. Proteção de Dados em Repouso

| Dado | Proteção |
|------|---------|
| Senhas | Nunca armazenadas — apenas hash bcrypt |
| Client Secret PBI | Criptografado com AES-256 antes de salvar; chave no cofre de segredos |
| MFA Secret (TOTP) | Criptografado antes de salvar |
| Logs de auditoria | Dados de PII minimizados (IP, nome, e-mail — base legal documentada) |
| Refresh tokens | Hash SHA-256 antes de salvar em `sessoes_autenticacao` |
| Backups do banco | Criptografados com chave gerenciada pelo provedor cloud |

---

## 8. Gestão de Segredos

**Em desenvolvimento:**
```
.env.local (não commitado no Git)
.env.example (commitado, sem valores reais)
```

**Em staging/produção:**
```
Azure Key Vault ou AWS Secrets Manager
  → Secrets injetados como variáveis de ambiente no runtime
  → Nunca hardcoded no código ou em variáveis de ambiente não criptografadas
  → Rotação automática de secrets habilitada
  → Acesso auditado pelo provedor cloud
```

**No repositório Git:**
```
.gitignore deve incluir: .env, .env.local, *.pem, *.key, *.p12
Verificação com git-secrets ou trufflehog no pipeline CI
Pre-commit hook: detect-secrets
```

---

## 9. Segurança na Integração Power BI

| Prática | Implementação |
|---------|--------------|
| Service Principal | Apenas permissões mínimas necessárias no Azure |
| Client Secret | Nunca no frontend; sempre em variável de ambiente criptografada |
| Tokens de embed | Gerados server-side; TTL de 1h; sem reutilização entre usuários |
| Cache de tokens | Por usuário + relatório em cache temporário seguro no backend; Redis apenas se houver múltiplas instâncias em v2 |
| Whitelist de embeds | CSP `frameSrc` restringe apenas domínios oficiais do PBI |
| RLS (v2.0) | Username do usuário passado no token para RLS no dataset |

---

## 10. Checklist de Segurança para Go-Live

| Item | Status |
|------|:------:|
| Hash bcrypt com salt ≥ 12 | ⬜ Pendente |
| TLS 1.3 habilitado | ⬜ Pendente |
| HSTS com preload | ⬜ Pendente |
| CSP configurado e testado | ⬜ Pendente |
| Rate limiting ativo | ⬜ Pendente |
| Secrets em cofre de segredos | ⬜ Pendente |
| RBAC server-side validado | ⬜ Pendente |
| Logs de auditoria imutáveis | ⬜ Pendente |
| Análise SAST sem achados críticos | ⬜ Pendente |
| Pen test realizado | ⬜ Pendente |
| LGPD: DPO aprovação formal | ⬜ Pendente |
| Backup e recovery testados | ⬜ Pendente |
| Dependências sem vulnerabilidades críticas | ⬜ Pendente |
| MFA habilitado para Super Admin | ⬜ Pendente |

---

## 11. Plano de Resposta a Incidentes

| Nível | Critério | Resposta | SLA |
|-------|----------|---------|-----|
| 🔴 Crítico | Vazamento de dados; comprometimento de Admin; falha total do sistema | Notificar CISO + DPO; isolar sistema; abrir chamado P1 | < 1h |
| 🟡 Alto | Conta Admin bloqueada por ataque; acesso fora do expediente suspeito | Notificar Admin; revisar logs; resetar credenciais se necessário | < 4h |
| 🟢 Médio | Múltiplas tentativas de login por IP suspeito | Analisar logs; bloquear IP se necessário; manter monitoramento | < 24h |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Pipeline de autorização (3.1) atualizado: admins isentos do `validar_expediente`; demais perfis verificados contra regra + grupos de exceção |
| 1.2 | Junho/2026 | Vinicius Soares | Adicionada seção 2.3: controle de sessão única — token opaco com hash SHA-256, revogação automática por novo login, log de segurança com IPs, polling de 20s e modal bloqueante no frontend |
