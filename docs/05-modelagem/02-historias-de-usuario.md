# Histórias de Usuário

> **Documento:** 05-modelagem/02-historias-de-usuario.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Formato Padrão

```
COMO [tipo de usuário],
QUERO [objetivo / ação],
PARA [benefício / resultado esperado].

Critérios de aceite:
- [ ] Critério 1
- [ ] Critério 2
```

---

## Épico 1 - Autenticação e Acesso

---

**US-01: Login com credenciais corporativas**

COMO colaborador da BrasilTerrenos,  
QUERO fazer login no portal com meu e-mail e senha corporativa,  
PARA acessar os relatórios Power BI do meu departamento de forma segura.

*Critérios de aceite:*
- [ ] Login com e-mail e senha válidos redireciona para a tela de principal
- [ ] Erro específico ao inserir credenciais inválidas com contagem de tentativas visível
- [ ] Botão de toggle para mostrar/ocultar a senha está presente
- [ ] Campo de e-mail com sugestão de autocomplete desativada

---

**US-02: Proteção contra tentativas excessivas**

COMO administrador SuperAdmin,  
QUERO que contas sejam bloqueadas automaticamente após 5 tentativas inválidas consecutivas,  
PARA proteger o sistema contra ataques de força bruta e acesso não autorizado.

*Critérios de aceite:*
- [ ] Na 5ª tentativa inválida, conta é bloqueada automaticamente
- [ ] Mensagem de bloqueio diferente da mensagem de credenciais inválidas
- [ ] Evento de bloqueio registrado no log com IP e timestamp
- [ ] Desbloqueio disponível apenas para Super Admin na interface

---

**US-03: Controle de acesso por horário de expediente**

COMO administrador SuperAdmin,  
QUERO que o acesso ao portal seja bloqueado fora do horário de expediente para usuários sem exceção,  
PARA garantir que dados corporativos sensíveis não sejam acessados em horários não monitorados.

*Critérios de aceite:*
- [ ] Tentativa de login fora do expediente retorna mensagem com horário permitido
- [ ] Usuário em grupo de exceção consegue acessar dentro da janela de exceção
- [ ] Evento de acesso negado por expediente registrado no log
- [ ] Regra de expediente é verificada a cada tentativa de login, não apenas na criação de sessão

---

## Épico 2 - Consumo de Relatórios

---

**US-05: Navegar por workspaces do departamento**

COMO analista do departamento de Controladoria,  
QUERO visualizar os workspaces acessíveis para mim de forma organizada,  
PARA encontrar facilmente os relatórios do meu departamento sem navegar por dados de outros departamentos.

*Critérios de aceite:*
- [ ] Apenas workspaces do usuário são exibidos na listagem
- [ ] Cada workspace exibe: nome, ícone, quantidade de relatórios e usuários
- [ ] Clique no workspace abre a tela de detalhe com os relatórios disponíveis
- [ ] Workspaces indisponíveis não aparecem na listagem do usuário

---

**US-06: Visualizar relatório Power BI inline no portal**

COMO gerente de Marketing,  
QUERO visualizar o relatório de Pipeline de Vendas diretamente no portal,  
PARA acessar os dados analíticos sem precisar navegar para o Power BI Service.

*Critérios de aceite:*
- [ ] Relatório renderizado dentro do portal sem abrir nova aba ou janela
- [ ] Carregamento do relatório em menos de 3 segundos (p95)
- [ ] Relatório mantém todas as funcionalidades de interação do PBI (filtros, drill-down)
- [ ] Token expirado renovado automaticamente sem interrupção visível ao usuário
- [ ] Acesso negado exibe mensagem amigável (não erro técnico)

---

**US-07: Favoritar relatórios de uso frequente**

COMO analista,  
QUERO marcar relatórios como favoritos,  
PARA acessá-los rapidamente na tela de favoritos sem navegar pelo workspace toda vez.

*Critérios de aceite:*
- [ ] Ícone de favoritar visível em cada relatório na listagem
- [ ] Relatório favoritado aparece na seção Favoritos
- [ ] Favoritos são pessoais (não aparecem para outros usuários)
- [ ] Favorito pode ser removido da seção Favoritos ou da listagem de relatórios

---

**US-08: Mensagem clara ao tentar acessar fora do horário**

COMO operador de plantão,  
QUERO receber uma mensagem clara quando tentar acessar o portal fora do horário de expediente,  
PARA entender o motivo do bloqueio e saber o que fazer.

*Critérios de aceite:*
- [ ] Mensagem exibe o horário permitido de acesso
- [ ] Mensagem sugere contato com o administrador caso necessário
- [ ] Mensagem não revela detalhes de segurança do sistema

---

## Épico 3 - Administração de Usuários

---

**US-09: Cadastrar novo colaborador**

COMO SuperAdmin,  
QUERO cadastrar novos colaboradores no portal informando nome, e-mail, perfil e workspaces de acesso,  
PARA que eles possam acessar imediatamente os relatórios do seu departamento após admissão.

*Critérios de aceite:*
- [ ] Formulário com campos: nome, e-mail, perfil, workspace(s), relatório(s)
- [ ] E-mail único validado: erro se já cadastrado
- [ ] Senha temporária padrão gerada
- [ ] Usuário criado aparece na listagem com status `ativo`
- [ ] Evento de criação registrado no log com o autor da ação

---

**US-10: Bloquear acesso de usuário suspeito**

COMO administrador de segurança,  
QUERO bloquear imediatamente o acesso de um usuário suspeito sem precisar excluí-lo,  
PARA interromper um potencial acesso indevido mantendo o histórico e podendo reativar o usuário depois.

*Critérios de aceite:*
- [ ] Botão de bloquear disponível na listagem de usuários
- [ ] Modal de confirmação antes de bloquear
- [ ] Usuário bloqueado não consegue fazer login mesmo com credenciais válidas
- [ ] Sessões ativas do usuário são invalidadas imediatamente
- [ ] Evento de bloqueio registrado no log (quem bloqueou e quando)
- [ ] Botão de desbloquear disponível para reverter a ação

---

**US-11: Conceder permissão a relatórios específicos**

COMO administrador,  
QUERO conceder a um usuário específico acesso apenas a determinados relatórios dentro de um workspace,  
PARA seguir o princípio do menor privilégio sem criar um perfil inteiro para isso.

*Critérios de aceite:*
- [x] Ao selecionar "Relatórios específicos" no modal de usuário, sistema exibe checklist com relatórios publicados do workspace
- [x] Relatórios pré-selecionados ao editar usuário existente com permissões já configuradas
- [x] Salvar persiste os relatórios via `PUT /workspaces/{ws}/usuarios/{id}/relatorios`
- [x] Alteração registrada no log de auditoria com lista de relatórios selecionados
- [x] Usuário passa a ver apenas os relatórios permitidos individualmente

---

## Épico 4 - Governança e Auditoria

---

**US-13: Exportar log de auditoria para compliance**

COMO compliance officer,  
QUERO exportar os logs de auditoria filtrados por período e tipo de evento,  
PARA gerar relatórios de conformidade para auditorias internas e externas.

*Critérios de aceite:*
- [ ] Filtros combinados: data de início, data de fim, usuário, módulo, tipo
- [ ] Exportação gera arquivo CSV com todos os campos (timestamp, usuário, IP, detalhe)
- [ ] Arquivo com nome no formato `auditoria_YYYY-MM-DD.csv`
- [ ] Encoding UTF-8 para caracteres especiais
- [ ] Registros exportados correspondem exatamente aos filtros aplicados

---

**US-14: Receber alertas de eventos críticos**

COMO administrador de segurança,  
QUERO receber alertas visuais imediatos sobre eventos críticos (bloqueios, tentativas de invasão),  
PARA reagir rapidamente a incidentes de segurança sem precisar monitorar o log continuamente.

*Critérios de aceite:*
- [ ] Badge de alertas no topbar atualiza sem precisar recarregar a página
- [ ] Lista de eventos críticos exibida no painel admin
- [ ] Eventos críticos distinguidos visualmente dos eventos normais (cor vermelha)
- [ ] Clique no alerta abre o detalhe do evento no módulo de logs

---

**US-15: Configurar regras de expediente com exceções**

COMO administrador,  
QUERO definir o horário de expediente e criar grupos de exceção para equipes de plantão,  
PARA garantir que a regra padrão se aplique à maioria dos usuários enquanto equipes específicas mantêm acesso necessário.

*Critérios de aceite:*
- [ ] Interface de configuração de dias da semana com horário de início e fim
- [ ] Toggle para ativar/desativar o bloqueio padrão fora do expediente
- [ ] Criação de grupo de exceção com nome, membros e janela de horário
- [ ] Exceção individual por usuário com janela de horário separada
- [ ] Regras entram em vigor imediatamente após salvar

---

## Épico 5 — Painel Administrativo e Configurações

---

**US-16: Monitorar KPIs globais do portal**

COMO SuperAdmin/Admin,  
QUERO ver no painel administrativo os principais indicadores do portal (usuários ativos, bloqueados, workspaces, alertas),  
PARA ter visibilidade do estado do sistema sem precisar navegar por cada módulo.

*Critérios de aceite:*
- [x] Cards de KPI com: usuários ativos, usuários bloqueados, acessos negados hoje, workspaces ativos
- [ ] Lista de eventos críticos recentes com link para o log completo
- [ ] Status dos serviços integrados (Power BI, autenticação, banco) com indicador visual
- [x] Dados atualizados a cada acesso à página
- [x] Subtexto de "Acessos negados hoje" compara com a média dos últimos 7 dias (`+X% vs média semanal`, `-X%` ou `igual à média`)
- [x] Subtexto de "Workspaces ativos" exibe percentual de ativos sobre o total
- [x] Subtexto de "Usuários bloqueados" exibe quantos foram bloqueados no dia
- [x] Subtexto de "Usuários ativos" exibe quantos logins ocorreram hoje
- [x] Barras de distribuição por workspace usam a cor configurada em cada workspace

---

**US-17: Configurar integração com Power BI Embedded**

COMO Super Admin,  
QUERO configurar as credenciais do Power BI Embedded (Client ID, Tenant ID) diretamente pelo portal,  
PARA ativar ou reconfigurar a integração sem precisar acessar o servidor ou o código-fonte.

*Critérios de aceite:*
- [ ] Formulário com campos: Client ID, Tenant ID, Workspace ID, Client Secret (mascarado)
- [ ] Botão "Testar Conexão" valida as credenciais antes de salvar
- [ ] Client Secret não é exibido em texto puro após salvar
- [ ] Configurações salvas de forma criptografada
- [ ] Somente Super Admin tem acesso a esta seção

---

---

**US-18: Arquivar e reativar workspace**

COMO administrador,  
QUERO arquivar um workspace sem excluí-lo e poder reativá-lo quando necessário,  
PARA desativar temporariamente workspaces sem perder configurações, relatórios ou vínculos de usuários.

*Critérios de aceite:*
- [x] Botão "Arquivar" disponível no detalhe do workspace para admins
- [x] Workspace arquivado não aparece na listagem de usuários não-admin
- [x] Toggle "Mostrar arquivados" na listagem de workspaces (visível apenas para admins)
- [x] Cards de workspaces arquivados exibem faixa visual de status e botão "Reativar"
- [x] Admin pode acessar e visualizar workspaces arquivados normalmente
- [x] Reativar workspace restaura visibilidade para todos os usuários vinculados
- [x] Arquivamento e reativação registrados no log de auditoria

---

**US-19: Aba de usuários vinculados restrita a admins**

COMO usuário comum,  
QUERO visualizar apenas os relatórios do workspace ao acessá-lo,  
PARA que informações sobre outros usuários vinculados não fiquem expostas.

*Critérios de aceite:*
- [x] Aba "Usuários vinculados" visível apenas para Admin e Super Admin
- [x] Usuários com perfil Operador ou Gerente veem somente a aba "Relatórios"

---

---

**US-20: Confirmações de ações destrutivas com modal customizado**

COMO usuário do portal (qualquer perfil),  
QUERO que ações irreversíveis (arquivar, excluir, remover) exibam uma confirmação visual integrada ao portal,  
PARA ter clareza sobre o que está prestes a acontecer antes de confirmar.

*Critérios de aceite:*
- [x] Nenhum `window.confirm()` ou `window.alert()` nativo do navegador é utilizado
- [x] Ações destrutivas (arquivar workspace, excluir relatório, remover usuário, excluir grupo) abrem `ModalConfirmacao` com variante `danger`
- [x] Ações neutras (reativar workspace) abrem `ModalConfirmacao` com variante `primary`
- [x] Erros de operação dentro de modais existentes são exibidos como mensagem inline (não em modal sobreposto)
- [x] Clicar fora do modal de confirmação cancela a ação
- [x] Modal exibe: ícone contextual, título, mensagem descritiva, botão cancelar e botão confirmar
- [x] Botões dentro do modal são sempre centralizados

---

**US-21: Captura de IP real em eventos de auditoria**

COMO administrador de segurança,  
QUERO que o IP registrado nos logs de auditoria reflita o endereço real do usuário,  
PARA rastrear acessos suspeitos mesmo quando o portal estiver atrás de um proxy ou balanceador de carga.

*Critérios de aceite:*
- [x] IP capturado via header `X-Forwarded-For` quando presente (cenário de proxy reverso)
- [x] Fallback para `request.client.host` quando `X-Forwarded-For` não está disponível
- [x] IP preenchido em todos os eventos: login bem-sucedido, tentativas falhas, bloqueio, e todas as operações CRUD do portal
- [x] Campo IP visível e filtrável na página de Auditoria

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | US-11 atualizada com critérios implementados; US-18 e US-19 adicionadas |
| 1.2 | Junho/2026 | Vinicius Soares | US-16 atualizada com KPIs dinâmicos e comparação semanal; US-20 adicionada (modais customizados); US-21 adicionada (captura de IP real) |