import sqlite3
from pathlib import Path
import logging

logger = logging.getLogger('my_logger')

DB_FILE = Path.cwd() / "data" / "data.db"

def retrieve_games(limit: int = 10) -> list | None:
    conn = None
    # retrieve data from data base
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM Game LIMIT ?", (limit,))
        results = cur.fetchall()
    except sqlite3.OperationalError:
        # error handling: wrong database path
        print(DB_FILE)
        return None
    finally:
        if conn is not None:
            conn.close()

    # make it a [dict]
    games = [dict(row) for row in results]
    return games