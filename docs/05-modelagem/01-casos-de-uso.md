# Casos de Uso

> **Documento:** 05-modelagem/01-casos-de-uso.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Atores do Sistema

| Ator        | Descrição                              |
|-------------|----------------------------------------|
| **Usuário** | Qualquer pessoa autenticada no sistema |
| **Colaborador** | Colaborador com acesso a relatórios específicos |
| **Coordenador** | Líder departamental com acesso ao workspace do seu departamento |
| **Administrador** | Administrador do portal com acesso ao painel administrativo |
| **Master** | Administrador com acesso total, incluindo configurações do sistema |
| **Sistema** | Processos automáticos internos (renovação de token, verificação de expediente) |
| **Azure AD** | Serviço externo de autenticação Microsoft |
| **PBI Service** | Microsoft Power BI Service (API externa) |

---

## UC-01 — Autenticar no Sistema

**Ator principal:** Usuário  
**Pré-condição:** Usuário cadastrado no sistema com status `ativo`  
**Pós-condição:** Sessão iniciada; tela principal exibida

### Fluxo Principal
1. Usuário acessa o portal e visualiza a tela de login.
2. Usuário insere e-mail e senha.
3. Sistema valida as credenciais via bcrypt.
4. Sistema verifica se o usuário está ativo e não bloqueado.
5. Sistema verifica se o acesso está dentro do horário de expediente.
6. Sistema emite access token (JWT) e refresh token (`httpOnly cookie`).
7. Sistema registra evento de login bem-sucedido no log de auditoria.
8. Sistema exibe tela principal.

### Fluxos Alternativos
- **A1: Credenciais inválidas:** Sistema exibe mensagem de erro com contagem de tentativas. Contador incrementado. IP da tentativa registrado no log.
- **A2: Quinta tentativa inválida:** Sistema bloqueia a conta, exibe mensagem específica de bloqueio, registra evento de segurança no log com IP.
- **A3: Conta inativa:** Sistema exibe mensagem genérica sem revelar motivo.
- **A4: Conta bloqueada:** Sistema exibe mensagem de conta bloqueada, orienta contatar suporte.
- **A5: Fora do horário de expediente:** Sistema exibe mensagem com horário permitido; não revela detalhes de segurança. Evento registrado com IP.
- **A6: Usuário em grupo de exceção fora do horário:** Sistema valida a janela do grupo; se dentro da janela, prossegue; se fora, bloqueia.

---

## UC-02 - Visualizar Relatório Power BI

**Ator principal:** Colaborador, Coordenador  
**Pré-condição:** Usuário autenticado; relatório com status `publicado`; usuário com permissão no workspace/relatório  
**Pós-condição:** Relatório renderizado inline no portal  

### Fluxo Principal
1. Usuário navega até a seção Workspaces.
2. Sistema exibe apenas os workspaces acessíveis pelo usuário.
3. Usuário seleciona um workspace.
4. Sistema exibe relatórios do workspace filtrados pela permissão do usuário.
5. Usuário seleciona o relatório desejado.
6. Sistema (backend) valida a permissão do usuário para aquele relatório.
7. Sistema (backend) solicita token de embed ao Azure AD via Service Principal.
8. Azure AD retorna access token.
9. Sistema (backend) chama a API Power BI `GenerateToken` com o access token.
10. PBI Service retorna embed token e embed URL.
11. Sistema retorna `{ embedToken, embedUrl, reportId }` ao frontend.
12. Frontend inicializa o `powerbi.embed()` com as configurações.
13. Relatório é renderizado dentro do iframe do portal.
14. Sistema registra acesso ao relatório no log de auditoria.

### Fluxos Alternativos
- **A1: Usuário sem permissão no relatório:** Backend retorna 403; frontend exibe mensagem de acesso negado; evento registrado no log.
- **A2: Token de embed expirado durante visualização:** Sistema renova o token em background; usuário não percebe interrupção.
- **A3: PBI Service indisponível:** Sistema exibe mensagem amigável de indisponibilidade; portal continua funcionando para outros módulos.
- **A4: Relatório não encontrado no PBI Service:** Sistema exibe mensagem de relatório indisponível; sugere contatar administrador.

---

## UC-03 - Gerenciar Permissões de Usuário

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado com perfil adequado  
**Pós-condição:** Permissões salvas; log de auditoria registrado  

### Fluxo Principal
1. Admin acessa o módulo de Usuários.
2. Admin cria ou edita um usuário.
3. Sistema exibe os workspaces disponíveis com checkbox de acesso e seletor de nível (`Acesso total` ou `Relatórios específicos`).
4. Ao selecionar `Relatórios específicos`, sistema exibe checklist com os relatórios publicados do workspace.
5. Admin marca os relatórios permitidos.
6. Admin clica em "Salvar".
7. Sistema persiste os acessos por workspace (`PUT /usuarios/{id}/acessos`) e, para cada workspace parcial, os relatórios selecionados (`PUT /workspaces/{ws}/usuarios/{id}/relatorios`).
8. Sistema registra no log: quem alterou, workspaces e relatórios afetados.

### Fluxos Alternativos
- **A1: Administrador tenta alterar permissão de Master:** Sistema retorna 403.
- **A2: Erro de validação:** Sistema retorna mensagem de erro; alterações não são salvas.
- **A3: Admin cancela:** Alterações são descartadas; log não é gerado.

---

## UC-04 - Configurar Regras de Expediente

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado  
**Pós-condição:** Regras de expediente atualizadas; vigência imediata  

### Fluxo Principal
1. Admin acessa o módulo de Expediente.
2. Sistema exibe configuração atual: horário por dia da semana e toggle de bloqueio.
3. Admin configura horário de início e fim.
4. Admin define quais dias da semana estão ativos.
5. Admin ativa o toggle "Bloquear por padrão fora do expediente".
6. Admin gerencia grupos de exceção (adicionar/remover membros, definir janelas de horário).
7. Admin clica em "Salvar Regras".
8. Sistema persiste a configuração.
9. Sistema registra alteração no log de auditoria.
10. Regras entram em vigor imediatamente para as próximas tentativas de login.

### Fluxos Alternativos
- **A1: Horário de início maior que horário de fim:** Sistema valida e exibe mensagem de erro; não salva.
- **A2: Grupo sem membros:** Sistema permite salvar (grupo pode ser populado depois).

---

## UC-05 - Criar Novo Usuário

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado  
**Pós-condição:** Usuário criado

### Fluxo Principal
1. Admin acessa o módulo de Usuários e clica em "Novo Usuário".
2. Sistema exibe modal de criação.
3. Admin preenche: nome, e-mail, perfil, workspace(s) e relatório(s) de acesso.
4. Admin confirma criação.
5. Sistema valida dados: e-mail único, campos obrigatórios preenchidos.
6. Sistema gera senha temporária padrão.
7. Sistema persiste o usuário com status `ativo` e senha com hash bcrypt.
8. Sistema registra criação no log de auditoria.
10. Sistema exibe o novo usuário na listagem.

### Fluxos Alternativos
- **A1: E-mail já cadastrado:** Sistema exibe mensagem "E-mail já utilizado por outro usuário".

---

## UC-06 - Consultar e Exportar Log de Auditoria

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado  
**Pós-condição:** Log exibido e/ou exportado  

### Fluxo Principal
1. Admin acessa o módulo de Logs e Auditoria.
2. Sistema exibe log paginado, ordenado por data decrescente.
3. Admin aplica filtros: período, usuário, módulo, tipo de evento, IP.
4. Sistema retorna registros correspondentes.
5. Admin expande um registro para ver detalhes completos.
6. Admin clica em "Exportar CSV".
7. Sistema gera arquivo CSV com os registros filtrados.
8. Download iniciado no navegador.

### Fluxos Alternativos
- **A1: Nenhum resultado para os filtros:** Sistema exibe estado vazio com sugestão de ampliar os filtros.
- **A2: Volume muito grande (>50k registros):** Sistema processa exportação de forma assíncrona e notifica quando o arquivo está pronto.

---

## UC-07 - Bloquear / Desbloquear Usuário

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado; usuário-alvo existe  
**Pós-condição:** Status do usuário atualizado; sessões ativas invalidadas  

### Fluxo Principal
1. Admin acessa a listagem de usuários.
2. Admin clica no botão de bloquear do usuário-alvo.
3. Sistema exibe `ModalConfirmacao` customizado (variante `danger`) com título, descrição e botões centralizados.
4. Admin confirma.
5. Sistema atualiza status para `bloqueado`.
6. Sistema invalida quaisquer sessões ativas do usuário bloqueado.
7. Sistema registra o bloqueio no log de auditoria (quem bloqueou, quando).
8. Usuário bloqueado recebe 403 em qualquer requisição subsequente.

### Fluxos Alternativos
- **A1: Desbloquear:** Fluxo inverso; zera contador de tentativas; log registra desbloqueio.
- **A2: Administrador tenta bloquear Master:** Sistema retorna 403; Master não pode ser bloqueado por Administrador.

---

## UC-08 - Configurar Integração Power BI

**Ator principal:** Master  
**Pré-condição:** Master autenticado; dados do Service Principal disponíveis  
**Pós-condição:** Integração PBI configurada e testada  

### Fluxo Principal
1. Master acessa o módulo de Configurações.
2. Master insere Client ID, Tenant ID e Client Secret do Service Principal.
3. Master insere o Workspace ID padrão do Power BI.
4. Master clica em "Testar Conexão".
5. Sistema tenta autenticar no Azure AD com as credenciais fornecidas.
6. Sistema tenta listar workspaces do PBI Service.
7. Sistema exibe resultado do teste (sucesso ou falha com detalhe do erro).
8. Master clica em "Salvar".
9. Sistema armazena as credenciais de forma criptografada.
10. Sistema registra alteração nas configurações no log de auditoria.

---

## UC-09 — Arquivar e Reativar Workspace

**Ator principal:** Administrador, Master  
**Pré-condição:** Ator autenticado; workspace existe  
**Pós-condição:** Status do workspace atualizado; log de auditoria registrado  

### Fluxo Principal — Arquivar
1. Admin acessa o detalhe de um workspace.
2. Admin clica em "Arquivar".
3. Sistema exibe `ModalConfirmacao` customizado (variante `danger`) com descrição do impacto da ação.
4. Admin confirma.
5. Sistema atualiza `status = "arquivado"` via `PATCH /workspaces/{id}/arquivar`.
6. Workspace deixa de aparecer para usuários não-admin.
7. Sistema registra no log de auditoria.

### Fluxo Principal — Reativar
1. Admin acessa a lista de workspaces e ativa o toggle "Mostrar arquivados".
2. Sistema exibe workspaces arquivados com faixa visual de status e botão "Reativar".
3. Admin clica em "Reativar" no card ou no detalhe do workspace.
4. Sistema exibe `ModalConfirmacao` customizado (variante `primary`) com descrição da ação.
5. Admin confirma.
6. Sistema atualiza `status = "ativo"` via `PATCH /workspaces/{id}/reativar`.
7. Workspace volta a aparecer normalmente para todos os usuários vinculados.
8. Sistema registra no log de auditoria.

### Fluxos Alternativos
- **A1: Usuário não-admin tenta acessar workspace arquivado:** Workspace não aparece na listagem; acesso bloqueado.
- **A2: Admin acessa workspace arquivado:** Admin pode visualizar e gerenciar o workspace, inclusive reativá-lo.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
| 1.1 | Junho/2026 | Vinicius Soares | UC-03 atualizado com fluxo real de permissões por relatório; UC-09 adicionado (arquivar/reativar workspace) |
| 1.2 | Junho/2026 | Vinicius Soares | UC-01 atualizado: IP registrado em todas as tentativas de login; UC-07 e UC-09 atualizados: `ModalConfirmacao` customizado no lugar de dialogs nativos |