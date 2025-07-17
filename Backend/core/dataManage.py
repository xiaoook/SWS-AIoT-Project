import json
import sqlite3
from pathlib import Path
from Backend.logger import logger
from Backend.config import DB_FILE
import time


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

def insert_rounds(gid: int, round: int, score: dict) -> None:
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO Round (roundInGame, gid, pointA, pointB) VALUES (?, ?, ?, ?)""", (round, gid, score["A"], score["B"]))
        conn.commit()
        logger.info(f"Round {round} of game {gid} inserted successfully")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()


def create_game(playerA: int, playerB: int) -> int:
    # get the current timestamp
    date_str = time.strftime("%Y-%m-%d", time.localtime())
    time_str = time.strftime("%H:%M:%S", time.localtime())

    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO Game (playerAid, playerBid, date, time) VALUES (?, ?, ?, ?)""", (playerA, playerB, date_str, time_str))
        conn.commit()
        # logger.info(f"Game {date_str} {time_str} inserted successfully")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

    # get the gid of the game created
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""SELECT gid FROM Game 
                       WHERE playerAid = ? AND 
                           playerBid = ? AND 
                           date = ? AND
                           time = ? """, (playerA, playerB, date_str, time_str))
        results = []
        results = cur.fetchone()
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

    if results == []:
        logger.error(f"failed to create the game")
        raise RuntimeError(f"failed to create the game")

    gid = results[0]
    logger.info(f"Game {date_str} {time_str} with id {gid} inserted successfully")
    return gid


def retrieve_selected_game(gid: int):
    # retrieve data from database
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
        SELECT * FROM Game WHERE gid = ? """, (gid,))
        result = cur.fetchone()
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        return None
    finally:
        if conn is not None:
            conn.close()

    # check whether the game with {gid} exists
    try:
        game = dict(result)
        logger.debug(f"found game {game}")
    except TypeError as e:
        logger.error(f"No game found with id {gid}")
        return {}
    return game

def new_player(name):
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("INSERT INTO Player (name) VALUES (?)", (name,))
        conn.commit()
    except sqlite3.OperationalError as e:
        logger.error(e)
        return None
    logger.info(f'player {name} created')
    return None


def fetch_all_players():
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM Player")
        results = cur.fetchall()
    except sqlite3.OperationalError as e:
        logger.error(e)
        return None
    finally:
        if conn is not None:
            conn.close()
    players = [dict(row) for row in results]
    return players

def update_game(gid: int, current_score: dict, duration = None, status: str = 'in progress') -> None:
    pointA, pointB = current_score["A"], current_score["B"]
    logger.debug(f"gid: {gid}, pointA: {pointA}, pointB: {pointB}, status: {status}")
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        if duration is None:
            cur.execute("""
            UPDATE Game 
            SET pointA = ?, pointB = ?, status = ?
            WHERE gid = ? """, (pointA, pointB, status, gid))
            conn.commit()
            logger.info(f"Game {gid} updated successfully with score {pointA} : {pointB}")
        else:
            cur.execute("""
                        UPDATE Game
                        SET pointA = ?,
                            pointB = ?,
                            status = ?,
                            duration = ?
                        WHERE gid = ? """, (pointA, pointB, status, duration, gid))
            conn.commit()
            logger.info(f"Game {gid} updated successfully with duration {duration}, status: {status}")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        return None
    finally:
        if conn is not None:
            conn.close()
    return None

def delete_selected_game(gid: int):
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("DELETE FROM Game WHERE gid = ?", (gid,))
        cur.execute("DELETE FROM Round WHERE gid = ?", (gid,))
        conn.commit()
        logger.info(f"Game {gid} deleted")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()
    return None

def delete_all_games():
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("DELETE FROM Game")
        cur.execute("DELETE FROM Round")
        conn.commit()
        logger.info(f"All games deleted")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

def get_game_analysis(gid):
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM GameAnalysis WHERE gid = ?", (gid,))
        result = cur.fetchone()
        if result is None:
            return None
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

    analysis = dict(result)
    analysis["A_type"] = json.loads(analysis["A_type"])
    analysis["B_type"] = json.loads(analysis["B_type"])
    analysis["A_analysis"] = json.loads(analysis["A_analysis"])
    analysis["B_analysis"] = json.loads(analysis["B_analysis"])
    return analysis

def insert_game_analysis(gid, error_type_a, analysis_a, error_type_b, analysis_b):
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO GameAnalysis (gid, A_type, A_analysis, B_type, B_analysis) 
        VALUES (?, ?, ?, ?, ?)""", (gid, json.dumps(error_type_a), json.dumps(analysis_a), json.dumps(error_type_b), json.dumps(analysis_b)))
        conn.commit()
        logger.info(f"Analysis of game {gid} inserted successfully")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

def get_round_analysis(gid):
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM RoundAnalysis WHERE gid = ?", (gid,))
        result = cur.fetchall()
        # logger.debug(f"Analysis: {result}")
        if result is None:
            return None
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()

    analyses = []
    for r in result:
        analysis = dict(r)
        analysis["A_type"] = json.loads(analysis["A_type"])
        analysis["B_type"] = json.loads(analysis["B_type"])
        analysis["A_analysis"] = json.loads(analysis["A_analysis"])
        analysis["B_analysis"] = json.loads(analysis["B_analysis"])
        analyses.append(analysis)

    return analyses

def insert_round_analysis(gid, rid, error_type_a, analysis_a, error_type_b, analysis_b):
    conn = None
    try:
        conn = sqlite3.connect(DB_FILE)
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO RoundAnalysis (gid, rid, A_type, A_analysis, B_type, B_analysis) 
        VALUES (?, ?, ?, ?, ?, ?)""", (gid, rid, json.dumps(error_type_a), json.dumps(analysis_a), json.dumps(error_type_b), json.dumps(analysis_b)))
        conn.commit()
        logger.info(f"Analysis of round {rid}, game {gid} inserted successfully")
    except sqlite3.OperationalError as e:
        logger.error(f"Error: {e}")
        raise RuntimeError(f"Error: {e}")
    finally:
        if conn is not None:
            conn.close()