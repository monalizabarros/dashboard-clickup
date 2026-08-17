#!/bin/bash
# Inicia o Painel de Acompanhamento localmente.
# Uso: ./iniciar.sh

set -e
cd "$(dirname "$0")/backend"

# procura o Python mais novo disponível (exige 3.10+)
PYTHON=""
for cand in python3.13 python3.12 python3.11 python3.10; do
  if command -v "$cand" >/dev/null 2>&1; then
    PYTHON="$cand"
    break
  fi
done

# fallback: python3 genérico, mas só se for 3.10+
if [ -z "$PYTHON" ] && command -v python3 >/dev/null 2>&1; then
  MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
  if [ "$MINOR" -ge 10 ]; then PYTHON="python3"; fi
fi

if [ -z "$PYTHON" ]; then
  echo "❌ Nenhum Python 3.10+ encontrado. Instale com: brew install python@3.12"
  exit 1
fi
echo "Usando: $($PYTHON --version)"

# se a venv existente foi criada com Python antigo (<3.10), recria
if [ -d "venv" ]; then
  VENV_MINOR=$(venv/bin/python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo 0)
  if [ "$VENV_MINOR" -lt 10 ]; then
    echo "Ambiente virtual antigo (Python 3.$VENV_MINOR) detectado. Recriando com $($PYTHON --version)..."
    rm -rf venv
  fi
fi

if [ ! -d "venv" ]; then
  echo "Criando ambiente virtual..."
  "$PYTHON" -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

echo "Subindo o servidor em http://localhost:8000 (Ctrl+C para parar)"
uvicorn main:app --reload
