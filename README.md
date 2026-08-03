# My Financial Spaces

Espaço financeiro.

Estrutura da plataforma

Plataforma SaaS
 └── Espaço financeiro
      ├── Usuários e permissões
      ├── Contas bancárias e carteiras
      ├── Cartões de crédito
      ├── Receitas e despesas
      ├── Dívidas e financiamentos
      ├── Metas
      └── Relatórios

Uma pessoa poderia ter acesso a vários espaços usando o mesmo login:

 Minha Vida Financeira

 Casa e Família

 Finanças dos Pais

 Viagem em Família

 Pequeno Negócio

Cada espaço teria dados completamente separados.

Usuários e permissões

O proprietário poderá convidar pessoas por e-mail e definir o que cada uma pode fazer.

Proprietário

 Controle completo do espaço

 Gerencia assinatura

 Convida e remove usuários

 Define permissões

 Visualiza e altera todos os dados

 Pode excluir ou transferir a propriedade

Administrador

 Cadastra contas, cartões e categorias

 Lança receitas e despesas

 Gerencia dívidas, metas e relatórios

 Convida usuários, caso autorizado

 Não altera a assinatura nem exclui o espaço

Editor

 Lança e edita movimentações

 Anexa comprovantes

 Marca contas como pagas

 Consulta cartões e calendário

 Não gerencia usuários

Visualizador

 Apenas consulta dashboards e relatórios

 Não altera informações

Consultor ou contador

 Consulta relatórios

 Exporta dados

 Pode acompanhar dívidas e planejamento

 Não visualiza informações ocultadas pelo proprietário

Também será possível criar permissões específicas, por exemplo:

O usuário pode lançar despesas, mas não pode visualizar o saldo bancário.

Cadastro inicial

Ao criar uma conta, o cliente passaria por um pequeno assistente:

 Criar o espaço financeiro

 Informar renda média mensal

 Cadastrar contas e carteiras

 Cadastrar cartões

 Cadastrar despesas fixas

 Cadastrar dívidas

 Convidar outras pessoas

 Definir uma primeira meta

Depois disso, o dashboard já começaria preenchido.

Módulos do sistema

Dashboard

 Saldo atual

 Saldo previsto no fim do mês

 Receitas e despesas

 Contas a vencer

 Contas atrasadas

 Faturas abertas

 Dívidas pendentes

 Metas financeiras

 Comparativo com meses anteriores

Movimentações

Cadastro de:

 Receita

 Despesa

 Transferência

 Reembolso

 Pagamento de dívida

 Pagamento de cartão

 Ajuste de saldo

Cada movimentação poderá ter:

 Categoria

 Subcategoria

 Conta ou cartão

 Pessoa responsável

 Data de competência

 Data de pagamento

 Recorrência

 Parcelamento

 Observação

 Comprovante

 Tags

Casa e família

Uma área para visualizar o custo da casa:

 Moradia

 Água

 Energia

 Internet

 Mercado

 Educação

 Saúde

 Veículos

 Funcionários

 Manutenção

 Lazer

 Assinaturas

O sistema mostrará, por exemplo:

O custo médio da casa nos últimos 3 meses foi de R$ 8.420.

Cartões de crédito

 Limite total e disponível

 Fechamento e vencimento

 Fatura atual

 Próximas faturas

 Compras parceladas

 Cartões adicionais

 Responsável por cada compra

 Alertas de limite

Uma compra parcelada será distribuída automaticamente nas próximas faturas.

Dívidas e financiamentos

 Valor inicial

 Saldo devedor

 Juros

 Número de parcelas

 Parcelas pagas e pendentes

 Prioridade

 Credor

 Vencimento

 Previsão de quitação

Também haverá simulações:

Pagando R$ 300 extras por mês, essa dívida termina 7 meses antes.

Planejamento mensal

Antes de começar o mês, o usuário poderá definir:

 Receita esperada

 Limite por categoria

 Valor para dívidas

 Valor para reserva

 Gastos eventuais

 Metas do período

Durante o mês, o sistema mostrará o realizado versus o planejado.

Calendário financeiro

Um calendário com:

 Receitas previstas

 Vencimentos

 Faturas

 Parcelas

 Contas recorrentes

 Metas

 Compromissos financeiros

Relatórios

 Fluxo de caixa

 Receitas versus despesas

 Gastos por categoria

 Gastos por usuário

 Custo da casa

 Evolução das dívidas

 Evolução do patrimônio

 Próximas parcelas

 Despesas recorrentes

 Comparativo mensal e anual

Administração do SaaS

Além do sistema usado pelos clientes, haverá um painel geral da plataforma.

O administrador do SaaS poderá:

 Consultar clientes cadastrados

 Gerenciar planos

 Controlar assinaturas

 Visualizar usuários ativos

 Acompanhar limites de uso

 Suspender ou reativar contas

 Gerenciar cupons

 Consultar pagamentos

 Enviar comunicados

 Acompanhar erros e atividades

 Controlar suporte

O administrador não deverá visualizar os dados financeiros dos clientes livremente. Um acesso de suporte deve exigir autorização e ficar registrado em auditoria.

Planos sugeridos

Individual

 1 espaço financeiro

 1 usuário

 Contas e cartões limitados

 Relatórios básicos

Família

 1 espaço financeiro

 Até 5 usuários

 Permissões

 Dívidas, metas e planejamento

 Relatórios completos

Premium

 Vários espaços financeiros

 Mais usuários

 Inteligência artificial

 Importação de extratos

 Exportação avançada

 Relatórios personalizados

Profissional

 Vários clientes ou espaços

 Acesso para consultores e contadores

 Gestão centralizada

 Painel de acompanhamento

 Marca personalizada futuramente

Estrutura técnica recomendada

Frontend: aplicação web responsiva, preparada para virar aplicativo

Backend: API em TypeScript

Banco de dados: PostgreSQL

Arquivos: armazenamento externo para comprovantes e documentos

Notificações: e-mail, push e futuramente WhatsApp

Cobrança: integração com gateway para Pix e cartão recorrente

Relatórios: geração de PDF e planilhas

Autenticação: login, recuperação de senha e autenticação em duas etapas

Todas as tabelas financeiras deverão estar vinculadas a um workspace_id, garantindo que um cliente nunca consiga acessar dados de outro.

Principais tabelas

users
workspaces
workspace_members
roles
permissions
plans
subscriptions

financial_accounts
credit_cards
categories
transactions
recurring_transactions
invoices
installments

debts
debt_payments
budgets
financial_goals
notifications
attachments
audit_logs

Segurança indispensável

 Separação de dados por espaço financeiro

 Criptografia de informações sensíveis

 Registro de acessos e alterações

 Backup automático

 Autenticação em duas etapas

 Controle de sessões e dispositivos

 Consentimento para acesso do suporte

 Exportação e exclusão de dados

 Adequação à LGPD

MVP recomendado

A primeira versão deve conter:

 Cadastro e login

 Criação do espaço financeiro

 Convite de usuários

 Perfis e permissões

 Contas e carteiras

 Receitas, despesas e transferências

 Categorias

 Contas recorrentes

 Cartões e compras parceladas

 Dívidas e parcelas

 Dashboard mensal

 Calendário financeiro

 Relatórios básicos

 Painel administrativo do SaaS

 Planos e assinaturas

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2641ce0e-7556-449f-8c9c-afba9c32dd31).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
