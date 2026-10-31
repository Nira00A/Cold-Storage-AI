FROM python:3.12-slim

WORKDIR /app

COPY edge_simulation/requirements.txt ./edge_simulation/requirements.txt
RUN pip install --no-cache-dir -r ./edge_simulation/requirements.txt

COPY edge_simulation ./edge_simulation
RUN mkdir -p /data

ENV EDGE_DB_PATH=/data/edge_buffer.db
VOLUME ["/data"]

CMD ["python", "-m", "edge_simulation.main"]
