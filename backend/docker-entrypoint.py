#!/usr/bin/env python3
"""Docker entrypoint: load server.env.<environment>.json as env vars.

Reads the flat JSON file at:
  ${CONFIG_PATH}/server/server.env.${EASYLIFE_ENVIRONMENT}.json

Each key becomes:  EASYLIFE_<KEY>=<value>
e.g.  "databases.authentication.db_info.host": "mongodb"
  →   EASYLIFE_DATABASES.AUTHENTICATION.DB_INFO.HOST=mongodb

Existing env vars are NOT overwritten (Docker/PCF env wins).
After loading, exec's the CMD passed as arguments (uvicorn).
"""
import json
import os
import sys


def load_server_env():
    config_path = os.environ.get("CONFIG_PATH", "/app/config")
    environment = os.environ.get("EASYLIFE_ENVIRONMENT", "production")
    prefix = "EASYLIFE"

    env_file = os.path.join(config_path, "server", f"server.env.{environment}.json")

    if not os.path.isfile(env_file):
        print(f"[entrypoint] No server env file at: {env_file} (skipped)", flush=True)
        return 0

    print(f"[entrypoint] Loading env from: {env_file}", flush=True)

    with open(env_file) as f:
        data = json.load(f)

    loaded = 0
    for key, value in data.items():
        env_key = f"{prefix}_{key}".upper()
        if env_key in os.environ:
            continue  # existing env var wins

        if isinstance(value, (dict, list)):
            os.environ[env_key] = json.dumps(value)
        elif isinstance(value, bool):
            os.environ[env_key] = str(value).lower()
        else:
            os.environ[env_key] = str(value)
        loaded += 1

    print(f"[entrypoint] Loaded {loaded} env vars ({len(data) - loaded} already set)", flush=True)
    return loaded


if __name__ == "__main__":
    load_server_env()

    # exec the CMD (e.g. uvicorn)
    if len(sys.argv) > 1:
        os.execvp(sys.argv[1], sys.argv[1:])
