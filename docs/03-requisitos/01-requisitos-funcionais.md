# Requisitos Funcionais

> **Documento:** 03-requisitos/01-requisitos-funcionais.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Junho/2026

---

## Convenções

| Coluna | Descrição |
|--------|-----------|
| **ID** | Identificador único no formato `RF-[MÓDULO]-[NNN]` |
| **Descrição** | O que o sistema deve fazer |
| **Critério de Aceite** | Condição verificável para considerar o requisito implementado |
| **Versão** | v1.0 (MVP), v1.1, v2.0 |
| **Prioridade** | 🔴 Obrigatório · 🟡 Recomendado · 🟢 Opcional · ⚪ Não disponível |

---

## RF-AUTH — Autenticação e Identidade

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-AUTH-01 | O sistema deve autenticar usuários por e-mail e senha | Login com credenciais válidas redireciona para tela principal | v1.0 | 🔴 |
| RF-AUTH-02 | O sistema deve bloquear a conta após 5 tentativas inválidas consecutivas | Na 5ª tentativa, conta fica com status `bloqueado` e mensagem é exibida | v1.0 | 🔴 |
| RF-AUTH-03 | O sistema deve emitir token JWT (access token) com expiração de 1 hora | Token gerado após login com campo `validade_token` correto; requisições após expiração retornam 401 | v1.0 | 🔴 |
| RF-AUTH-04 | O sistema deve emitir refresh token com expiração de 24 horas armazenado em `httpOnly cookie` | Refresh token não acessível via JavaScript; renovação automática funciona dentro do prazo | v1.0 | 🔴 |
| RF-AUTH-05 | O sistema deve validar status do usuário a cada requisição autenticada | Usuário inativado ou bloqueado após o login recebe 403 na próxima requisição | v1.0 | 🔴 |
| RF-AUTH-06 | O sistema deve registrar todos os eventos de login (sucesso e falha) no log de auditoria | Log gerado com timestamp, IP, e-mail tentado e resultado (success/fail) | v1.0 | 🔴 |
| RF-AUTH-07 | O sistema deve oferecer logout que invalida o token ativo | Após logout, requisições com o token anterior retornam 401 | v1.0 | 🔴 |
| RF-AUTH-08 | O sistema deve suportar autenticação via Azure AD (SSO/OIDC) | Usuário clica em "Entrar com Microsoft" e é autenticado via fluxo PKCE | v2.0 | 🟡 |

---

## RF-USR — Gestão de Usuários

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-USR-01 | Admins devem visualizar lista de usuários com filtros por status, workspace e perfil | Lista exibe todos os campos relevantes; filtros funcionam combinados; paginação presente | v1.0 | 🔴 |
| RF-USR-02 | Admins devem criar novos usuários com nome, e-mail, perfil, workspace e relatórios | Usuário criado aparece na lista; e-mail é único; senha temporária enviada por e-mail | v1.0 | 🔴 |
| RF-USR-03 | Admins devem editar dados de um usuário existente | Alterações são persistidas; log de auditoria registra o que foi alterado e por quem | v1.0 | 🔴 |
| RF-USR-04 | Admins devem ativar e inativar usuários | Usuário inativo não consegue fazer login; status reflete na listagem | v1.0 | 🔴 |
| RF-USR-05 | Admins devem bloquear e desbloquear usuários manualmente | Usuário bloqueado não consegue fazer login; desbloqueio zera contador de tentativas | v1.0 | 🔴 |
| RF-USR-06 | O sistema deve exibir a data/hora do último acesso do usuário | Campo `ultimo_login` atualizado a cada login bem-sucedido e exibido na listagem | v1.0 | 🔴 |
| RF-USR-07 | Admins devem associar usuários a workspaces com nível de acesso (total ou por relatórios) | Associação reflete imediatamente nas permissões do usuário | v1.0 | 🔴 |
| RF-USR-08 | Admins devem poder importar usuários via arquivo CSV | CSV com campos obrigatórios é validado; erros são reportados linha a linha; usuários válidos são criados | v2.0 | 🟢 |

---

## RF-PERM — Gestão de Permissões (RBAC)

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-PERM-01 | O sistema deve controlar permissões por perfil (Master, Administrador, Coordenador, Colaborador, Convidado) | Cada perfil tem conjunto de permissões padrão; usuário com o perfil herda as permissões | v1.0 | 🔴 |
| RF-PERM-02 | Permissões devem cobrir as ações: Visualizar, Criar, Editar, Excluir, Exportar, Gerenciar | Cada módulo tem as 6 ações configuráveis por perfil | v1.0 | 🔴 |
| RF-PERM-03 | O sistema deve suportar override de permissão por usuário individual | Permissão individual sobrepõe a permissão do perfil para aquele usuário específico | v1.0 | 🔴 |
| RF-PERM-04 | Permissões Power BI devem ser configuráveis por workspace (acesso total ou apenas relatórios específicos) | Configuração "relatórios específicos" permite selecionar quais relatórios o perfil/usuário pode ver | v1.0 | 🔴 |
| RF-PERM-05 | Alterações de permissão devem gerar registro de auditoria com estado anterior e novo | Log contém: quem alterou, quando, qual permissão, de qual valor para qual | v1.0 | 🔴 |
| RF-PERM-06 | O token de embed Power BI deve ser gerado respeitando as permissões RBAC do portal | Usuário sem acesso ao relatório recebe 403 ao tentar gerar o token; token nunca é gerado no front-end | v1.0 | 🔴 |
| RF-PERM-07 | Ao vincular um usuário com nível "Relatórios específicos", o Admin deve selecionar quais relatórios publicados ele poderá acessar | Checklist de relatórios publicados exibida no modal de vínculo quando nível = `apenas_relatorios`; seleção salva em `acessos_relatorio`; Admin pode reeditar via botão na tabela de usuários | v1.0 | 🔴 |
| RF-PERM-08 | O sistema deve filtrar os relatórios exibidos no workspace conforme o nível de acesso do usuário autenticado | Usuário `total`: vê todos os relatórios não arquivados. Usuário `apenas_relatorios`: vê somente os relatórios publicados da tabela `acessos_relatorio`. Filtragem ocorre no backend | v1.0 | 🔴 |

---

## RF-WS — Gestão de Workspaces

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-WS-01 | Admins devem criar workspaces com nome, ícone, cor e ID do workspace PBI | Workspace criado aparece na lista; log de auditoria registra a criação | v1.0 | 🔴 |
| RF-WS-02 | Admins devem editar metadados de um workspace (nome, ícone, cor, IDs PBI) | Alterações persistidas; log de auditoria registra o que foi alterado e por quem | v1.0 | 🔴 |
| RF-WS-03 | Admins devem arquivar e reativar workspaces | Workspace arquivado fica invisível para usuários comuns mas acessível na aba "Arquivados"; reativação restaura visibilidade | v1.0 | 🔴 |
| RF-WS-04 | Admins devem excluir permanentemente um workspace | Endpoint `DELETE /workspaces/{id}` remove o workspace e todos os seus relatórios e vínculos de acesso (cascade); ação exige confirmação via modal com variante `danger`; log de auditoria registra a exclusão com o nome do workspace; workspace ativo no painel é fechado automaticamente | v1.0 | 🔴 |
| RF-WS-05 | Admins devem gerenciar os relatórios de um workspace (criar, editar, arquivar, excluir) | CRUD de relatórios dentro do detalhe do workspace; criação e exclusão geram log de auditoria | v1.0 | 🔴 |
| RF-WS-06 | Admins devem vincular e desvincular usuários a um workspace com nível de acesso | Vínculo reflete imediatamente nas permissões; ação gera log de auditoria | v1.0 | 🔴 |
| RF-WS-07 | O indicador de expediente (`TopbarExpediente`) deve ser exibido no topbar de **todas as páginas** do portal | Pill de expediente visível em: Home, Workspaces, Usuários, Favoritos, Auditoria e Configurações; comportamento idêntico ao da página Home | v1.0 | 🔴 |
| RF-WS-08 | Os cards de workspace devem exibir contadores de relatórios (total, publicados e ativos) e usuários vinculados | Card exibe: nº de usuários vinculados, total de relatórios, nº de publicados (com ícone verde); contadores fornecidos por `GET /dashboard/workspaces` | v1.0 | 🟡 |
| RF-WS-09 | Relatórios dentro de um workspace devem ter indicação visual de status (publicado/rascunho) | Linhas de relatório publicado têm degradê verde (esquerda → transparente); rascunho têm degradê cinza (esquerda → transparente) | v1.0 | 🟡 |
| RF-WS-10 | No modal de edição de relatório, o nome do relatório no Power BI deve ser exibido automaticamente | Ao abrir o modal, se `id_relatorio_pbi` e `id_workspace_pbi` estiverem preenchidos, busca `GET /pbi/relatorio-info` e exibe o nome abaixo do campo Nome; campo "Verificar" disponível manualmente para novos IDs | v1.0 | 🟡 |

---

## RF-SCHED — Controle de Expediente

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-SCHED-01 | O sistema deve permitir configurar horário de acesso por dia da semana | Interface permite definir dias ativos (`ativo`) e horários de início/fim; dias com `ativo=false` bloqueiam o acesso por completo | v1.0 | 🔴 |
| RF-SCHED-02 | Fora do horário configurado, o acesso deve ser bloqueado por padrão | Tentativa de login fora do expediente retorna mensagem de restrição de horário | v1.0 | 🔴 |
| RF-SCHED-03 | Grupos de exceção devem ter janela de horário específica | Membros do grupo acessam dentro da janela do grupo (aditiva ao horário base); sem janela definida = acesso irrestrito pelo grupo | v1.0 | 🔴 |
| RF-SCHED-04 | Exceções individuais de usuário devem ser suportadas | Exceção individual funciona independentemente do grupo | v1.0 | 🟡 |
| RF-SCHED-05 | A verificação de expediente deve ocorrer a cada tentativa de login, não apenas na sessão | Usuário que deixa sessão aberta não tem acesso renovado fora do expediente | v1.0 | 🔴 |
| RF-SCHED-06 | O dashboard do Admin deve exibir o status do expediente atual | Card "Expediente" exibe horário, hora do servidor e status; quando não configurado, exibe mensagem específica | v1.0 | 🔴 |
| RF-SCHED-07 | A verificação de expediente deve ser feita exclusivamente pelo servidor | Endpoint `GET /dashboard/expediente` retorna `dentro_expediente` calculado com `datetime.now()` server-side | v1.0 | 🔴 |
| RF-SCHED-08 | Grupos de exceção devem suportar flag `ignora_dia_inativo` | Quando ativo, membros do grupo acessam mesmo em dias com `ativo=false`; grupos sem o flag continuam bloqueados nesses dias | v1.0 | 🔴 |
| RF-SCHED-09 | O indicador de expediente deve ser exibido no topbar para todos os perfis | Pill colorido (verde/vermelho/âmbar) com label, horário e badge de exceção quando aplicável; admins veem informativamente; usuários comuns veem seu estado real de acesso | v1.0 | 🔴 |

---

## RF-PBI — Integração Power BI Embedded

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-PBI-01 | O sistema deve gerar tokens de embed para o Power BI Embedded exclusivamente no backend | Nenhuma credencial Azure (client_secret) é exposta ao frontend | v1.0 | 🔴 |
| RF-PBI-02 | Relatórios devem ser renderizados inline no portal (sem redirecionamento para o PBI Service) | Relatório aparece dentro do portal via powerbi-client SDK; não abre nova aba | v1.0 | 🔴 |
| RF-PBI-03 | O sistema deve renovar automaticamente tokens de embed próximos ao vencimento | Token renovado em background sem interrupção da sessão do usuário | v1.0 | 🔴 |
| RF-PBI-04 | O sistema deve sincronizar workspaces e relatórios disponíveis no PBI Service | Lista de relatórios do portal reflete o que existe no PBI Service após sincronização | v1.1 | 🟡 |
| RF-PBI-05 | O sistema deve suportar Row-Level Security (RLS) via username no token de embed | Token de embed inclui o username do usuário para aplicação de RLS no Power BI | v2.0 | 🟡 |
| RF-PBI-06 | O botão "Abrir" deve ser exibido para todos os relatórios, independentemente de ter ID do Power BI configurado | Relatórios com `id_relatorio_pbi` preenchido: botão ativo abre o visualizador. Relatórios sem `id_relatorio_pbi`: botão exibido desabilitado (opacidade reduzida) com tooltip "Sem link configurado" | v1.0 | 🔴 |
| RF-PBI-07 | O sistema deve usar o endpoint V2 (`POST /v1.0/myorg/GenerateToken`) para gerar tokens de embed, incluindo o `datasetId` do relatório | Token gerado com sucesso para relatórios em datasets DirectLake (Microsoft Fabric/OneLake) e convencionais | v1.0 | 🔴 |
| RF-PBI-08 | As credenciais Power BI (Client ID, Tenant ID, Client Secret) devem ser lidas do banco de dados (`configuracoes_sistema`) em cada requisição de embed | Backend não depende de variáveis de ambiente para PBI; alteração das credenciais via UI reflete imediatamente | v1.0 | 🔴 |

---

## RF-AUD — Auditoria e Logs

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-AUD-01 | Todos os eventos relevantes devem ser registrados automaticamente | Log gerado sem ação do usuário para: login, logout, CRUD de usuários, alterações de permissão, bloqueios, acessos negados | v1.0 | 🔴 |
| RF-AUD-02 | Cada registro de log deve conter: timestamp, usuário, IP, módulo, tipo, detalhe; nome exibido deve refletir o nome atual do usuário | Todos os campos presentes; IP capturado via `X-Forwarded-For` com fallback para `request.client.host`; nome/e-mail resolvidos do banco em tempo de leitura (fallback para snapshot quando usuário foi excluído) | v1.0 | 🔴 |
| RF-AUD-03 | Logs não podem ser editados ou excluídos por nenhum perfil | Nenhum endpoint de DELETE/PUT exposto para logs; tabela append-only | v1.0 | 🔴 |
| RF-AUD-04 | Master pode filtrar logs por: período, usuário (nome/e-mail), módulo, tipo de evento e IP | Filtros combinados retornam resultado correto via `GET /auditoria`; filtros aplicados também na exportação CSV | v1.0 | 🔴 |
| RF-AUD-05 | Master pode exportar logs filtrados em CSV | Arquivo CSV gerado via `GET /auditoria/export-csv`; encoding UTF-8 com BOM; nome com timestamp | v1.0 | 🔴 |
| RF-AUD-06 | Eventos críticos (bloqueio de conta, acesso negado repetido) devem gerar alerta no dashboard | Badge de alertas no topbar incrementa; lista de eventos críticos no painel admin atualizada | v1.0 | 🔴 |
| RF-AUD-07 | A página de Auditoria deve paginar os resultados (50 por página) com navegação por páginas | Paginação exibida abaixo da tabela com botões primeira/anterior/páginas/próxima/última; contador "X–Y de Z registros" | v1.0 | 🔴 |
| RF-AUD-08 | Registros com `valor_anterior` ou `valor_novo` devem permitir expandir o detalhe da alteração | Clique na linha expande painel com "ANTES" e "DEPOIS" lado a lado | v1.0 | 🔴 |

---

## RF-FAV — Favoritos

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-FAV-01 | Usuários devem poder marcar e desmarcar relatórios como favoritos na listagem do workspace | Clique na estrela cria ou remove registro em `favoritos`; estado visual atualiza sem recarregar a página | v1.0 | 🔴 |
| RF-FAV-02 | O sistema deve disponibilizar uma página de Favoritos para cada usuário | Rota `/favoritos` lista apenas favoritos do usuário autenticado, agrupados por workspace | v1.0 | 🔴 |
| RF-FAV-03 | A página de Favoritos deve permitir busca por nome do relatório ou workspace | Campo de busca filtra a lista localmente e exibe estado vazio quando não há resultados | v1.0 | 🔴 |
| RF-FAV-04 | Relatórios favoritos com ID Power BI configurado devem abrir no visualizador incorporado | Botão "Abrir" chama o visualizador Power BI; quando não há `id_relatorio_pbi`, botão permanece visível e desabilitado | v1.0 | 🔴 |
| RF-FAV-05 | Favoritos devem ser pessoais e persistidos por usuário | `GET /usuarios/{id}/favoritos` retorna somente os registros do usuário informado; outro usuário não recebe os mesmos favoritos | v1.0 | 🔴 |

---

## RF-SEC — Segurança

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-SEC-01 | Senhas devem ser armazenadas com hash bcrypt (salt ≥ 12) | Banco não contém senhas em texto puro; comparação usa `bcrypt.compare()` | v1.0 | 🔴 |
| RF-SEC-02 | O sistema deve aplicar rate limiting de 100 requisições/minuto por IP | Após limite, resposta 429 com cabeçalho `Retry-After` | v1.0 | 🔴 |
| RF-SEC-03 | O sistema deve configurar headers de segurança HTTP | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy presentes em todas as respostas | v1.0 | 🔴 |
| RF-SEC-04 | O sistema deve permitir apenas uma sessão ativa por usuário (sessão única) | Novo login invalida a sessão anterior; sessão anterior recebe evento de revogação em até 20 segundos; token de sessão é registrado em `sessoes_autenticacao` com hash SHA-256 | v1.0 | 🔴 |
| RF-SEC-05 | O sistema deve detectar e registrar tentativa de sessão simultânea | Quando novo login encontra sessão ativa, gera registro em `logs_auditoria` com tipo `seguranca`, IP anterior e IP atual | v1.0 | 🔴 |
| RF-SEC-06 | O frontend deve notificar o usuário em tempo real quando sua sessão for revogada | Modal bloqueante exibido em até 20 segundos após a revogação, com mensagem explicativa e contador regressivo; redirecionamento automático para login com aviso | v1.0 | 🔴 |

---

## RF-CONF — Configurações

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-CONF-01 | Master deve configurar as credenciais Power BI (Client ID, Tenant ID, Client Secret) | Credenciais salvas no banco (`configuracoes_sistema`); Client Secret exibido mascarado após salvar com botão de olho que revela o valor real via `GET /configuracoes/pbi/secret` (restrito a Administrador/Master); integração PBI usa as credenciais configuradas | v1.0 | 🔴 |
| RF-CONF-02 | Somente Administrador e Master podem acessar o módulo de configurações; aba de Credenciais PBI é exclusiva do Master | Perfis sem permissão são redirecionados para Home; aba PBI não aparece para Administradores comuns | v1.0 | 🔴 |
| RF-CONF-03 | O sistema deve exibir o ambiente atual (produção/homologação) no header | Badge de ambiente visível para todos os admins | v1.0 | 🟡 |
| RF-CONF-04 | A página de Configurações deve ter abas: Expediente, Grupos de Exceção e Credenciais Power BI | Cada aba carrega e salva dados de forma independente; alterações refletem imediatamente no comportamento do sistema. A grade de Expediente é exibida em formato de tabela compacta (cabeçalho + uma linha por dia da semana) | v1.0 | 🔴 |
| RF-CONF-05 | Campos críticos (`id_workspace_pbi`, `id_relatorio_pbi`, credenciais PBI) devem ser exibidos somente-leitura por padrão, com botão "Editar" para entrar no modo de edição | Campo crítico em modo visualização: valor mascarado ou exibido, sem inputs editáveis. Botão "Editar" ativa o formulário | v1.0 | 🔴 |
| RF-CONF-06 | Alteração de campos críticos deve exigir confirmação com digitação explícita de "CONFIRMAR" | Modal abre com campo de texto; botão confirmar fica desabilitado até que o usuário digite exatamente "CONFIRMAR" (maiúsculas) | v1.0 | 🔴 |
| RF-CONF-07 | Toda alteração de campo crítico deve ser registrada em `logs_auditoria` com `tipo_evento='critico'` e salvar backup em `historico_config_critica` | Log gerado com valor anterior e novo; backup salvo com entidade, entidade_id, campo, valores e usuário responsável | v1.0 | 🔴 |
| RF-CONF-08 | Deve existir botão de histórico ("Histórico") junto a cada campo crítico que abre modal exibindo todas as alterações com ANTES → DEPOIS | Modal `ModalHistoricoCritico` carrega `GET /historico-critico?entidade=...&entidade_id=...`; exibe cada alteração com timestamp, usuário e comparação visual | v1.0 | 🔴 |

---

## RF-UX — Experiência de Usuário

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-UX-01 | O sistema deve exibir modais de confirmação e alerta personalizados no lugar dos dialogs nativos do navegador (`confirm()`, `alert()`) | Toda ação destrutiva ou irreversível abre um `ModalConfirmacao` com título, mensagem descritiva, ícone e variante visual (`danger`, `warning`, `primary`); erros dentro de modais são exibidos como mensagens inline; nenhum `window.confirm()` ou `window.alert()` é utilizado | v1.0 | 🟡 |
| RF-UX-02 | O painel administrativo deve exibir KPIs dinâmicos com subtextos contextuais | Card "Acessos negados hoje" compara o valor do dia com a média dos últimos 7 dias; card "Workspaces ativos" exibe percentual; card "Usuários bloqueados" exibe quantos hoje; card "Usuários ativos" exibe logins do dia | v1.0 | 🟡 |
| RF-UX-03 | O footer da sidebar deve exibir nome completo, e-mail e perfil do usuário logado em todas as páginas | Footer exibe: nome em destaque (bold), e-mail abaixo, perfil em verde; avatar com iniciais do primeiro e segundo nome | v1.0 | 🔴 |
| RF-UX-04 | A página Home de usuários não-admin deve exibir card de boas-vindas, status de expediente e lista de workspaces acessíveis com seus relatórios | Card de boas-vindas com nome e perfil; indicador de expediente no topbar; workspaces expansíveis com relatórios e botão "Abrir" (desabilitado quando sem ID PBI) | v1.0 | 🔴 |
| RF-UX-05 | Master e Administrador não devem aparecer na lista de usuários vinculados a um workspace | Lista de usuários do workspace exclui perfis `master` e `administrador`; contador de usuários no card do workspace também os exclui | v1.0 | 🔴 |
| RF-UX-06 | Na tela de usuários, a coluna Workspaces de Master/Administrador deve exibir "Todos os workspaces" em vez de listar individualmente | Badge com ícone de escudo exibido para perfis admin; usuários comuns continuam listando workspaces individuais | v1.0 | 🔴 |

---

## RF-DASH — Gráficos e Análise do Painel Administrativo

| ID | Descrição | Critério de Aceite | Versão | Prioridade |
|----|-----------|-------------------|--------|-----------|
| RF-DASH-01 | O painel administrativo deve exibir gráfico de área "Acessos ao longo do tempo" com linhas separadas para logins e acessos negados | Gráfico exibe dados reais; logins em cinza-escuro, negados em vermelho; tooltip interativo | v1.1 | 🟡 |
| RF-DASH-02 | O gráfico de acessos deve suportar filtro por período: diário (hora a hora), semanal (últimos 7 dias) e mensal (últimos 30 dias) | Botões de seleção de período; no modo diário, seletor de data disponível; padrão é semanal | v1.1 | 🟡 |
| RF-DASH-03 | O painel administrativo deve exibir gráfico de rosca "Distribuição por Workspace" com relatórios publicados por workspace | Fatias com cores do workspace; labels com linhas saindo das fatias exibindo nome e percentual | v1.1 | 🟡 |
| RF-DASH-04 | O painel administrativo deve exibir lista de ranking "Top Relatórios Acessados" com os mais visualizados no período | Lista ordenada por acessos; barra de fundo proporcional com cor do workspace; contador de acessos como badge | v1.1 | 🟡 |
| RF-DASH-05 | A lista de Top Relatórios deve suportar filtro por período (diário/semanal/mensal) com seletor de data no modo diário | Botões de seleção; padrão semanal; dados recarregados ao trocar período | v1.1 | 🟡 |
| RF-DASH-06 | O sistema deve registrar logs de acesso a relatórios Power BI com identificação do usuário, nome do relatório e timestamp | `LogAuditoria` com `tipo_evento = "relatorio"`, `detalhe` e `usuario_id` preenchidos; deduplicação de 10 segundos para evitar registro duplo em React StrictMode | v1.1 | 🟡 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | Adicionado RF-PBI-06: botão "Abrir" sempre visível, desabilitado quando sem ID PBI |
| 1.2 | Junho/2026 | Vinicius Soares | Adicionados RF-PERM-07 e RF-PERM-08: seleção de relatórios específicos no vínculo e filtragem server-side por nível de acesso |
| 1.3 | Junho/2026 | Vinicius Soares | Adicionados RF-SCHED-06 e RF-SCHED-07: endpoint de expediente server-side e exibição dinâmica no dashboard |
| 1.4 | Junho/2026 | Vinicius Soares | Atualizados RF-CONF-01/02, adicionado RF-CONF-04: página de Configurações implementada com abas Expediente, Grupos de Exceção e Credenciais PBI |
| 1.5 | Junho/2026 | Vinicius Soares | RF-CONF-04: grade de Expediente redesenhada para tabela compacta (cabeçalho + linha por dia) |
| 1.6 | Junho/2026 | Vinicius Soares | RF-AUD-04/05 atualizados, RF-AUD-07/08 adicionados: página de Auditoria implementada com filtros, paginação, exportação CSV e expansão de detalhes |
| 1.7 | Junho/2026 | Vinicius Soares | Adicionada seção RF-FAV: favoritos pessoais com listagem, busca, remoção e abertura via visualizador Power BI |
| 1.8 | Junho/2026 | Vinicius Soares | RF-AUD-02 atualizado: IP capturado via `X-Forwarded-For` com fallback; adicionada seção RF-UX com RF-UX-01 (modais customizados) e RF-UX-02 (KPIs dinâmicos com comparação semanal) |
| 1.9 | Junho/2026 | Vinicius Soares | RF-SCHED-08/09 atualizados: semântica de `ativo=false` (dia bloqueado) e `ignora_dia_inativo`; RF-SCHED-10 (indicador de expediente no topbar para todos os perfis); RF-AUD-06 (resolução de nome atual nos logs); RF-UX-03 a 06: footer da sidebar, home não-admin, filtro de admins em workspaces, badge "Todos os workspaces" |
| 2.0 | Junho/2026 | Vinicius Soares | RF-PBI-07/08: endpoint V2 GenerateToken (suporte DirectLake) e credenciais lidas do banco. RF-CONF-05 a 08: segurança de campos críticos (somente-leitura, confirmação digitada, log crítico, backup automático, histórico visual) |
| 2.1 | Junho/2026 | Vinicius Soares | Adicionada seção RF-WS (gestão de workspaces): RF-WS-01 a 06 (CRUD, arquivamento, exclusão permanente com cascade, vínculos) e RF-WS-07 (TopbarExpediente em todas as páginas) |
| 2.2 | Junho/2026 | Vinicius Soares | Adicionados RF-SEC-04 a 06: sessão única por usuário com revogação automática, detecção de sessão simultânea com log de auditoria e notificação em tempo real via modal bloqueante |
| 2.3 | Junho/2026 | Vinicius Soares | Adicionada seção RF-DASH (01-06): gráficos de área, rosca e ranking de relatórios com filtros por período e registro de log de acesso ao embed PBI |
| 2.3 | Junho/2026 | Vinicius Soares | RF-CONF-01 atualizado: Client Secret revelável via botão de olho (rota protegida). Adicionados RF-WS-08 (contadores nos cards), RF-WS-09 (degradê de status nos relatórios), RF-WS-10 (verificação do nome PBI no modal) |
