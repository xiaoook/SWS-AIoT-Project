from pathlib import Path

# For app.run
BACKEND_URL = '0.0.0.0'
BACKEND_PORT = 45678

# For MQTT
BROKER_URL = '0.0.0.0'
BROKER_PORT = 45679

# For Database
DB_FILE = Path.cwd() / 'Backend' / "data" / "data.db"