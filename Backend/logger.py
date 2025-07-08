import logging
from pathlib import Path

# create logger directory if not existing
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# log file directory
LOG_FILE = LOG_DIR / "log.log"

# create logger
logger = logging.getLogger('air_hockey_assistant')
logger.setLevel(logging.DEBUG)

# create file handler
file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
file_handler.setLevel(logging.INFO)

# create console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)

# set formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# add handler
if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)