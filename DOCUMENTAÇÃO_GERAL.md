# DOCUMENTAÇÃO FUNCIONAL E TÉCNICA

# ESPAÇO FINANCEIRO

## 1. Visão Geral

O **Espaço Financeiro** é uma plataforma SaaS de gestão financeira pessoal e familiar, permitindo que usuários organizem suas próprias finanças e compartilhem a gestão de receitas, despesas, contas, dívidas, metas e patrimônio.

### Status Atual (MVP):
- **Infraestrutura**: PostgreSQL Local no EasyPanel, Docker/Nitro.
- **Autenticação**: Sistema local de sessões e usuários (`auth.users`, `user_sessions`).
- **Multiusuário**: Workspaces isolados com membros e permissões.
- **Lançamentos**: Receitas, despesas, transferências, parcelamentos e nomes de clientes/fornecedores.
- **Recorrência**: Suporte a gastos fixos e variáveis (estimativas).
- **IA**: Captura de fotos e processamento via OpenAI (gpt-4o-mini).
- **Relatórios**: Histórico e Projeção para 6 meses.
- **Admin**: Gestão de clientes, planos e auditoria da plataforma.

---

# 2. Objetivos e Módulos Implementados

## 2.1 Dashboard Central
Visão consolidada de saldo, receitas, despesas e status de metas/dívidas. Gráficos diários de fluxo de caixa.

## 2.2 Movimentações (Lançamentos Rápidos)
Interface otimizada para lançamentos, incluindo botões de "+" para criar Categorias e Contas instantaneamente.
Suporte a:
- **Lançamento Fixo**: Valor constante (Ex: Aluguel).
- **Lançamento Variável**: Valor estimado que se confirma depois (Ex: Energia).
- **Parcelamento**: Identificação de compras parceladas.
- **Vínculo**: Nome do cliente ou fornecedor.

## 2.3 Relatórios e Projeções
Tela unificada com:
- Histórico de 6 meses.
- Projeção de fluxo de caixa para os próximos 6 meses.
- Distribuição por categoria.

## 2.4 Administração (SaaS Admin)
Painel exclusivo para gerir a plataforma:
- Visão geral de novos clientes.
- Gestão de planos e limites.
- Auditoria de segurança.
- Configurações da API OpenAI.

---

# 3. Estrutura de Banco de Dados (PostgreSQL)

### Principais Tabelas:
- `auth.users`: Credenciais e metadados.
- `public.profiles`: Informações públicas dos usuários.
- `public.workspaces`: Unidade de isolamento de dados.
- `public.workspace_members`: Vínculos e papéis (owner, admin, etc).
- `public.transactions`: Lançamentos financeiros.
- `public.recurring_transactions`: Configuração de recorrências.
- `public.debts`: Controle de dívidas e financiamentos.
- `public.financial_accounts`: Contas bancárias e carteiras.
- `public.categories`: Classificação de gastos e receitas.
- `public.platform_configs`: Configurações globais (API Keys).

---

# 4. Roadmap de Desenvolvimento (Próximos Passos)

### Sprint Atual: Refinamento de UX e Metas
1. **Módulo de Metas**: Implementar tela detalhada de acompanhamento de objetivos financeiros.
2. **Cartões de Crédito**: Gestão de faturas e fechamento automático.
3. **PWA**: Configuração para instalação como "App" no celular.
4. **Notificações**: Alertas de vencimento via sistema.

---

# 5. Guia de Deploy (EasyPanel)

O sistema está configurado para ser auto-hospedado utilizando Docker.
- **Dockerfile**: Baseado no preset Nitro node-server.
- **docker-compose.yml**: Orquestração da App + Banco PostgreSQL.
- **Variaveis de Ambiente**: DATABASE_URL, OPENAI_API_KEY, VITE_BASE_URL.

---

Documentação atualizada em 05/08/2026.
Para novos módulos, consulte o Roadmap.
