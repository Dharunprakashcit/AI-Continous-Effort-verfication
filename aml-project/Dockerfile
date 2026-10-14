# Serves the Gradio UI on 7860 (Hugging Face Spaces default) and the Flask API on 8080.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=user config.yaml app.py api.py start.sh ./
COPY --chown=user src ./src
COPY --chown=user artifacts/champion.pkl artifacts/train_report.json ./artifacts/
USER user
ENV PYTHONUNBUFFERED=1 GRADIO_ANALYTICS_ENABLED=False
EXPOSE 7860 8080
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8080/health')" || exit 1
CMD ["sh", "start.sh"]
