# Guia de Uso — Painel de Acompanhamento (ClickUp)

Painel para apoiar decisões de **suporte e desenvolvimento de produto** a partir de dados
ao vivo do ClickUp: horas rastreadas, quem trabalhou em quê, quanto tempo cada produto ou
tipo de suporte consumiu, e como isso evolui período a período.

Este guia explica o fluxo de uso, do login à exportação de resultados.

---

## 1. Acesso

Abra o endereço do painel no navegador e entre com usuário e senha.

- **Admin**: acesso completo — gerencia usuários, edita/exclui qualquer visualização,
  gera o histórico semanal.
- **Leitor**: monta e salva suas próprias visualizações, vê as de todo mundo, mas só
  edita as que forem dela ou onde tiver sido adicionada como editora.

A sessão dura 12h. Passado esse tempo, é pedido login de novo.

---

## 2. Fluxo básico (do zero até o gráfico)

```
1. Escolher pastas/listas  →  2. Definir período  →  3. Carregar dados  →  4. Montar widgets
```

### 2.1 Escolher pastas e listas

Na barra lateral esquerda, a árvore mostra a hierarquia do ClickUp em 4 níveis:
**workspace → space → pasta → lista**. Marque o quanto quiser:

- **Selecionar todo o workspace**: um clique traz tudo.
- Marcar um **Space** seleciona todas as pastas e listas dele.
- Marcar uma **pasta** (▸ para expandir) seleciona todas as listas dela.
- Ou marque **listas individuais**, misturando à vontade.

O contador "N listas selecionadas" confirma o que está marcado.

### 2.2 Definir o período

Logo abaixo, escolha um período pré-definido (**Este mês**, Mês passado, Últimos 30/90
dias, Últimos 6 meses, Este ano) ou edite as datas manualmente — ao editar, o seletor
muda sozinho para "Personalizado".

Marque também **quais critérios de data valem para as tasks** (o time tracking sempre é
filtrado pela data em que a hora foi lançada, isso não muda):

- ☑ Criadas no período
- ☑ Fechadas no período
- ☑ Com horas registradas no período

Uma task entra se atender **pelo menos um** critério marcado (lógica "ou"). Desmarcar
todos remove o filtro de data.

> 📅 **Banner de período ativo**: logo acima dos widgets, um aviso mostra sempre as
> datas e critérios realmente em uso. Se você abrir uma visualização salva com período
> diferente do que estava na tela, o banner avisa com um ⚠.

### 2.3 Carregar dados

Clique em **Carregar dados**. Isso busca do ClickUp: as tasks das listas escolhidas, os
campos disponíveis (nativos e customizados) e as horas rastreadas de todo mundo no
período.

Os dados ficam em **cache por 10 minutos** — outros usuários carregando as mesmas listas
não geram nova busca no ClickUp. Se você sabe que algo mudou agora (uma hora acabou de
ser lançada, por exemplo) e não quer esperar o cache expirar, use **⟳ Atualizar**, que
força uma busca nova.

### 2.4 Montar widgets

Clique em **+ Novo widget** e configure:

| Campo | O que faz |
|---|---|
| **Tipo de gráfico** | Barras, Linha, Pizza, Tabela ou KPI (número único) |
| **Métrica** | O que medir: Horas rastreadas, Horas (histórico semanal), Nº de tasks, ou qualquer campo numérico |
| **Agregação** | Soma, Contagem ou Média |
| **Dimensão 1-5** | Por quais campos agrupar (Dimensões 3-5 só aparecem em Tabela) |

Todos os campos aparecem em **ordem alfabética** nos seletores.

---

## 3. Recursos por widget

Cada card tem seus próprios controles, independentes dos demais.

### 3.1 Filtros

Botão **🔎 Filtros** abre uma área para restringir os dados daquele widget específico
(sem afetar os outros). Clique em **+ Adicionar filtro**, escolha o campo e marque os
valores desejados. Pode adicionar quantos filtros quiser; eles se combinam (E lógico
entre filtros diferentes).

### 3.2 Comparação com período anterior

No seletor **Comparar**, escolha "Período anterior" para comparar automaticamente com a
janela imediatamente anterior, do mesmo tamanho do período selecionado (ex: se o período
é 01–15/07, compara com 16–30/06).

- **KPI**: mostra o valor anterior embaixo e um selo com a variação %.
- **Barras/linha**: desenha uma segunda série (cinza, tracejada em linhas) com o período
  anterior lado a lado.
- **Tabela**: adiciona as colunas **Anterior** e **Δ%**, linha a linha.

Cores do selo: 🟠 aumento, 🟢 redução — sem julgamento de "bom" ou "ruim" (uma queda em
horas de desenvolvimento pode ser tão preocupante quanto um aumento em suporte).

### 3.3 Metas e alertas

Em **Alerta se valor** escolha "Maior que" ou "Menor que" e informe o limite. Quando
algum grupo ultrapassa o limite:

- O card ganha uma **borda vermelha** e um selo "⚠ N grupo(s) fora do limite".
- Em **barras**, as colunas que violam o limite ficam vermelhas.
- Em **tabelas**, as linhas violadoras ficam destacadas em vermelho.
- Em **KPI**, o número fica vermelho se o total violar o limite.

Exemplo: alerta "Maior que 40" numa métrica de Horas por Produto identifica na hora
qual produto passou de 40h no período.

### 3.4 Redimensionar e reorganizar

- **Redimensionar**: arraste a alcinha **◢** no canto inferior direito do card.
- **Reordenar**: segure o ícone **⠿** no cabeçalho do card e arraste para a posição
  desejada.

Tamanho e ordem são salvos junto com a visualização.

### 3.5 Ordenar tabelas

Clique em qualquer cabeçalho de coluna para ordenar por ele; clique de novo para
inverter. Por padrão, tabelas vêm ordenadas pela métrica, do maior para o menor.

### 3.6 Exportar

- **Excel** (ícone ⬇ Excel, só em widgets de Tabela): baixa um `.xlsx` com os dados
  exatamente como estão ordenados na tela, incluindo colunas de comparação se ativas.
- **PDF do painel inteiro**: botão **Exportar PDF** no topo — gera um PDF limpo (sem
  menus) com todos os widgets, cabeçalho com nome do painel, período e data de geração.

---

## 4. Salvando e reutilizando visualizações

### 4.1 Salvar

Dê um nome no campo do topo e clique em **Salvar visualização**. Se você reabrir a
*mesma* visualização depois de editá-la, o botão atualiza; mudar o nome cria uma nova.

### 4.2 Abrir uma visualização salva

Escolha no menu **Visualizações salvas** e clique em **Abrir**. Um cadeado 🔒 ao lado do
nome indica que você não tem permissão de editar aquela visualização — ainda pode
abri-la e ver os dados normalmente.

> ⚠️ Trocar de visualização aplica o período **salvo nela**, e o banner avisa quando
> isso acontece. Reabrir a visualização que já está na tela preserva o período que
> você tiver ajustado manualmente.

### 4.3 Duplicar

Qualquer usuário pode clicar em **Duplicar** para criar uma cópia própria de qualquer
visualização — inclusive do painel padrão "Painel Executivo · Horas", que só admins
podem editar diretamente. Duplicar é o caminho para customizar a partir de um modelo
pronto.

### 4.4 Editores

Quem criou uma visualização (ou um admin) pode clicar em **Editores** e marcar quais
outros usuários também podem editá-la. Sem isso, só o criador e admins editam; os demais
veem em modo leitura.

### 4.5 Excluir

Só quem criou a visualização ou um admin pode excluí-la.

---

## 5. Histórico semanal (tendência ao longo do tempo)

Diferente do restante do painel (que sempre consulta o ClickUp ao vivo), o histórico é
uma **fotografia semanal** guardada no banco — permite ver tendência mesmo que tasks
antigas sejam depois alteradas ou excluídas no ClickUp.

- Gerado automaticamente toda semana fechada (segunda a domingo), com uma verificação a
  cada 6h.
- Para usar: escolha a métrica **"Horas (histórico semanal)"** num widget, e as
  dimensões que começam com "Histórico:" (Semana, Produto, Categoria, Tipo de suporte,
  Tipo de registro, Colaborador).
- Ideal para gráficos de **linha por semana**, mostrando se o suporte de um produto está
  crescendo ou caindo mês a mês — algo que o ClickUp não mostra nativamente.

### Para admins

No modal **Usuários** (veja seção 6):

- **Gerar snapshots agora**: preenche só as semanas que ainda faltam.
- **Regenerar todo o histórico**: recalcula tudo (últimos ~6 meses) com as regras de
  classificação atuais — use depois de mudar a lógica de Categoria, por exemplo.

---

## 6. Administração (só para Admins)

Botão **Usuários** no topo da tela:

- **Adicionar usuário**: nome, senha e papel (Admin ou Leitor).
- **Redefinir senha** de qualquer usuário.
- **Excluir usuário** (não é possível excluir a si mesma nem o último admin restante).
- **Gerar/Regenerar snapshots** (seção 5).

---

## 7. Glossário — campos "inteligentes"

Alguns campos no seletor de dimensões não vêm direto do ClickUp — são calculados pelo
painel para facilitar a análise:

| Campo | Como é calculado |
|---|---|
| **Produto (campo)** | Lê o campo customizado "Produto" da task, em qualquer lista |
| **Tipo de suporte (campo)** | Lê o campo customizado "Tipo de suporte" |
| **Categoria (por Departamento)** | Lê o campo "Departamento" e agrupa: Projetos/UX/IA → **Projetos**; Suporte → **Suporte**; Produto → **Produto**; Geral/Diretoria → **Geral** |
| **Colaborador (time tracking)** | Quem efetivamente registrou a hora (não é o responsável da task, é quem lançou o tempo) |

---

## 8. Dúvidas frequentes

**Os números parecem desatualizados.**
Veja o texto abaixo do botão Carregar dados — ele mostra "dados de HH:MM". Se antigo,
clique em **⟳ Atualizar**.

**Uma visualização abriu com o período errado.**
Veja o banner no topo: se aparecer o aviso ⚠, é porque essa visualização foi salva com
um período diferente do que estava na tela — normal ao trocar de visualização.

**Não consigo editar uma visualização.**
Provavelmente ela não é sua e você não foi adicionada como editora. Peça ao criador (ou
a um admin) para te adicionar em **Editores**, ou clique em **Duplicar** para ter sua
própria cópia editável.

**O histórico semanal está vazio ou incompleto.**
Ele é gerado aos poucos em segundo plano (a cada 6h) e pode levar um tempo na primeira
vez. Um admin pode forçar a geração em **Usuários → Gerar snapshots agora**.

---

*3wings — Painel de Acompanhamento de Suporte & Produto*
