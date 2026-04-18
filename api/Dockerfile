FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade heads && exec uvicorn app.main:app --host ${API_HOST:-0.0.0.0} --port ${PORT:-${API_PORT:-8000}}"]
