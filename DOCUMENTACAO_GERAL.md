# Documentação Geral - Espaço Financeiro

Este documento detalha a estrutura, processos, funções e tecnologias implementadas na plataforma **Espaço Financeiro**.

## 1. Visão Geral da Plataforma
O **Espaço Financeiro** é uma solução SaaS de gestão financeira multiusuário (B2B/B2C) focada em simplicidade, modernidade e eficiência. A interface é inspirada em padrões de *OpenFinance* e plataformas como *Conta Azul* e *My Finance*, utilizando uma paleta de cores azul vívida (Azure/Sky) com tipografia moderna (Sora/Manrope).

---

## 2. Estrutura Técnica (Stack)
- **Frontend:** React 19 + TanStack Start (SSR/SSG).
- **Roteamento:** TanStack Router v1.
- **Estilização:** Tailwind CSS v4 + Shadcn UI.
- **Banco de Dados:** PostgreSQL (Self-hosted via EasyPanel).
- **Infraestrutura:** Docker (Nitro preset node-server).
- **IA/OCR:** OpenAI API (`gpt-4o-mini`) para leitura de comprovantes.
- **Segurança:** Isolamento de dados por `workspace_id` e autenticação local.

---

## 3. Módulos e Funcionalidades

### 🏠 Dashboard
- Visão consolidada de saldos, receitas e despesas.
- Gráficos de fluxo de caixa (Recharts).
- Atalhos rápidos para lançamentos.

### 💸 Movimentações (Receitas & Despesas)
- **Lançamento Rápido (FAB):** Botão flutuante acessível em dispositivos móveis.
- **Captura de Comprovantes (IA):** Função de tirar foto e processar via OpenAI para preenchimento automático.
- **Recorrência:** Suporte a lançamentos fixos (ex: aluguel) e variáveis/estimados (ex: luz/água).
- **Vínculos:** Possibilidade de vincular lançamentos a Clientes (Origem) ou Fornecedores (Destino).
- **Cadastro Rápido:** Botões de "+" para criar Categorias ou Contas diretamente no formulário de lançamento.

### 📉 Dívidas e Financiamentos
- Gestão de saldo devedor e parcelas.
- **Tipos de Lançamento:** Distinção entre Recorrente (Assinaturas) e Parcelado (Empréstimos).
- **Simulador de Antecipação:** Cálculo de economia de juros ao pagar parcelas extras mensalmente.

### 📊 Relatórios & Projeções
- Relatório mensal de entradas e saídas.
- **Projeção Financeira:** Visualização de projeções para 3 e 6 meses baseada em recorrências e históricos.

### 📅 Calendário
- Visualização mensal de vencimentos e recebimentos previstos.

### ⚙️ Configurações & Gestão
- Gestão de Workspaces (múltiplos espaços financeiros por usuário).
- Configuração de Chave de API da OpenAI (armazenada de forma segura no banco).

---

## 4. Estrutura do Banco de Dados (PostgreSQL)

### Schemas principais:
- `auth`: Gestão de usuários e sessões.
- `public`: Dados de negócio e plataforma.

### Tabelas Principais:
1.  **`workspaces`**: Espaços financeiros isolados.
2.  **`workspace_members`**: Controle de acesso e permissões (Owner, Admin, Editor, Viewer).
3.  **`transactions`**: Lançamentos financeiros (Receitas, Despesas, Transferências).
    - Colunas especiais: `recurring_id` (vínculo com recorrência), `is_estimated` (estimativas de gastos variáveis), `person_name` (cliente/fornecedor).
4.  **`recurring_transactions`**: Definição de padrões de recorrência (fixo vs variável).
5.  **`debts`**: Controle de dívidas e parcelamentos.
6.  **`financial_accounts`**: Contas bancárias e carteiras.
7.  **`categories`**: Categorização de gastos e receitas.
8.  **`platform_configs`**: Configurações globais (OpenAI Key, etc).

---

## 5. Processos Automatizados

### Inicialização do Banco (`init-db.server.ts`)
O sistema detecta automaticamente se as tabelas, enums e funções PL/pgSQL existem no PostgreSQL e as cria/atualiza no primeiro boot do app. Isso garante que o deploy no EasyPanel seja "plug-and-play".

### Autenticação Local (`auth.server.ts`)
Sistema de login que valida credenciais diretamente no banco local, sem dependência de serviços externos de Auth, garantindo total controle dos dados.

### Middleware de Segurança
Validação de sessões em todas as rotas autenticadas, garantindo que um usuário só acesse dados de Workspaces onde ele é membro.

---

## 6. Passos para Deploy (Resumo)
1.  Configurar PostgreSQL no EasyPanel.
2.  Definir variáveis de ambiente (`DATABASE_URL`, `OPENAI_API_KEY`, etc).
3.  Executar build via Dockerfile.
4.  O app inicializará o schema automaticamente na primeira requisição.

---
*Documento gerado em 05/08/2026 para análise de processos e funções.*
