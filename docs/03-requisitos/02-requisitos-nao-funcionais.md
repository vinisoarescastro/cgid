# Requisitos Não Funcionais

> **Documento:** 03-requisitos/02-requisitos-nao-funcionais.md  
> **Status:** Rascunho  
> **Criado em:** Maio/2026  
> **Atualizado em:** Maio/2026

---

## Convenções

| Sigla | Categoria |
|-------|-----------|
| RNF-PERF | Performance |
| RNF-SEG | Segurança |
| RNF-DISP | Disponibilidade e Confiabilidade |
| RNF-UX | Usabilidade |
| RNF-MAINT | Manutenibilidade |
| RNF-PORT | Portabilidade e Compatibilidade |
| RNF-CONF | Conformidade Legal |
| RNF-INT | Integridade de Dados |

---

## RNF-PERF — Performance

| ID | Requisito | Meta | Como medir |
|----|-----------|------|-----------|
| RNF-PERF-01 | Tempo de resposta para navegação entre páginas (exceto embed PBI) | < 1,5 segundos (p95) | Lighthouse / k6 load test |
| RNF-PERF-02 | Tempo de geração de token de embed Power BI | < 3 segundos (p95) | Tracing com OpenTelemetry |
| RNF-PERF-03 | Tempo de carregamento inicial da SPA (First Contentful Paint) | < 2 segundos em conexão 4G | Lighthouse CI |
| RNF-PERF-04 | Consulta a logs de auditoria com filtros aplicados | < 2 segundos para até 100.000 registros | Teste de carga |
| RNF-PERF-05 | Suporte a usuários simultâneos sem degradação perceptível | ≥ 200 usuários simultâneos | Teste de carga com k6 |
| RNF-PERF-06 | Tamanho máximo do bundle JavaScript da SPA | < 500KB (gzipped) | Webpack Bundle Analyzer / Vite build stats |
| RNF-PERF-07 | Throughput da API REST em operações de leitura (GET) | ≥ 500 req/s | Teste de carga |

---

## RNF-SEG — Segurança

| ID | Requisito | Critério | Obrigatoriedade |
|----|-----------|----------|:--------------:|
| RNF-SEG-01 | Senhas armazenadas com hash bcrypt com salt rounds ≥ 12 | Nenhuma senha em texto puro no banco | Obrigatório |
| RNF-SEG-02 | Toda comunicação exclusivamente via HTTPS com TLS 1.3 | Redirecionamento automático de HTTP para HTTPS; TLS < 1.2 rejeitado | Obrigatório |
| RNF-SEG-03 | Access token com TTL máximo de 1 hora; refresh token com TTL de 24 horas | Tokens expirados rejeitados; renovação automática funciona | Obrigatório |
| RNF-SEG-04 | Tokens de refresh armazenados em `httpOnly; Secure; SameSite=Strict` cookies | Não acessível via JavaScript (`document.cookie`) | Obrigatório |
| RNF-SEG-05 | Rate limiting por IP: máximo 100 requisições por minuto | Após exceder, HTTP 429 com header `Retry-After` | Obrigatório |
| RNF-SEG-06 | Headers de segurança HTTP: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Scanner de segurança (SecurityHeaders.com) retorna nota A+ | Obrigatório |
| RNF-SEG-07 | Credenciais Azure/PBI armazenadas criptografadas em cofre de segredos | Client Secret nunca em variável de ambiente não criptografada em produção | Obrigatório |
| RNF-SEG-08 | Tokens de embed PBI gerados exclusivamente no backend | Nenhuma rota do frontend gera ou expõe tokens PBI diretamente | Obrigatório |
| RNF-SEG-09 | Scan de vulnerabilidades automatizado no pipeline CI/CD (SAST) | Pipeline falha se vulnerabilidade crítica ou alta for detectada | Recomendado |

---

## RNF-DISP — Disponibilidade e Confiabilidade

| ID          | Requisito | Meta |
|-------------|-----------|------|
| RNF-DISP-01 | Disponibilidade mínima do portal em horário de expediente | 99,5% ao mês (≤ 3,6h de downtime/mês) |
| RNF-DISP-02 | Recovery Time Objective (RTO) - tempo para restaurar o serviço após falha | < 1 hora |
| RNF-DISP-03 | Recovery Point Objective (RPO) - perda máxima aceitável de dados | < 10 minutos |
| RNF-DISP-04 | Janela de manutenção programada | Fora do horário de expediente (ex: sábados, 2h–4h) |
| RNF-DISP-05 | Backup automático do banco de dados | Diário + PITR (Point-in-Time Recovery) para últimas 7 dias |
| RNF-DISP-06 | Graceful degradation: falha na integração PBI não deve derrubar o portal | Se PBI indisponível, portal exibe mensagem amigável; módulos não-PBI continuam funcionando |

---

## RNF-UX — Usabilidade

| ID | Requisito | Critério |
|----|-----------|----------|
| RNF-UX-01 | Interface responsiva: funcional em desktop (≥1280px), tablet (≥768px) e mobile (≥375px) | Nenhum elemento sobreposto ou inacessível nas 3 resoluções |
| RNF-UX-02 | Compatibilidade com navegadores modernos | Chrome ≥ 120, Edge ≥ 120, Firefox ≥ 120, Safari ≥ 17 (últimas 2 versões major) |
| RNF-UX-03 | Mensagens de erro claras e orientadas à ação | Toda mensagem de erro indica o problema e o que o usuário pode fazer |
| RNF-UX-04 | Tempo máximo de treinamento para perfil Colaborador | ≤ 30 minutos |
| RNF-UX-05 | Feedback visual imediato para ações do usuário | Loading states, toasts de confirmação e indicadores de progresso presentes |
| RNF-UX-06 | Confirmação antes de ações destrutivas | Modal de confirmação obrigatório antes de excluir usuário, revogar acesso ou alterar permissão |
| RNF-UX-07 | Acessibilidade mínima | WCAG 2.1 nível AA para elementos interativos principais |

---

## RNF-MAINT — Manutenibilidade

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-MAINT-01 | Cobertura de testes automatizados (unitários + integração) | ≥ 70% das linhas de código |
| RNF-MAINT-02 | Documentação da API REST (OpenAPI/Swagger) | 100% dos endpoints documentados com exemplos |
| RNF-MAINT-03 | Separação de responsabilidades entre camadas (frontend, backend, banco) | Frontend não contém lógica de negócio crítica; backend não contém lógica de UI |
| RNF-MAINT-04 | Código revisado por pares antes de merge na branch principal | 100% dos PRs com no mínimo 1 aprovação |
| RNF-MAINT-05 | Variáveis de configuração externalizadas via variáveis de ambiente | Nenhum valor de configuração hardcoded no código |
| RNF-MAINT-06 | Versionamento de schema do banco de dados com migrations | Toda mudança de schema rastreada; reversível via migration down |
| RNF-MAINT-07 | Versionamento da API com prefixo `/v1/` | Mudanças breaking não afetam versões anteriores da API |
| RNF-MAINT-08 | Linting e formatação automáticos no pipeline | ESLint + Prettier executados em todo PR; falha bloqueia merge |

---

## RNF-PORT — Portabilidade e Compatibilidade

| ID | Requisito | Critério |
|----|-----------|---------|
| RNF-PORT-01 | Ambiente de desenvolvimento padronizado | Backend e frontend sobem com `uvicorn` e `npm run dev` seguindo apenas o README, em < 5 minutos |
| RNF-PORT-02 | Ambiente de desenvolvimento reproduzível | Qualquer desenvolvedor sobe o ambiente local seguindo apenas o README |
| RNF-PORT-03 | Independência de vendor em infraestrutura (exceto Power BI) | Banco, cache e app podem ser executados em qualquer cloud provider |

---

## RNF-INT — Integridade de Dados

| ID | Requisito | Critério |
|----|-----------|---------|
| RNF-INT-01 | Logs de auditoria são imutáveis (append-only) | Nenhum endpoint de DELETE ou UPDATE para logs; constraint no banco |
| RNF-INT-02 | Transações bancadas por ACID | Operações que afetam múltiplas tabelas (ex: criar usuário + associar workspace) são transacionais |
| RNF-INT-03 | Validação de dados de entrada tanto no frontend quanto no backend | Input inválido é rejeitado no backend independentemente do frontend |

---

## Histórico de Alterações

| Versão | Data      | Autor                  | Descrição                    |
|--------|-----------|------------------------|------------------------------|
| 1.0    | Maio/2026 | Vinicius Soares | Criação inicial do documento |