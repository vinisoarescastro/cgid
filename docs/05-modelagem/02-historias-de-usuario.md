# Histórias de Usuário

> **Documento:** 05-modelagem/02-historias-de-usuario.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Formato Padrão

```
Como [tipo de usuário],
quero [objetivo / ação],
para [benefício / resultado esperado].

Critérios de aceite:
- [ ] Critério 1
- [ ] Critério 2
```

---

## Épico 1 — Autenticação e Acesso

---

**US-01 — Login com credenciais corporativas**

Como colaborador da BrasilTerrenos,  
quero fazer login no portal com meu e-mail e senha corporativa,  
para acessar os relatórios Power BI do meu departamento de forma segura.

*Critérios de aceite:*
- [ ] Login com e-mail e senha válidos redireciona para a tela de boas-vindas
- [ ] Erro específico ao inserir credenciais inválidas com contagem de tentativas visível
- [ ] Botão de toggle para mostrar/ocultar a senha está presente
- [ ] Campo de e-mail com sugestão de autocomplete desativada

---

**US-02 — Proteção contra tentativas excessivas**

Como administrador de TI,  
quero que contas sejam bloqueadas automaticamente após 5 tentativas inválidas consecutivas,  
para proteger o sistema contra ataques de força bruta e acesso não autorizado.

*Critérios de aceite:*
- [ ] Na 5ª tentativa inválida, conta é bloqueada automaticamente
- [ ] Mensagem de bloqueio diferente da mensagem de credenciais inválidas
- [ ] Evento de bloqueio registrado no log com IP e timestamp
- [ ] Desbloqueio disponível apenas para Admin/Super Admin na interface

---

**US-03 — Controle de acesso por horário de expediente**

Como compliance officer,  
quero que o acesso ao portal seja bloqueado fora do horário de expediente para usuários sem exceção,  
para garantir que dados corporativos sensíveis não sejam acessados em horários não monitorados.

*Critérios de aceite:*
- [ ] Tentativa de login fora do expediente retorna mensagem com horário permitido
- [ ] Usuário em grupo de exceção consegue acessar dentro da janela de exceção
- [ ] Evento de acesso negado por expediente registrado no log
- [ ] Regra de expediente é verificada a cada tentativa de login, não apenas na criação de sessão

---

**US-04 — Recuperação de senha self-service**

Como colaborador,  
quero recuperar minha senha pelo e-mail caso eu a esqueça,  
para não precisar abrir chamado no TI para situações rotineiras.

*Critérios de aceite:*
- [ ] Link de recuperação enviado para o e-mail cadastrado em até 1 minuto
- [ ] Link expira em 1 hora
- [ ] Nova senha exige mínimo de 8 caracteres com letras e números
- [ ] Após redefinição bem-sucedida, usuário é redirecionado para o login
- [ ] Evento de redefinição de senha registrado no log

---

**US-05 — MFA para perfis administrativos**

Como Super Admin,  
quero habilitar autenticação multifator (MFA) para perfis Admin e Super Admin,  
para aumentar a segurança de contas com acesso privilegiado ao sistema.

*Critérios de aceite:*
- [ ] Após a senha, Admin é solicitado a inserir código TOTP de 6 dígitos
- [ ] Código gerado por apps como Google Authenticator ou Authy é aceito
- [ ] Código inválido impede o acesso e incrementa o contador de tentativas
- [ ] QR Code para configuração do autenticador exibido no primeiro setup
- [ ] Backup codes de emergência gerados no setup

---

## Épico 2 — Consumo de Relatórios

---

**US-06 — Navegar por workspaces do departamento**

Como analista do departamento de Controladoria,  
quero visualizar os workspaces acessíveis para mim de forma organizada,  
para encontrar facilmente os relatórios do meu departamento sem navegar por dados de outros departamentos.

*Critérios de aceite:*
- [ ] Apenas workspaces do usuário são exibidos na listagem
- [ ] Cada workspace exibe: nome, ícone, quantidade de relatórios e usuários
- [ ] Clique no workspace abre a tela de detalhe com os relatórios disponíveis
- [ ] Workspaces indisponíveis não aparecem na listagem do usuário

---

**US-07 — Visualizar relatório Power BI inline no portal**

Como gerente de Marketing,  
quero visualizar o relatório de Pipeline de Vendas diretamente no portal,  
para acessar os dados analíticos sem precisar navegar para o Power BI Service.

*Critérios de aceite:*
- [ ] Relatório renderizado dentro do portal sem abrir nova aba ou janela
- [ ] Carregamento do relatório em menos de 3 segundos (p95)
- [ ] Relatório mantém todas as funcionalidades de interação do PBI (filtros, drill-down)
- [ ] Token expirado renovado automaticamente sem interrupção visível ao usuário
- [ ] Acesso negado exibe mensagem amigável (não erro técnico)

---

**US-08 — Favoritar relatórios de uso frequente**

Como analista,  
quero marcar relatórios como favoritos,  
para acessá-los rapidamente na tela de favoritos sem navegar pelo workspace toda vez.

*Critérios de aceite:*
- [ ] Ícone de favoritar visível em cada relatório na listagem
- [ ] Relatório favoritado aparece na seção Favoritos
- [ ] Favoritos são pessoais (não aparecem para outros usuários)
- [ ] Favorito pode ser removido da seção Favoritos ou da listagem de relatórios

---

**US-09 — Mensagem clara ao tentar acessar fora do horário**

Como operador de plantão,  
quero receber uma mensagem clara quando tentar acessar o portal fora do horário de expediente,  
para entender o motivo do bloqueio e saber o que fazer.

*Critérios de aceite:*
- [ ] Mensagem exibe o horário permitido de acesso
- [ ] Mensagem sugere contato com o administrador caso necessário
- [ ] Mensagem não revela detalhes de segurança do sistema

---

## Épico 3 — Administração de Usuários

---

**US-10 — Cadastrar novo colaborador**

Como administrador de TI,  
quero cadastrar novos colaboradores no portal informando nome, e-mail, perfil e workspaces de acesso,  
para que eles possam acessar imediatamente os relatórios do seu departamento após admissão.

*Critérios de aceite:*
- [ ] Formulário com campos: nome, e-mail, perfil, workspace(s), relatório(s)
- [ ] E-mail único validado: erro se já cadastrado
- [ ] Senha temporária gerada e enviada por e-mail automaticamente
- [ ] Usuário criado aparece na listagem com status `ativo`
- [ ] Evento de criação registrado no log com o autor da ação

---

**US-11 — Bloquear acesso de usuário suspeito**

Como administrador de segurança,  
quero bloquear imediatamente o acesso de um usuário suspeito sem precisar excluí-lo,  
para interromper um potencial acesso indevido mantendo o histórico e podendo reativar o usuário depois.

*Critérios de aceite:*
- [ ] Botão de bloquear disponível na listagem de usuários
- [ ] Modal de confirmação antes de bloquear
- [ ] Usuário bloqueado não consegue fazer login mesmo com credenciais válidas
- [ ] Sessões ativas do usuário são invalidadas imediatamente
- [ ] Evento de bloqueio registrado no log (quem bloqueou e quando)
- [ ] Botão de desbloquear disponível para reverter a ação

---

**US-12 — Conceder permissão a relatórios específicos**

Como administrador,  
quero conceder a um usuário específico acesso apenas a determinados relatórios dentro de um workspace,  
para seguir o princípio do menor privilégio sem criar um perfil inteiro para isso.

*Critérios de aceite:*
- [ ] Interface de permissão por usuário com seleção de relatórios específicos
- [ ] Permissão individual sobrepõe a permissão do perfil do usuário
- [ ] Alteração registrada no log com estado anterior e novo
- [ ] Usuário passa a ver apenas os relatórios permitidos individualmente

---

**US-13 — Visualizar tela de boas-vindas personalizada**

Como novo colaborador acessando o portal pela primeira vez,  
quero ver uma tela de boas-vindas com informações sobre meus acessos,  
para entender rapidamente o que está disponível para mim.

*Critérios de aceite:*
- [ ] Tela exibe nome do usuário, perfil e chips com número de workspaces e relatórios
- [ ] Texto descritivo adapta-se ao perfil (admin vs. operador)
- [ ] Botão "Acessar o portal" navega para o dashboard

---

## Épico 4 — Governança e Auditoria

---

**US-14 — Exportar log de auditoria para compliance**

Como compliance officer,  
quero exportar os logs de auditoria filtrados por período e tipo de evento,  
para gerar relatórios de conformidade para auditorias internas e externas.

*Critérios de aceite:*
- [ ] Filtros combinados: data de início, data de fim, usuário, módulo, tipo
- [ ] Exportação gera arquivo CSV com todos os campos (timestamp, usuário, IP, detalhe)
- [ ] Arquivo com nome no formato `auditoria_YYYY-MM-DD.csv`
- [ ] Encoding UTF-8 para caracteres especiais
- [ ] Registros exportados correspondem exatamente aos filtros aplicados

---

**US-15 — Receber alertas de eventos críticos**

Como administrador de segurança,  
quero receber alertas visuais imediatos sobre eventos críticos (bloqueios, tentativas de invasão),  
para reagir rapidamente a incidentes de segurança sem precisar monitorar o log continuamente.

*Critérios de aceite:*
- [ ] Badge de alertas no topbar atualiza sem precisar recarregar a página
- [ ] Lista de eventos críticos exibida no painel admin
- [ ] Eventos críticos distinguidos visualmente dos eventos normais (cor vermelha)
- [ ] Clique no alerta abre o detalhe do evento no módulo de logs

---

**US-16 — Configurar regras de expediente com exceções**

Como administrador,  
quero definir o horário de expediente e criar grupos de exceção para equipes de plantão,  
para garantir que a regra padrão se aplique à maioria dos usuários enquanto equipes específicas mantêm acesso necessário.

*Critérios de aceite:*
- [ ] Interface de configuração de dias da semana com horário de início e fim
- [ ] Toggle para ativar/desativar o bloqueio padrão fora do expediente
- [ ] Criação de grupo de exceção com nome, membros e janela de horário
- [ ] Exceção individual por usuário com janela de horário separada
- [ ] Regras entram em vigor imediatamente após salvar

---

## Épico 5 — Painel Administrativo e Configurações

---

**US-17 — Monitorar KPIs globais do portal**

Como diretora de TI,  
quero ver no painel administrativo os principais indicadores do portal (usuários ativos, bloqueados, workspaces, alertas),  
para ter visibilidade do estado do sistema sem precisar navegar por cada módulo.

*Critérios de aceite:*
- [ ] Cards de KPI com: usuários ativos, usuários bloqueados, acessos negados hoje, workspaces ativos
- [ ] Lista de eventos críticos recentes com link para o log completo
- [ ] Status dos serviços integrados (Power BI, autenticação, banco) com indicador visual
- [ ] Dados atualizados a cada acesso à página

---

**US-18 — Configurar integração com Power BI Embedded**

Como Super Admin,  
quero configurar as credenciais do Power BI Embedded (Client ID, Tenant ID) diretamente pelo portal,  
para ativar ou reconfigurar a integração sem precisar acessar o servidor ou o código-fonte.

*Critérios de aceite:*
- [ ] Formulário com campos: Client ID, Tenant ID, Workspace ID, Client Secret (mascarado)
- [ ] Botão "Testar Conexão" valida as credenciais antes de salvar
- [ ] Client Secret não é exibido em texto puro após salvar
- [ ] Configurações salvas de forma criptografada
- [ ] Somente Super Admin tem acesso a esta seção

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |