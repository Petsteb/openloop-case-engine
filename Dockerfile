# OpenLoop: one image = FastAPI backend + the React UI it serves as static files.

# ---- stage 1: build the React UI (web/ -> web/dist) ----
FROM node:22-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- stage 2: runtime ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    OPENLOOP_DB=/data/openloop.db \
    PORT=8000
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 10001 app \
 && mkdir -p /data \
 && chown app:app /data

COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY --from=web /src/web/dist ./web/dist
# backend/eval holds the judge cache (judge.py writes it atomically next to itself) and the learner's history.
RUN chown -R app:app /app/backend/eval

USER app
VOLUME ["/data"]
EXPOSE 8000

# ONE worker on purpose: cases live in process memory behind a global write lock, and a single writer keeps
# each case's hash chain linear. Several workers would each hold their own copy of the cases and fork the ledger.
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --workers 1"]
