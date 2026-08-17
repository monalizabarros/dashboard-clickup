# Painel de Acompanhamento — ClickUp

Dashboard configurável que lê dados diretamente da API do ClickUp (produto, cliente,
usuário, horas registradas, tipo de suporte e qualquer campo customizado) e permite
montar, combinar e salvar visualizações (gráficos e tabelas).

Roda 100% independente do Claude — é um servidor Python (FastAPI) + frontend
HTML/JS puro, sem build step.

## Como funciona

- **Backend** (`backend/`): FastAPI. Busca times/espaços/pastas/listas e tasks
  direto na API do ClickUp usando um token pessoal. Expõe campos (nativos +
  customizados) para o frontend montar os widgets.
- **Frontend** (`frontend/`): página única. Sidebar com seleção de lista e campos;
  área central com widgets (barra, linha, pizza, tabela, KPI) configuráveis por
  dimensão + métrica + agregação (contagem / soma / média).
- **Persistência**: SQLite local (`dashboard.db`) guarda as visualizações salvas
  (nome, lista de origem, configuração dos widgets). Não guarda os dados do
  ClickUp — eles são buscados ao vivo a cada carregamento.

## 1. Gerar o token do ClickUp

Perfil do ClickUp → **Configurações → Apps → API Token** (token pessoal, começa
com `pk_`). Ele dá acesso a tudo que o seu usuário enxerga no workspace.

O token já vem configurado em `backend/.env` neste projeto. Se precisar trocar,
edite esse arquivo (não precisa exportar variável no terminal toda vez).

## 2. Rodar localmente (dia a dia)

Depois da primeira instalação, é só:

```bash
./iniciar.sh
```

Esse script ativa o ambiente virtual (criando na primeira vez, se ainda não
existir) e sobe o servidor. Acesse `http://localhost:8000`. Para parar,
`Ctrl+C` no terminal.

Se preferir rodar manualmente:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```
(O token é lido automaticamente do `backend/.env` — não precisa mais de `export`.)

## 3. Subir no servidor (produção) com Docker

```bash
cp .env.example .env
# edite o .env e cole o token real

docker compose up -d --build
```

O painel fica disponível em `http://SEU_SERVIDOR:8000`. Os dados salvos
(visualizações) persistem no volume `dashboard_data` entre reinícios/updates.

Se preferir sem Docker, qualquer servidor com Python 3.11+ funciona:

```bash
pip install -r backend/requirements.txt
CLICKUP_API_TOKEN=pk_xxxx uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend
```
Recomendo colocar atrás de um Nginx/Caddy com HTTPS se for expor externamente.

## 4. Usando o painel

1. Na árvore lateral, expanda as pastas e marque as listas (marcar a pasta seleciona todas as listas dela). Multi-seleção livre entre pastas e listas.
2. Defina o período (padrão: últimos 30 dias) e clique em **Carregar dados** — busca tasks, campos
   disponíveis (nativos e customizados) daquela lista.
3. Clique em **+ Novo widget**, escolha o tipo de gráfico, a dimensão
   (ex: Cliente, Produto, Tipo de suporte) e a métrica (ex: Horas registradas,
   Nº de tasks) com a agregação desejada.
4. Adicione quantos widgets quiser, monte o layout.
5. Dê um nome no campo do topo e clique em **Salvar visualização** — ela fica
   disponível depois em "Visualizações salvas", já reabrindo com a lista e os
   widgets configurados.

## Campos suportados

- **Nativos**: status, responsável, criador, prioridade, datas, horas
  registradas/estimadas, tags.
- **Customizados**: qualquer campo customizado da lista (dropdown, labels,
  texto, número etc.) é detectado automaticamente — não precisa mexer em código
  para adicionar campos novos como "Cliente" ou "Tipo de suporte".

## Limitações conhecidas / próximos passos sugeridos

- Autenticação do painel em si (login) não está implementada — se for expor
  publicamente, colocar atrás de um proxy com auth básica ou VPN.
- Grandes listas (milhares de tasks) podem demorar alguns segundos para
  carregar, pois a agregação é feita no navegador.
- Drag-and-drop de widgets não incluído nesta versão (a grade se ajusta
  automaticamente); dá para adicionar depois se for útil.
