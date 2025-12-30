FROM python:3.14-slim

COPY api-requirements.txt ./
RUN pip install --no-cache -r api-requirements.txt

COPY app.py ./
EXPOSE 1519

CMD ["uvicorn", "app:app", \
     "--env-file", "/project/.env", \
     "--root-path", "/next-pr-number-api", "--port", "1519", "--no-proxy-headers"]
