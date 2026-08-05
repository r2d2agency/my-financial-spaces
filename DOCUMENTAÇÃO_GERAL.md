# DOCUMENTAÇÃO FUNCIONAL E TÉCNICA

# ESPAÇO FINANCEIRO

## VISÃO GERAL
Plataforma SaaS de gestão financeira multiusuário focada em controle de despesas, planejamento e organização familiar/empresarial.

## ARQUITETURA TÉCNICA
- **Frontend**: TanStack Start v1 (React 19 + Vite 7).
- **Backend**: Server Functions (TanStack Start) rodando em Node.js.
- **Banco de Dados**: PostgreSQL (Puro) gerenciado via `pg.Pool`.
- **Hospedagem**: EasyPanel (Docker/Self-host).
- **Autenticação**: Sistema Local com sessões em banco de dados (`user_sessions`).
- **IA**: OpenAI API (GPT-4o-mini) para processamento de comprovantes via foto.

## ESTRUTURA DE DADOS
- **auth.users**: Credenciais e metadados.
- **workspaces**: Isolamento de dados por espaço.
- **transactions**: Lançamentos financeiros (Receitas/Despesas).
- **recurring_transactions**: Gestão de aluguel, luz, assinaturas (Fixo vs Variável).
- **debts**: Controle de dívidas e parcelamentos.
- **categories/accounts**: Organização e saldos.

## SPRINT ATUAL: MVP & ESTABILIZAÇÃO
1. **Puro PostgreSQL**: Remoção completa de Supabase.
2. **Deploy Automático**: Script de inicialização de tabelas no boot.
3. **Gestão de Workspaces**: Criação simplificada e isolamento.
4. **Relatórios**: Visão consolidada de 3 e 6 meses.
5. **Recorrência**: Suporte a gastos fixos e variáveis com estimativas.

## ROADMAP SPRINT 2
- **Cartões de Crédito**: Gestão de faturas e limites.
- **Metas Financeiras**: Planejamento de sonhos com barra de progresso.
- **Notificações**: Alertas de contas a vencer.
- **PWA**: Instalação como "App" no celular.

---
*Este documento é a base para o desenvolvimento do projeto. ja podemos criar? lembra qu e nao temos supabase hein*
