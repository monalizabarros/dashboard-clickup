# Configurar backup no Google Drive (via API)

Este método envia os backups **direto para a nuvem**, sem precisar instalar o app
Google Drive Desktop. Funciona igual no seu Mac ou, no futuro, num servidor.

Vai levar uns 10 minutos, é só seguir a ordem. Precisa ter uma conta Google (a mesma
que você já usa no Drive).

---

## Passo 1 — Criar um projeto no Google Cloud

1. Acesse **https://console.cloud.google.com/** e faça login com sua conta Google.
2. No topo da página, clique no seletor de projeto → **Novo Projeto**.
3. Dê um nome (ex: `painel-3wings-backup`) → **Criar**.
4. Espere alguns segundos e confirme que o projeto novo está selecionado no topo.

## Passo 2 — Ativar a API do Google Drive

1. No menu lateral (☰) → **APIs e serviços** → **Biblioteca**.
2. Busque por **Google Drive API**.
3. Clique nela → **Ativar**.

## Passo 3 — Criar a "conta de serviço" (a credencial que vai fazer o upload)

1. Menu lateral → **APIs e serviços** → **Credenciais**.
2. **Criar credenciais** → **Conta de serviço**.
3. Nome: algo como `painel-backup` → **Criar e continuar**.
4. Nas telas seguintes ("Conceder acesso"), pode **pular** (não precisa de permissão
   especial no projeto) → **Concluir**.
5. Você volta pra tela de Credenciais. Na lista, clique na conta de serviço que acabou
   de criar (algo como `painel-backup@painel-3wings-backup.iam.gserviceaccount.com`).
6. Guarde esse endereço de e-mail — vai precisar dele no Passo 5.
7. Aba **Chaves** → **Adicionar chave** → **Criar nova chave** → tipo **JSON** → **Criar**.
8. Um arquivo `.json` é baixado automaticamente. **Esse arquivo é a senha de acesso —
   trate como algo sigiloso, nunca compartilhe.**

## Passo 4 — Colocar a chave no projeto

1. Mova o arquivo `.json` baixado para dentro de `clickup-dashboard/backend/`.
2. Renomeie para algo simples, tipo `gdrive-key.json`.
3. No Terminal, confirme o caminho completo:
   ```bash
   cd ~/Downloads/clickup-dashboard/backend
   pwd
   ```
   O caminho da chave será esse resultado + `/gdrive-key.json`.

## Passo 5 — Criar e compartilhar a pasta no Drive

1. Abra **https://drive.google.com** normalmente, pelo navegador.
2. Crie uma pasta nova, ex: **Backups-Painel**.
3. Clique com o botão direito nela → **Compartilhar**.
4. No campo de e-mail, cole o e-mail da conta de serviço (do Passo 3.6) — algo como
   `painel-backup@painel-3wings-backup.iam.gserviceaccount.com`.
5. Papel: **Editor**. Envie o compartilhamento (pode ignorar o aviso de que é uma conta
   "fora da organização").
6. Abra a pasta e copie o ID dela na URL do navegador:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                            └────────── isso aqui é o ID ──────────┘
   ```

## Passo 6 — Configurar o `.env`

Abra `backend/.env` (`nano ~/Downloads/clickup-dashboard/backend/.env`) e adicione:

```
GDRIVE_CREDENTIALS_PATH=/Users/monalizabarros/Downloads/clickup-dashboard/backend/gdrive-key.json
GDRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

(troque pelo caminho e ID reais que você pegou nos passos anteriores)

## Passo 7 — Instalar as dependências novas e testar

```bash
cd ~/Downloads/clickup-dashboard/backend
source venv/bin/activate
pip install -r requirements.txt
cd ..
./backup.sh
```

Se aparecer `☁️ Enviado ao Google Drive: dashboard-...db`, funcionou — confira também
abrindo a pasta no navegador, o arquivo deve aparecer lá.

Se dentro do painel (Usuários → Backup agora) o status mostrar o método "via API" com
um arquivo recente, está tudo certo.

---

## Erros comuns

- **"Credencial não encontrada"** → confira se o caminho em `GDRIVE_CREDENTIALS_PATH`
  está exatamente certo (rode `pwd` na pasta `backend` pra conferir).
- **"File not found" ou erro 404 ao enviar** → o `GDRIVE_FOLDER_ID` está errado, ou a
  pasta não foi compartilhada com o e-mail da conta de serviço (Passo 5.4).
- **Erro 403 / permission denied** → confira se o papel dado no compartilhamento foi
  **Editor**, não "Leitor".

## Por que uma "conta de serviço" e não sua conta pessoal?

Contas de serviço são feitas pra automação — não têm senha, não expiram como um login
comum, e dá pra revogar o acesso a qualquer momento (excluindo a chave) sem afetar sua
conta Google pessoal. É o jeito recomendado pela própria Google para esse tipo de uso.
