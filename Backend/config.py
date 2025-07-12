from pathlib import Path

# For app.run
BACKEND_URL = '127.0.0.1'
BACKEND_PORT = 5000

# For MQTT
BROKER_URL = '127.0.0.1'
BROKER_PORT = 45677

# For Database
DB_FILE = Path.cwd() / 'Backend' / "data" / "data.db"