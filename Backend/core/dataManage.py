import sqlite3
from pathlib import Path
import logging
from Backend.logger import logger

DB_FILE = Path.cwd() / "data" / "data.db"

def retrieve_games(limit: int = 10) -> list | None:
    conn = None
    # retrieve data from data base
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
        SELECT
            g.gid,
            date,
            p1.name AS playerAname,
            p2.name AS playerBname,
            pointA,
            pointB,
            time,
            duration
        FROM Game g
        JOIN Player p1 ON g.playerAid = p1.pid
        JOIN Player p2 ON g.playerBid = p2.pid
        LIMIT ?
        """, (limit,))
        results = cur.fetchall()
    except sqlite3.OperationalError as e:
        # error handling: wrong database path
        logger.error(f"Error: {e}")
        return None
    finally:
        if conn is not None:
            conn.close()

    # make it a [dict]
    games = [dict(row) for row in results]
    return games

def retrieve_rounds(gid: int) -> list | None:
    logger.info(f"Retrieving rounds for game {gid}")
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
        SELECT * FROM Round
        WHERE gid = ? 
        ORDER BY 
            roundInGame ASC""", (gid,))
        results = cur.fetchall()
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        return None
    finally:
        if conn is not None:
            conn.close()

    rounds = [dict(row) for row in results]
    return rounds