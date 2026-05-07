# Requisitos Funcionais

> **Documento:** 03-requisitos/01-requisitos-funcionais.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Convenções

| Coluna | Descrição |
|--------|-----------|
| **ID** | Identificador único no formato `RF-[MÓDULO]-[NNN]` |
| **Descrição** | O que o sistema deve fazer |
| **Critério de Aceite** | Condição verificável para considerar o requisito implementado |
| **Versão** | v1.0 (MVP), v1.1, v2.0 |
| **Prioridade** | 🔴 Must Have · 🟡 Should Have · 🟢 Could Have · ⚪ Won't Have |

---

## RF-AUTH — Autenticação e Identidade

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-AUTH-01 | O sistema deve autenticar usuários por e-mail e senha | Login com credenciais válidas redireciona para tela de boas-vindas | v1.0 | 🔴 |
| RF-AUTH-02 | O sistema deve bloquear a conta após 5 tentativas inválidas consecutivas | Na 5ª tentativa, conta fica com status `blocked` e mensagem é exibida | v1.0 | 🔴 |
| RF-AUTH-03 | O sistema deve emitir token JWT (access token) com expiração de 1 hora | Token gerado após login com campo `exp` correto; requisições após expiração retornam 401 | v1.0 | 🔴 |
| RF-AUTH-04 | O sistema deve emitir refresh token com expiração de 24 horas armazenado em `httpOnly cookie` | Refresh token não acessível via JavaScript; renovação automática funciona dentro do prazo | v1.0 | 🔴 |
| RF-AUTH-05 | O sistema deve validar status do usuário a cada requisição autenticada | Usuário inativado ou bloqueado após o login recebe 403 na próxima requisição | v1.0 | 🔴 |
| RF-AUTH-06 | O sistema deve registrar todos os eventos de login (sucesso e falha) no log de auditoria | Log gerado com timestamp, IP, e-mail tentado e resultado (success/fail) | v1.0 | 🔴 |
| RF-AUTH-07 | O sistema deve oferecer logout que invalida o token ativo | Após logout, requisições com o token anterior retornam 401 | v1.0 | 🔴 |
| RF-AUTH-08 | O sistema deve oferecer recuperação de senha por link enviado ao e-mail | Link de recuperação expira em 1 hora; nova senha exige mínimo de 8 caracteres | v1.1 | 🔴 |
| RF-AUTH-09 | O sistema deve suportar MFA via TOTP para perfis Admin e Super Admin | Após senha, Admin deve inserir código TOTP; código inválido bloqueia acesso | v1.1 | 🟡 |
| RF-AUTH-10 | O sistema deve suportar autenticação via Azure AD (SSO/OIDC) | Usuário clica em "Entrar com Microsoft" e é autenticado via fluxo PKCE | v2.0 | 🟢 |

---

## RF-USR — Gestão de Usuários

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-USR-01 | Admins devem visualizar lista de usuários com filtros por status, workspace e perfil | Lista exibe todos os campos relevantes; filtros funcionam combinados; paginação presente | v1.0 | 🔴 |
| RF-USR-02 | Admins devem criar novos usuários com nome, e-mail, perfil, workspace e relatórios | Usuário criado aparece na lista; e-mail é único; senha temporária enviada por e-mail | v1.0 | 🔴 |
| RF-USR-03 | Admins devem editar dados de um usuário existente | Alterações são persistidas; log de auditoria registra o que foi alterado e por quem | v1.0 | 🔴 |
| RF-USR-04 | Admins devem ativar e inativar usuários | Usuário inativo não consegue fazer login; status reflete na listagem | v1.0 | 🔴 |
| RF-USR-05 | Admins devem bloquear e desbloquear usuários manualmente | Usuário bloqueado não consegue fazer login; desbloqueio zera contador de tentativas | v1.0 | 🔴 |
| RF-USR-06 | O sistema deve exibir a data/hora do último acesso do usuário | Campo `last_login` atualizado a cada login bem-sucedido e exibido na listagem | v1.0 | 🟡 |
| RF-USR-07 | Admins devem associar usuários a workspaces com nível de acesso (total ou por relatórios) | Associação reflete imediatamente nas permissões do usuário | v1.0 | 🔴 |
| RF-USR-08 | Admins devem poder importar usuários via arquivo CSV | CSV com campos obrigatórios é validado; erros são reportados linha a linha; usuários válidos são criados | v2.0 | 🟢 |

---

## RF-PERM — Gestão de Permissões (RBAC)

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-PERM-01 | O sistema deve controlar permissões por perfil (Super Admin, Admin, Gerente, Operador, Visitante) | Cada perfil tem conjunto de permissões padrão; usuário com o perfil herda as permissões | v1.0 | 🔴 |
| RF-PERM-02 | Permissões devem cobrir as ações: Visualizar, Criar, Editar, Excluir, Exportar, Gerenciar | Cada módulo tem as 6 ações configuráveis por perfil | v1.0 | 🔴 |
| RF-PERM-03 | O sistema deve suportar override de permissão por usuário individual | Permissão individual sobrepõe a permissão do perfil para aquele usuário específico | v1.0 | 🔴 |
| RF-PERM-04 | Permissões Power BI devem ser configuráveis por workspace (acesso total ou apenas relatórios específicos) | Configuração "relatórios específicos" permite selecionar quais relatórios o perfil/usuário pode ver | v1.0 | 🔴 |
| RF-PERM-05 | Alterações de permissão devem gerar registro de auditoria com estado anterior e novo | Log contém: quem alterou, quando, qual permissão, de qual valor para qual | v1.0 | 🔴 |
| RF-PERM-06 | O token de embed Power BI deve ser gerado respeitando as permissões RBAC do portal | Usuário sem acesso ao relatório recebe 403 ao tentar gerar o token; token nunca é gerado no front-end | v1.0 | 🔴 |

---

## RF-SCHED — Controle de Expediente

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-SCHED-01 | O sistema deve permitir configurar horário de acesso por dia da semana | Interface permite definir dias ativos e horários de início/fim | v1.0 | 🔴 |
| RF-SCHED-02 | Fora do horário configurado, o acesso deve ser bloqueado por padrão | Tentativa de login fora do expediente retorna mensagem de restrição de horário | v1.0 | 🔴 |
| RF-SCHED-03 | Grupos de exceção devem ter janela de horário específica | Membros do grupo de exceção acessam somente dentro da janela configurada para o grupo | v1.0 | 🔴 |
| RF-SCHED-04 | Exceções individuais de usuário devem ser suportadas | Exceção individual funciona independentemente do grupo | v1.0 | 🟡 |
| RF-SCHED-05 | A verificação de expediente deve ocorrer a cada tentativa de login, não apenas na sessão | Usuário que deixa sessão aberta não tem acesso renovado fora do expediente | v1.0 | 🔴 |

---

## RF-PBI — Integração Power BI Embedded

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-PBI-01 | O sistema deve gerar tokens de embed para o Power BI Embedded exclusivamente no backend | Nenhuma credencial Azure (client_secret) é exposta ao frontend | v1.0 | 🔴 |
| RF-PBI-02 | Relatórios devem ser renderizados inline no portal (sem redirecionamento para o PBI Service) | Relatório aparece dentro do portal via powerbi-client SDK; não abre nova aba | v1.0 | 🔴 |
| RF-PBI-03 | O sistema deve renovar automaticamente tokens de embed próximos ao vencimento | Token renovado em background sem interrupção da sessão do usuário | v1.0 | 🔴 |
| RF-PBI-04 | O sistema deve sincronizar workspaces e relatórios disponíveis no PBI Service | Lista de relatórios do portal reflete o que existe no PBI Service após sincronização | v1.1 | 🟡 |
| RF-PBI-05 | O sistema deve suportar Row-Level Security (RLS) via username no token de embed | Token de embed inclui o username do usuário para aplicação de RLS no Power BI | v2.0 | 🟡 |

---

## RF-AUD — Auditoria e Logs

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-AUD-01 | Todos os eventos relevantes devem ser registrados automaticamente | Log gerado sem ação do usuário para: login, logout, CRUD de usuários, alterações de permissão, bloqueios, acessos negados | v1.0 | 🔴 |
| RF-AUD-02 | Cada registro de log deve conter: timestamp, usuário, IP, módulo, tipo, detalhe | Todos os campos presentes e preenchidos em cada evento | v1.0 | 🔴 |
| RF-AUD-03 | Logs não podem ser editados ou excluídos por nenhum perfil | Endpoint de DELETE para logs retorna 405; tabela com constraint de append-only | v1.0 | 🔴 |
| RF-AUD-04 | Admins devem filtrar logs por: período, usuário, módulo, tipo de evento e IP | Filtros combinados retornam resultado correto; filtros refletem em exportação | v1.0 | 🔴 |
| RF-AUD-05 | Admins devem exportar logs filtrados em CSV | Arquivo CSV gerado com todos os campos; encoding UTF-8; nome com data | v1.1 | 🟡 |
| RF-AUD-06 | Eventos críticos (bloqueio de conta, acesso negado repetido) devem gerar alerta no dashboard | Badge de alertas no topbar incrementa; lista de eventos críticos no painel admin atualizada | v1.0 | 🔴 |

---

## RF-SEC — Segurança

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-SEC-01 | Senhas devem ser armazenadas com hash bcrypt (salt ≥ 12) | Banco não contém senhas em texto puro; comparação usa `bcrypt.compare()` | v1.0 | 🔴 |
| RF-SEC-02 | O sistema deve aplicar rate limiting de 100 requisições/minuto por IP | Após limite, resposta 429 com cabeçalho `Retry-After` | v1.0 | 🔴 |
| RF-SEC-03 | O sistema deve configurar headers de segurança HTTP | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy presentes em todas as respostas | v1.0 | 🔴 |
| RF-SEC-04 | O sistema deve proteger contra CSRF em endpoints que modificam estado | Token CSRF ou validação de `SameSite=Strict` em cookies implementado | v1.0 | 🔴 |
| RF-SEC-05 | O sistema deve sanitizar todos os inputs do usuário para prevenir XSS e SQL Injection | Nenhum input refletido sem sanitização; ORM com queries parametrizadas | v1.0 | 🔴 |

---

## RF-CONF — Configurações

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-CONF-01 | Super Admin deve configurar as credenciais Power BI (Client ID, Tenant ID, Workspace ID) | Credenciais salvas de forma criptografada; integração PBI usa as credenciais configuradas | v1.0 | 🔴 |
| RF-CONF-02 | Somente Super Admin pode acessar o módulo de configurações | Outros perfis recebem 403 ao tentar acessar `/admin/settings` | v1.0 | 🔴 |
| RF-CONF-03 | O sistema deve exibir o ambiente atual (produção/homologação) no header | Badge de ambiente visível para todos os admins | v1.0 | 🟡 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |