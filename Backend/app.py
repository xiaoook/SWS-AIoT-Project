from flask import Flask, request, jsonify
from Backend.core.dataManage import *
from Backend.logger import logger

app = Flask(__name__)

@app.route('/', methods=['GET'])
def index():
    return "Hello World!"

@app.route('/games', methods=['POST'])
def call_retrieve_games():
    # retrieve query params
    data = request.get_json()
    limit = data.get('limit')
    # get name list
    logger.info(f'limit: {limit}')
    games = retrieve_games(limit)
    if games is None:
        # logger.error(f'No database found')
        return jsonify({
            "status": "error",
            "games": None
        }), 404

    logger.info(f'Found {len(games)} games')
    return jsonify({
        "status": "success",
        "games": games
    }), 200

@app.route('/games/<gid>/rounds', methods=['GET'])
def call_retrieve_rounds(gid=None):
    logger.debug(f'gid: {gid}')
    # the circumstance that no gid provided
    if gid is None:
        logger.error('no gid provided')
        return jsonify({
            "status": "error",
            "message": "gid is required"
        }), 422

    # retrieve rounds
    rounds = retrieve_rounds(gid)

    # The circumstance that no rounds found
    if rounds == []:
        logger.error('no rounds found')
        return jsonify({
            "status": "error",
            "message": "Round not found"
        }), 404
    
    logger.info(f'Found {len(rounds)} rounds')
    return jsonify({
        "status": "success",
        "rounds": rounds
    }), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)