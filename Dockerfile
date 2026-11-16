FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=3001

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server ./server

EXPOSE 3001
RUN useradd --create-home --shell /bin/sh appuser
USER appuser
CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-3001}"]
