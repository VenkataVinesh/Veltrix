FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY . /app
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
