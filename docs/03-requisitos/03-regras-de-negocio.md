# Regras de Negócio

> **Documento:** 03-requisitos/03-regras-de-negocio.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Junho/2026

---

## Convenções

- **RN-[CATEGORIA]-[NNN]**: Identificador único da regra
- Categorias: `AUTH` (Autenticação), `PERM` (Permissões), `SCHED` (Expediente), `PBI` (Power BI), `AUD` (Auditoria), `SYS` (Sistema)

---

## RN-AUTH - Autenticação e Acesso

| ID | Regra | Origem |
|----|-------|--------|
| RN-AUTH-01 | A conta de um usuário deve ser **bloqueada automaticamente** após 5 tentativas consecutivas de login inválido | Política de segurança corporativa |
| RN-AUTH-02 | O desbloqueio de conta pode ser feito apenas por um Administrador ou Master — **não há desbloqueio automático por tempo** | Política de segurança |
| RN-AUTH-03 | Um usuário com status `inativo` **não pode fazer login**, mesmo que suas credenciais sejam válidas | Gestão de ciclo de vida de usuários |
| RN-AUTH-04 | Um usuário com status `bloqueado` **não pode fazer login** e deve receber mensagem específica (diferente de "credenciais inválidas") | Segurança - não revelar motivo do bloqueio para usuários mal-intencionados; diferente para usuários legítimos |
| RN-AUTH-05 | O sistema deve **verificar a restrição de expediente a cada tentativa de login**, não apenas no momento de criação da sessão | Garantir que a regra temporal seja respeitada sempre |
| RN-AUTH-06 | A sessão não deve ser renovada automaticamente se o usuário tentar usar o portal **fora do horário de expediente** (salvo exceções) | Consistência com a política de expediente |
| RN-AUTH-07 | O sistema permite **apenas uma sessão ativa por usuário** — um novo login revoga automaticamente todas as sessões anteriores daquele usuário | Prevenção de compartilhamento de credenciais |
| RN-AUTH-08 | Quando um novo login encontra sessão anterior ativa, o evento é registrado em `logs_auditoria` com tipo `seguranca`, IP da sessão anterior e IP do novo acesso | Rastreabilidade de uso indevido de credenciais |
| RN-AUTH-09 | A sessão anterior revogada recebe notificação em **até 20 segundos** via polling; modal bloqueante é exibido informando que a conta foi acessada em outro dispositivo | UX de segurança — transparência ao usuário legítimo |
| RN-AUTH-10 | O token de sessão é transmitido via header `X-Session-Token` e armazenado como hash SHA-256 na tabela `sessoes_autenticacao` — o valor bruto nunca é persistido | Segurança — comprometimento do banco não expõe tokens ativos |

---

## RN-PERM - Permissões e RBAC

| ID | Regra | Origem |
|----|-------|--------|
| RN-PERM-01 | **Master e Administrador têm acesso irrestrito** a todos os workspaces e relatórios, independentemente das permissões de workspace configuradas | Hierarquia de perfis |
| RN-PERM-02 | **Permissões individuais (por usuário) sobrepõem permissões de perfil** — se um usuário tem permissão explícita concedida ou negada, essa prevalece sobre o perfil | Princípio de precedência individual |
| RN-PERM-03 | Um usuário **só pode visualizar workspaces explicitamente atribuídos** ao seu perfil ou a ele individualmente | Princípio do menor privilégio |
| RN-PERM-04 | Relatórios com status `rascunho` **não são visíveis para perfis Colaborador e Convidado** — apenas Master, Administrador e Coordenador podem vê-los | Controle de conteúdo publicado |
| RN-PERM-05 | A remoção de um usuário de um workspace **não exclui o histórico de acesso** dele àquele workspace nos logs de auditoria | Integridade histórica |
| RN-PERM-06 | Quando um perfil de usuário é alterado, as permissões individuais (overrides) **não são removidas automaticamente** - devem ser revisadas manualmente pelo Admin | Segurança - evitar escalada acidental de privilégios |

---

## RN-SCHED - Controle de Expediente

| ID | Regra | Origem |
|----|-------|--------|
| RN-SCHED-01 | **O acesso fora do horário de expediente é bloqueado por padrão** para todos os usuários, exceto `master` e `administrador`, que têm acesso irrestrito independente do horário | Política de segurança; hierarquia de perfis |
| RN-SCHED-02 | Um grupo de exceção concede acesso **apenas dentro da janela de horário configurada** para aquele grupo — a janela de exceção é **aditiva** ao horário base (ex: expediente 08h–18h + exceção 18h–20h = acesso até 20h) | Precisão na gestão de exceções |
| RN-SCHED-03 | Uma exceção individual **prevalece sobre a regra geral do grupo** ao qual o usuário pertence (pode ser mais restritiva ou mais permissiva) | Flexibilidade com controle granular |
| RN-SCHED-04 | A configuração de expediente **aplica-se globalmente** a todos os workspaces e relatórios - não é possível ter expediente diferente por workspace nesta versão | Simplicidade do MVP |
| RN-SCHED-05 | Alterações nas regras de expediente **entram em vigor imediatamente** - não há necessidade de reinicialização do sistema | Requisito operacional |
| RN-SCHED-06 | A verificação do horário de expediente **deve usar exclusivamente o relógio do servidor** (`datetime.now()`) — o cliente nunca envia parâmetros de tempo e não pode influenciar o resultado | Segurança — impede que o usuário burle a restrição manipulando data/hora no dispositivo |
| RN-SCHED-07 | Quando **não há regra configurada** para o dia atual, o sistema retorna `configurado = false` — sem regra equivale a acesso liberado (nenhuma restrição) | Sem restrição por padrão quando não configurado |
| RN-SCHED-08 | Um dia com `ativo = false` **bloqueia o acesso por completo** (ex: sábado e domingo desativados). Diferente de `bloquear_fora = false`, que mantém o dia visível no indicador sem bloquear o acesso | Distinção entre "dia desativado" e "expediente não obrigatório" |
| RN-SCHED-09 | Um grupo de exceção com `ignora_dia_inativo = true` **permite que seus membros acessem o sistema mesmo em dias bloqueados** (`ativo = false`). Grupos sem esse flag continuam bloqueados em dias inativos | Controle granular de exceções por dia bloqueado |
| RN-SCHED-10 | O indicador de expediente no topbar exibe o estado atual para **todos os perfis**: admins veem informativamente; usuários comuns veem seu estado de acesso com indicadores de exceção quando aplicável | Transparência e visibilidade do estado do sistema |
| RN-SCHED-11 | O badge de exceção (`excecao_ativa`) **só é exibido quando a exceção é o que está garantindo o acesso** — se o usuário já está dentro do horário base, a exceção não é destacada mesmo que ele pertença a um grupo | Clareza visual; evita informação redundante |

---

## RN-PBI - Integração Power BI

| ID | Regra | Origem |
|----|-------|--------|
| RN-PBI-01 | O portal **não cria, edita ou exclui relatórios** no Power BI Service - apenas os consome via embed | Separação de responsabilidades |
| RN-PBI-02 | A sincronização de relatórios do PBI Service com o banco do portal é feita via processo administrativo (manual ou automático) - **relatórios do PBI não aparecem automaticamente sem configuração** | Controle de inventário |
| RN-PBI-03 | Tokens de embed têm **validade máxima de 1 hora** (limitação da API do Power BI) e devem ser renovados antes do vencimento | Limitação técnica da plataforma |
| RN-PBI-04 | Um relatório só é acessível no portal se: (a) existe no PBI Service, (b) está cadastrado no banco do portal, e (c) o usuário tem permissão | Tripla validação de acesso |
| RN-PBI-05 | Relatórios **sem `id_relatorio_pbi` configurado** devem exibir o botão "Abrir" no estado desabilitado — nunca ocultá-lo. Isso comunica ao usuário que o recurso existe mas ainda não foi vinculado ao Power BI | UX — visibilidade do estado do sistema |
| RN-PBI-06 | O token de embed Power BI **deve ser gerado server-side** e nunca exposto ao cliente como credencial reutilizável | Segurança - client_secret nunca no front-end |
| RN-PBI-07 | A geração de embed token **deve usar o endpoint V2** (`POST /v1.0/myorg/GenerateToken`) com `reports`, `datasets` e `targetWorkspaces` — o V1 não suporta datasets DirectLake (Microsoft Fabric) | Compatibilidade técnica com todos os tipos de dataset |
| RN-PBI-08 | As credenciais PBI são **lidas do banco de dados** (`configuracoes_sistema`) em cada requisição — não de variáveis de ambiente. Isso permite atualização via interface sem reinicialização do servidor | Operabilidade; configuração via UI |

---

## RN-CONF - Segurança de Configurações Críticas

| ID | Regra | Origem |
|----|-------|--------|
| RN-CONF-01 | Campos críticos (`id_workspace_pbi`, `id_relatorio_pbi`, `pbi_client_id`, `pbi_tenant_id`, `pbi_client_secret`) são **exibidos somente-leitura** por padrão — o usuário precisa clicar em "Editar" para alterar | Prevenção de alterações acidentais |
| RN-CONF-02 | Toda alteração de campo crítico **exige confirmação explícita** via digitação da palavra "CONFIRMAR" em um modal de confirmação — o botão de salvar permanece desabilitado até a digitação exata | Prevenção de alterações acidentais; barreira intencional |
| RN-CONF-03 | Toda alteração de campo crítico gera **log de auditoria** com `tipo_evento='critico'` contendo o valor anterior e o novo valor | Rastreabilidade de mudanças sensíveis |
| RN-CONF-04 | Toda alteração de campo crítico salva **backup automático** na tabela `historico_config_critica` com os valores anterior e novo, usuário responsável e timestamp | Reversibilidade; histórico completo de alterações |
| RN-CONF-05 | O histórico de alterações de um campo crítico pode ser **consultado a qualquer momento** via botão de histórico que abre o `ModalHistoricoCritico` com comparação visual ANTES → DEPOIS | Transparência; auditoria visual |

## RN-PERM - Acesso a Relatórios Específicos

| ID | Regra | Origem |
|----|-------|--------|
| RN-PERM-07 | Usuário com `nivel_acesso = apenas_relatorios` **só enxerga relatórios explicitamente vinculados** na tabela `acessos_relatorio` — a listagem é filtrada no servidor, não no cliente | Princípio do menor privilégio; segurança server-side |
| RN-PERM-08 | A filtragem de relatórios por acesso aplica-se **apenas a relatórios publicados** — relatórios em rascunho nunca são exibidos para usuários com `apenas_relatorios` | Consistência com RN-PERM-04 |
| RN-PERM-09 | Ao vincular um usuário com `apenas_relatorios`, o Admin **deve selecionar ao menos zero relatórios** — é válido vincular sem nenhum relatório (usuário terá lista vazia) | Flexibilidade operacional |
| RN-PERM-10 | Alterar o nível de acesso de um usuário de `total` para `apenas_relatorios` **não cria automaticamente** entradas em `acessos_relatorio` — o Admin deve definir os relatórios manualmente | Segurança — sem acesso implícito após rebaixamento |

---

## RN-AUD - Auditoria

| ID | Regra | Origem |
|----|-------|--------|
| RN-AUD-01 | Logs de auditoria são **imutáveis**: não podem ser editados ou excluídos por nenhum perfil, incluindo Master | Conformidade e integridade |
| RN-AUD-02 | A exclusão de um usuário **não remove** os logs históricos a ele associados | Rastreabilidade permanente |
| RN-AUD-03 | A remoção de um workspace **não exclui** os logs de acesso históricos a ele | Rastreabilidade permanente |
| RN-AUD-04 | Alterações de dados sensíveis (permissões, perfis, configurações PBI) devem registrar o **estado anterior ("de") e o novo estado ("para")** | Rastreabilidade de mudanças |
| RN-AUD-05 | O acesso ao módulo de Logs é **exclusivo do Master** — outros perfis são redirecionados para Home ao tentar acessar `/auditoria` | Confidencialidade dos eventos |
| RN-AUD-06 | Na exibição de logs, o sistema **resolve o nome e e-mail atuais** do usuário quando ele ainda existe no banco — o snapshot (`nome_usuario`, `email_usuario`) é usado apenas como fallback para usuários já excluídos | Consistência da informação; o snapshot preserva rastreabilidade histórica pós-exclusão |

---

## RN-SYS - Sistema

| ID | Regra | Origem |
|----|-------|--------|
| RN-SYS-01 | **Favoritos são pessoais** e visíveis apenas para o próprio usuário | Privacidade |
| RN-SYS-02 | As credenciais de integração Power BI (Client ID, Tenant ID, Client Secret) **só podem ser configuradas pelo Master** | Segurança de configurações sensíveis |
| RN-SYS-03 | Ao criar um novo usuário, o sistema deve **gerar uma senha temporária padrão** e o usuário deve alterá-la no primeiro login | Boas práticas de gestão de credenciais |
| RN-SYS-04 | O sistema deve exibir o **ambiente atual** (Produção / Homologação) de forma visível para Admins, para evitar operações acidentais em produção | Operações seguras |
| RN-SYS-05 | Um usuário não deve conseguir duplicar o mesmo relatório nos favoritos; a combinação usuário + relatório é única | Integridade da lista pessoal |
| RN-SYS-06 | Remover um favorito não altera o relatório, o workspace nem permissões de acesso; remove apenas o vínculo pessoal na tabela `favoritos` | Separação entre preferência de navegação e controle de acesso |
| RN-SYS-07 | Ao **criar ou reativar** um workspace, o sistema vincula automaticamente todos os usuários `master` e `administrador` ativos com `nivel_acesso = total` — sem necessidade de configuração manual | Consistência; admins sempre têm acesso a todos os workspaces |
| RN-SYS-08 | **Master e Administrador não aparecem na lista de usuários vinculados** de um workspace — seu acesso é implícito e universal, exibir individualmente seria redundante | UX — clareza da listagem |
| RN-SYS-09 | A página Home de usuários não-admin exibe o **status do expediente no topbar** (dot colorido + label + horário), os workspaces acessíveis e seus relatórios com botão "Abrir" | Visibilidade do estado de acesso |
| RN-SYS-10 | O **footer da sidebar** exibe nome completo, e-mail e perfil do usuário logado em todas as páginas; as iniciais no avatar refletem o primeiro e segundo nome | Identificação contextual permanente |
| RN-SYS-11 | O **indicador de expediente** (`TopbarExpediente`) é exibido no topbar de **todas as páginas** do portal (Home, Workspaces, Usuários, Favoritos, Auditoria e Configurações) — não apenas na Home | Visibilidade consistente do estado de acesso em qualquer contexto |
| RN-SYS-12 | A **exclusão de um workspace é permanente e irreversível** — remove o workspace, todos os seus relatórios, vínculos de usuários (`acessos_workspace`) e acessos a relatórios individuais (`acessos_relatorio`) via cascade. Diferente do arquivamento, que mantém os dados mas oculta o workspace | Distinção semântica: arquivar ≠ excluir |
| RN-SYS-13 | A exclusão de um workspace **não remove os logs de auditoria** históricos a ele relacionados — apenas o workspace e seus dados operacionais são apagados | Rastreabilidade permanente; ver também RN-AUD-03 |

---

## RN-WS - Workspaces

| ID | Regra | Origem |
|----|-------|--------|
| RN-WS-01 | Excluir um workspace **exige confirmação explícita** via modal de variante `danger` informando que a ação é permanente e irreversível | Prevenção de exclusão acidental |
| RN-WS-02 | A exclusão permanente está disponível tanto no **painel de detalhe** do workspace ativo quanto no **card de workspace arquivado** | Consistência de acesso à ação |
| RN-WS-03 | Toda exclusão de workspace gera **log de auditoria** com `tipo_evento='sistema'` registrando o nome do workspace excluído e o usuário responsável | Rastreabilidade |
| RN-WS-04 | Ao excluir um workspace que está **atualmente aberto no painel de detalhe**, o painel é fechado automaticamente | UX — evitar estado inconsistente (painel exibindo workspace que não existe mais) |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Adicionado RN-PBI-05: botão "Abrir" desabilitado (nunca oculto) para relatórios sem ID PBI |
| 1.2 | Junho/2026 | Vinicius Soares | Adicionada seção RN-PERM (07–10): regras de acesso a relatórios específicos e filtragem server-side |
| 1.3 | Junho/2026 | Vinicius Soares | Adicionados RN-SCHED-06 e RN-SCHED-07: verificação de expediente server-side e comportamento sem regra configurada |
| 1.4 | Junho/2026 | Vinicius Soares | Página de Configurações implementada: CRUD de expediente por dia, grupos de exceção com membros e credenciais PBI |
| 1.5 | Junho/2026 | Vinicius Soares | RN-AUD-05 refinado: acesso à Auditoria exclusivo do Super Admin com redirecionamento para Home |
| 1.6 | Junho/2026 | Vinicius Soares | Corrigido ID duplicado de token Power BI para RN-PBI-06 e adicionadas RN-SYS-05/06 sobre favoritos |
| 1.7 | Junho/2026 | Vinicius Soares | RN-SCHED-01 atualizado: `master` e `administrador` são isentos da restrição de expediente; demais perfis (coordenador, colaborador, convidado) obedecem a regra, salvo grupo de exceção |
| 1.8 | Junho/2026 | Vinicius Soares | RN-SCHED-08/09: semantica de `ativo=false` (dia bloqueado) vs `bloquear_fora=false`; `ignora_dia_inativo` em grupos de exceção. RN-SCHED-10/11: indicador de expediente no topbar para todos os perfis. RN-AUD-06: resolução de nome atual nos logs. RN-SYS-07–10: auto-vínculo de admins em workspaces, ocultação da lista, home não-admin, footer da sidebar |
| 1.9 | Junho/2026 | Vinicius Soares | RN-PBI-07/08: endpoint V2 GenerateToken e credenciais lidas do banco. Nova seção RN-CONF (01–05): segurança de campos críticos — somente-leitura, confirmação digitada, log critico, backup automático e histórico visual |
| 2.0 | Junho/2026 | Vinicius Soares | RN-SYS-11: TopbarExpediente em todas as páginas. RN-SYS-12/13: exclusão permanente de workspace com cascade (≠ arquivamento). Nova seção RN-WS (01–04): regras de exclusão — confirmação, disponibilidade, log de auditoria e fechamento do painel |
| 2.1 | Junho/2026 | Vinicius Soares | Adicionados RN-AUTH-07 a 10: sessão única por usuário, log de sessão simultânea, notificação em tempo real via polling e armazenamento seguro do token como hash SHA-256 |
| 2.2 | Junho/2026 | Vinicius Soares | Nomenclatura de perfis atualizada: Super Admin → Master, Gerente → Coordenador, Operador → Colaborador, Visitante → Convidado. Slugs internos: `super_administrador` → `master`, `gerente` → `coordenador`, `operador` → `colaborador`, `visitante` → `convidado`. |
