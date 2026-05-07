# Regras de Negócio

> **Documento:** 03-requisitos/03-regras-de-negocio.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Convenções

- **RN-[CATEGORIA]-[NNN]**: Identificador único da regra
- Categorias: `AUTH` (Autenticação), `PERM` (Permissões), `SCHED` (Expediente), `PBI` (Power BI), `AUD` (Auditoria), `SYS` (Sistema)

---

## RN-AUTH — Autenticação e Acesso

| ID | Regra | Origem |
|----|-------|--------|
| RN-AUTH-01 | A conta de um usuário deve ser **bloqueada automaticamente** após 5 tentativas consecutivas de login inválido | Política de segurança corporativa |
| RN-AUTH-02 | O desbloqueio de conta pode ser feito apenas por um Admin ou Super Admin — **não há desbloqueio automático por tempo** | Política de segurança |
| RN-AUTH-03 | Um usuário com status `inativo` **não pode fazer login**, mesmo que suas credenciais sejam válidas | Gestão de ciclo de vida de usuários |
| RN-AUTH-04 | Um usuário com status `bloqueado` **não pode fazer login** e deve receber mensagem específica (diferente de "credenciais inválidas") | Segurança — não revelar motivo do bloqueio para usuários mal-intencionados; diferente para usuários legítimos |
| RN-AUTH-05 | O sistema deve **verificar a restrição de expediente a cada tentativa de login**, não apenas no momento de criação da sessão | Garantir que a regra temporal seja respeitada sempre |
| RN-AUTH-06 | A sessão não deve ser renovada automaticamente se o usuário tentar usar o portal **fora do horário de expediente** (salvo exceções) | Consistência com a política de expediente |

---

## RN-PERM — Permissões e RBAC

| ID | Regra | Origem |
|----|-------|--------|
| RN-PERM-01 | **Super Admin e Admin têm acesso irrestrito** a todos os workspaces e relatórios, independentemente das permissões de workspace configuradas | Hierarquia de perfis |
| RN-PERM-02 | **Permissões individuais (por usuário) sobrepõem permissões de perfil** — se um usuário tem permissão explícita concedida ou negada, essa prevalece sobre o perfil | Princípio de precedência individual |
| RN-PERM-03 | Um usuário **só pode visualizar workspaces explicitamente atribuídos** ao seu perfil ou a ele individualmente | Princípio do menor privilégio |
| RN-PERM-04 | Relatórios com status `draft` (rascunho) **não são visíveis para perfis Operador e Visitante** — apenas Admin, Super Admin e Gerente podem vê-los | Controle de conteúdo publicado |
| RN-PERM-05 | A remoção de um usuário de um workspace **não exclui o histórico de acesso** dele àquele workspace nos logs de auditoria | Integridade histórica |
| RN-PERM-06 | Quando um perfil de usuário é alterado, as permissões individuais (overrides) **não são removidas automaticamente** — devem ser revisadas manualmente pelo Admin | Segurança — evitar escalada acidental de privilégios |
| RN-PERM-07 | O token de embed Power BI **deve ser gerado server-side** e nunca exposto ao cliente como credencial reutilizável | Segurança — client_secret nunca no front-end |

---

## RN-SCHED — Controle de Expediente

| ID | Regra | Origem |
|----|-------|--------|
| RN-SCHED-01 | **O acesso fora do horário de expediente é bloqueado por padrão** para todos os usuários não pertencentes a um grupo ou exceção individual ativa | Política de segurança |
| RN-SCHED-02 | Um grupo de exceção concede acesso **apenas dentro da janela de horário configurada** para aquele grupo — não é um acesso irrestrito | Precisão na gestão de exceções |
| RN-SCHED-03 | Uma exceção individual **prevalece sobre a regra geral do grupo** ao qual o usuário pertence (pode ser mais restritiva ou mais permissiva) | Flexibilidade com controle granular |
| RN-SCHED-04 | A configuração de expediente **aplica-se globalmente** a todos os workspaces e relatórios — não é possível ter expediente diferente por workspace nesta versão | Simplicidade do MVP |
| RN-SCHED-05 | Alterações nas regras de expediente **entram em vigor imediatamente** — não há necessidade de reinicialização do sistema | Requisito operacional |

---

## RN-PBI — Integração Power BI

| ID | Regra | Origem |
|----|-------|--------|
| RN-PBI-01 | O portal **não cria, edita ou exclui relatórios** no Power BI Service — apenas os consome via embed | Separação de responsabilidades |
| RN-PBI-02 | A sincronização de relatórios do PBI Service com o banco do portal é feita via processo administrativo (manual ou automático) — **relatórios do PBI não aparecem automaticamente sem configuração** | Controle de inventário |
| RN-PBI-03 | Tokens de embed têm **validade máxima de 1 hora** (limitação da API do Power BI) e devem ser renovados antes do vencimento | Limitação técnica da plataforma |
| RN-PBI-04 | Um relatório só é acessível no portal se: (a) existe no PBI Service, (b) está cadastrado no banco do portal, e (c) o usuário tem permissão | Tripla validação de acesso |

---

## RN-AUD — Auditoria

| ID | Regra | Origem |
|----|-------|--------|
| RN-AUD-01 | Logs de auditoria são **imutáveis**: não podem ser editados ou excluídos por nenhum perfil, incluindo Super Admin | Conformidade e integridade |
| RN-AUD-02 | A exclusão de um usuário **não remove** os logs históricos a ele associados | Rastreabilidade permanente |
| RN-AUD-03 | A remoção de um workspace **não exclui** os logs de acesso históricos a ele | Rastreabilidade permanente |
| RN-AUD-04 | Alterações de dados sensíveis (permissões, perfis, configurações PBI) devem registrar o **estado anterior ("de") e o novo estado ("para")** | Rastreabilidade de mudanças |
| RN-AUD-05 | O acesso ao módulo de Logs é **exclusivo de Admin e Super Admin** | Confidencialidade dos eventos |

---

## RN-SYS — Sistema

| ID | Regra | Origem |
|----|-------|--------|
| RN-SYS-01 | **Favoritos são pessoais** e visíveis apenas para o próprio usuário | Privacidade |
| RN-SYS-02 | As credenciais de integração Power BI (Client ID, Tenant ID, Client Secret) **só podem ser configuradas pelo Super Admin** | Segurança de configurações sensíveis |
| RN-SYS-03 | Ao criar um novo usuário, o sistema deve **enviar senha temporária por e-mail** — o usuário deve alterá-la no primeiro login | Boas práticas de gestão de credenciais |
| RN-SYS-04 | O sistema deve exibir o **ambiente atual** (Produção / Homologação) de forma visível para Admins, para evitar operações acidentais em produção | Operações seguras |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |