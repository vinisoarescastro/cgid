# Casos de Uso

> **Documento:** 05-modelagem/01-casos-de-uso.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Atores do Sistema

| Ator | Descrição |
|------|-----------|
| **Usuário** | Qualquer pessoa autenticada no sistema |
| **Operador** | Colaborador com acesso a relatórios específicos |
| **Gerente** | Líder departamental com acesso ao workspace do seu departamento |
| **Admin** | Administrador do portal com acesso ao painel administrativo |
| **Super Admin** | Administrador com acesso total, incluindo configurações do sistema |
| **Sistema** | Processos automáticos internos (renovação de token, verificação de expediente) |
| **Azure AD** | Serviço externo de autenticação Microsoft |
| **PBI Service** | Microsoft Power BI Service (API externa) |

---

## UC-01 — Autenticar no Sistema

**Ator principal:** Usuário  
**Pré-condição:** Usuário cadastrado no sistema com status `ativo`  
**Pós-condição:** Sessão iniciada; tela de boas-vindas exibida  

### Fluxo Principal
1. Usuário acessa o portal e visualiza a tela de login.
2. Usuário insere e-mail e senha.
3. Sistema valida as credenciais via bcrypt.
4. Sistema verifica se o usuário está ativo e não bloqueado.
5. Sistema verifica se o acesso está dentro do horário de expediente.
6. Sistema emite access token (JWT) e refresh token (`httpOnly cookie`).
7. Sistema registra evento de login bem-sucedido no log de auditoria.
8. Sistema exibe tela de boas-vindas personalizada com chips de contexto.

### Fluxos Alternativos
- **A1 — Credenciais inválidas:** Sistema exibe mensagem de erro com contagem de tentativas. Contador incrementado.
- **A2 — Quinta tentativa inválida:** Sistema bloqueia a conta, exibe mensagem específica de bloqueio, registra evento de segurança no log.
- **A3 — Conta inativa:** Sistema exibe mensagem genérica sem revelar motivo.
- **A4 — Conta bloqueada:** Sistema exibe mensagem de conta bloqueada, orienta contatar suporte.
- **A5 — Fora do horário de expediente:** Sistema exibe mensagem com horário permitido; não revela detalhes de segurança.
- **A6 — Usuário em grupo de exceção fora do horário:** Sistema valida a janela do grupo; se dentro da janela, prossegue; se fora, bloqueia.

---

## UC-02 — Visualizar Relatório Power BI

**Ator principal:** Operador, Gerente  
**Pré-condição:** Usuário autenticado; relatório com status `published`; usuário com permissão no workspace/relatório  
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
- **A1 — Usuário sem permissão no relatório:** Backend retorna 403; frontend exibe mensagem de acesso negado; evento registrado no log.
- **A2 — Token de embed expirado durante visualização:** Sistema renova o token em background; usuário não percebe interrupção.
- **A3 — PBI Service indisponível:** Sistema exibe mensagem amigável de indisponibilidade; portal continua funcionando para outros módulos.
- **A4 — Relatório não encontrado no PBI Service:** Sistema exibe mensagem de relatório indisponível; sugere contatar administrador.

---

## UC-03 — Gerenciar Permissões de Usuário

**Ator principal:** Admin, Super Admin  
**Pré-condição:** Ator autenticado com perfil adequado  
**Pós-condição:** Permissões salvas; log de auditoria registrado  

### Fluxo Principal
1. Admin acessa o módulo de Permissões.
2. Sistema exibe as tabs: Por Perfil, Por Usuário, Por Workspace, Por Relatório.
3. Admin seleciona a dimensão de permissão e o alvo (perfil, usuário ou workspace).
4. Sistema carrega as permissões atuais do alvo selecionado.
5. Admin altera os checkboxes de permissão (Visualizar, Criar, Editar, Excluir, Exportar, Gerenciar).
6. Para permissões PBI: Admin define nível de acesso ao workspace (total ou relatórios específicos).
7. Admin clica em "Salvar".
8. Backend valida que o Admin tem autoridade para alterar as permissões do alvo.
9. Sistema persiste as alterações no banco de dados.
10. Sistema registra no log: quem alterou, o quê, de qual estado para qual (de → para).
11. Sistema invalida cache de permissões do usuário afetado.
12. Frontend exibe toast de confirmação.

### Fluxos Alternativos
- **A1 — Admin tenta alterar permissão de Super Admin:** Sistema retorna 403; Super Admin não pode ter permissões reduzidas por Admin.
- **A2 — Erro de validação:** Sistema retorna mensagem de erro específica; alterações não são salvas.
- **A3 — Admin cancela:** Alterações são descartadas; log não é gerado.

---

## UC-04 — Configurar Regras de Expediente

**Ator principal:** Admin, Super Admin  
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
- **A1 — Horário de início maior que horário de fim:** Sistema valida e exibe mensagem de erro; não salva.
- **A2 — Grupo sem membros:** Sistema permite salvar (grupo pode ser populado depois).

---

## UC-05 — Criar Novo Usuário

**Ator principal:** Admin, Super Admin  
**Pré-condição:** Ator autenticado  
**Pós-condição:** Usuário criado, e-mail de senha temporária enviado  

### Fluxo Principal
1. Admin acessa o módulo de Usuários e clica em "Novo Usuário".
2. Sistema exibe modal de criação.
3. Admin preenche: nome, e-mail, perfil, workspace(s) e relatório(s) de acesso.
4. Admin confirma criação.
5. Sistema valida dados: e-mail único, campos obrigatórios preenchidos.
6. Sistema gera senha temporária aleatória.
7. Sistema persiste o usuário com status `ativo` e senha com hash bcrypt.
8. Sistema envia e-mail com a senha temporária.
9. Sistema registra criação no log de auditoria.
10. Sistema exibe o novo usuário na listagem.

### Fluxos Alternativos
- **A1 — E-mail já cadastrado:** Sistema exibe mensagem "E-mail já utilizado por outro usuário".
- **A2 — Falha no envio de e-mail:** Usuário é criado; sistema exibe aviso sobre falha no envio; Admin pode reenviar.

---

## UC-06 — Consultar e Exportar Log de Auditoria

**Ator principal:** Admin, Super Admin  
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
- **A1 — Nenhum resultado para os filtros:** Sistema exibe estado vazio com sugestão de ampliar os filtros.
- **A2 — Volume muito grande (>50k registros):** Sistema processa exportação de forma assíncrona e notifica quando o arquivo está pronto.

---

## UC-07 — Bloquear / Desbloquear Usuário

**Ator principal:** Admin, Super Admin  
**Pré-condição:** Ator autenticado; usuário-alvo existe  
**Pós-condição:** Status do usuário atualizado; sessões ativas invalidadas  

### Fluxo Principal
1. Admin acessa a listagem de usuários.
2. Admin clica no botão de bloquear do usuário-alvo.
3. Sistema exibe modal de confirmação.
4. Admin confirma.
5. Sistema atualiza status para `blocked`.
6. Sistema invalida quaisquer sessões ativas do usuário bloqueado.
7. Sistema registra o bloqueio no log de auditoria (quem bloqueou, quando).
8. Usuário bloqueado recebe 403 em qualquer requisição subsequente.

### Fluxos Alternativos
- **A1 — Desbloquear:** Fluxo inverso; zera contador de tentativas; log registra desbloqueio.
- **A2 — Admin tenta bloquear Super Admin:** Sistema retorna 403; Super Admin não pode ser bloqueado por Admin.

---

## UC-08 — Configurar Integração Power BI

**Ator principal:** Super Admin  
**Pré-condição:** Super Admin autenticado; dados do Service Principal disponíveis  
**Pós-condição:** Integração PBI configurada e testada  

### Fluxo Principal
1. Super Admin acessa o módulo de Configurações.
2. Super Admin insere Client ID, Tenant ID e Client Secret do Service Principal.
3. Super Admin insere o Workspace ID padrão do Power BI.
4. Super Admin clica em "Testar Conexão".
5. Sistema tenta autenticar no Azure AD com as credenciais fornecidas.
6. Sistema tenta listar workspaces do PBI Service.
7. Sistema exibe resultado do teste (sucesso ou falha com detalhe do erro).
8. Super Admin clica em "Salvar".
9. Sistema armazena as credenciais de forma criptografada.
10. Sistema registra alteração nas configurações no log de auditoria.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | — | Criação inicial do documento |