# Contexto e Estado Atual do Protótipo

> **Documento:** 01-visao-geral/01-contexto-e-prototipo.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## 1. Sobre o Protótipo Atual

O repositório do projeto contém um único arquivo HTML (`portal_v4_8.html`) que representa o protótipo conceitual e visual do **BrasilTerrenos Portal Corporativo**. Trata-se de uma SPA (Single Page Application) construída inteiramente em HTML, CSS e JavaScript Vanilla, sem qualquer dependência de framework ou backend real.

O arquivo reúne em um único lugar:

- Todo o design system (variáveis CSS, tipografia, paleta de cores, espaçamentos, sombras)
- Toda a estrutura de navegação e layout (sidebar, topbar, páginas)
- Toda a lógica de controle de acesso simulada (RBAC front-end)
- Todos os dados mockados (usuários, relatórios, workspaces, logs, permissões)
- Toda a lógica de interação e renderização dinâmica do DOM

---

## 2. O que o Protótipo Demonstra com Qualidade

### 2.1 Design System Sólido

O protótipo possui um sistema de design bem estruturado, definido inteiramente via variáveis CSS (`--brand-*`, `--gray-*`, `--shadow-*`, `--r-*`). Isso evidencia maturidade na concepção visual e facilita a migração para uma arquitetura componentizada no futuro.

**Tokens definidos:**
- Paleta de cores da marca (verde BrasilTerrenos em 10 tons: `--brand-50` a `--brand-950`)
- Paleta neutra (cool gray em 11 tons)
- Cores semânticas: success, warning, danger, info
- Escala de sombras: xs, sm, md, lg, xl
- Escala de border-radius: sm, md, lg, xl
- Transições padronizadas: fast, base, slow
- Dimensões fixas: sidebar width, topbar height, content padding

**Tipografia:** Plus Jakarta Sans com pesos 300–800, com fallback para system-ui.

### 2.2 Navegação SPA Funcional

O protótipo implementa navegação entre "páginas" via manipulação de DOM (`display: none/block`) com função `navigateTo()`. A sidebar possui:
- Itens de navegação para todos os módulos
- Submenu de administrador com grupos organizados por categoria
- Comportamento responsivo (colapsa em mobile, abre via overlay)
- Estado ativo de item/subitem sincronizado com breadcrumb

### 2.3 Fluxo de Autenticação Simulado

Implementa um fluxo de três telas:
1. **Tela de Login** - formulário com e-mail/senha, toggle de visibilidade, feedback de erro
2. **Tela de Boas-Vindas** - saudação personalizada com chips de contexto (workspaces, relatórios, perfil)
3. **App** - área principal com acesso condicionado ao perfil

Usuários disponíveis no mock:
| E-mail | Perfil | Acesso |
|--------|--------|--------|
| admin@bt.com | Super Admin | Total |
| ana@bt.com | Admin | Total |
| carlos@bt.com | Gerente | Workspace Controladoria |
| mariana@bt.com | Operador | Workspace Marketing |
| pedro@bt.com | Operador | Workspace SAC |

### 2.4 RBAC Implementado no Frontend

A função `applyRBAC()` aplica controle de acesso visual com base no perfil do usuário logado:
- Oculta/exibe menus de administrador
- Adapta o dashboard (visão admin vs. operador)
- Filtra relatórios e workspaces visíveis
- Controla quais botões de ação aparecem

As funções `canAccessWs()` e `canAccessReport()` verificam permissões antes de renderizar conteúdo.

### 2.5 Módulos Completamente Prototipados (UI)

| Módulo | Status |
|--------|--------|
| Login / Boas-vindas | ✅ Completo |
| Home / Dashboard | ✅ Completo (admin + operador) |
| Workspaces (visão usuário) | ✅ Completo |
| Relatórios PBI (listagem) | ✅ Completo |
| Favoritos | ✅ Completo |
| Painel Gerencial (admin) | ✅ Completo |
| Gestão de Usuários | ✅ Completo |
| Permissões (por perfil, usuário, workspace, relatório) | ✅ Completo |
| Controle de Acessos (bloqueados + exceções) | ✅ Completo |
| Grupos de Exceção | ✅ Completo |
| Workspaces (admin) | ✅ Completo |
| Regras de Expediente | ✅ Completo |
| Logs e Auditoria | ✅ Completo |
| Segurança (checklist) | ✅ Completo |
| Configurações | ✅ Completo |

### 2.6 Dados Mockados Coerentes

Os dados de mock são detalhados e representativos do domínio real:
- 6 usuários com perfis distintos
- 4 workspaces (Administrativo, Controladoria, Marketing, SAC)
- 5 relatórios com categorias (Financeiro, Operacional, Estratégico) e status (`publicado`/`rascunho`)
- 4 grupos de exceção
- 4 exceções de acesso ativas
- Histórico de logs de auditoria com IPs, timestamps e detalhes
- Checklist de segurança com 10 itens (8 OK, 2 pendentes)

---

## 3. Lacunas Críticas Identificadas

### 3.1 Ausência de Backend Real

Todo o processamento ocorre no cliente. Não há:
- Servidor de aplicação
- Endpoints de API REST
- Camada de autenticação real
- Geração de tokens JWT
- Integração real com Power BI Embedded

### 3.2 Vulnerabilidades de Segurança Graves

| Vulnerabilidade | Localização | Impacto |
|----------------|-------------|---------|
| Credenciais em texto puro no JavaScript | Array `CREDS` | Crítico — qualquer pessoa que acesse o HTML vê todas as senhas |
| Autenticação client-side | Função `doLogin()` | Crítico — bypassável trivialmente |
| Sem hash de senha | Comparação `c.pass === pass` | Crítico |
| Lógica de RBAC no front-end | Funções `canAccessWs()`, `applyRBAC()` | Alto — facilmente contornável por inspeção de código |
| Sem proteção CSRF | N/A (sem formulários reais) | Médio — relevante na versão com backend |

### 3.3 Sem Persistência de Dados

Qualquer alteração feita na interface (criar usuário, alterar permissão, salvar expediente) é perdida ao recarregar a página, pois tudo está em arrays JavaScript em memória.

### 3.4 Arquitetura Monolítica de Arquivo Único

O arquivo possui mais de 5.000 linhas combinando CSS, HTML e JavaScript. Isso torna:
- Difícil manutenção por múltiplos desenvolvedores
- Impossível testar automaticamente
- Impossível reutilizar componentes
- Difícil rastrear mudanças via controle de versão (um `diff` envolve o arquivo inteiro)

### 3.5 Sem Integração Real com Power BI

A renderização de relatórios PBI é apenas visual (modais de placeholder). Não há:
- Chamada à API do Power BI REST
- Geração de tokens de embed (que deve ser server-side)
- Iframe com relatório real embedded

### 3.6 Ausência de Testes

Não há nenhum mecanismo de teste: unitário, de integração, end-to-end ou visual.

### 3.7 Sem CI/CD

Não há pipeline de integração contínua, entrega contínua, linting automatizado ou verificação de qualidade de código.

---

## 4. Pontos de Atenção para a Evolução

| Ponto | Recomendação |
|-------|-------------|
| O design system CSS é um ativo valioso | Migrar as variáveis CSS para tokens de design (ex: Tailwind config ou CSS-in-JS) mantendo a identidade visual |
| A estrutura de navegação SPA está bem definida | Usar como base para o roteamento React Router v6 |
| Os dados mockados são coerentes com o domínio | Usar como referência para seed do banco de dados de desenvolvimento |
| A lógica de RBAC front-end pode servir de guia | Reimplementar como dependências/guards server-side no FastAPI |
| O checklist de segurança é bem pensado | Transformar em testes automatizados de segurança (SAST/DAST) |

---

## 5. Avaliação Geral do Protótipo

| Dimensão | Nota | Observação |
|----------|:----:|------------|
| Qualidade visual e UX | ⭐⭐⭐⭐⭐ | Design system profissional, layout sofisticado |
| Cobertura funcional | ⭐⭐⭐⭐⭐ | Todos os módulos estão prototipados |
| Segurança | ⭐☆☆☆☆ | Credenciais expostas, RBAC apenas visual |
| Arquitetura | ⭐☆☆☆☆ | Arquivo único sem separação de responsabilidades |
| Manutenibilidade | ⭐⭐☆☆☆ | Difícil de manter em equipe por ser monolítico |
| Testabilidade | ☆☆☆☆☆ | Sem qualquer estrutura para testes |
| Valor como prova de conceito | ⭐⭐⭐⭐⭐ | Excelente para validação visual e funcional |

> **Conclusão:** O protótipo cumpre perfeitamente seu papel de **validação de conceito e visão de produto**. Serve como referência definitiva de UI/UX e como especificação visual das funcionalidades. Para evolução para produção, requer reescrita arquitetural completa com separação frontend/backend.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | Maio/2026 | Vinicius Soares | Criação inicial do documento |
