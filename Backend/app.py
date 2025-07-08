import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from Backend.core.dataManage import *
from Backend.logger import logger
from flask_socketio import SocketIO, emit
app = Flask(__name__)
app.config['SECRET_KEY'] = 'hockey!'
socketio = SocketIO(app)

current_score = {
    'A': 0,
    'B': 0
}
current_round = 0

# emit the current score when the new client connects
@socketio.on('connect')
def on_connect():
    logger.info('Client connected')
    emit('score_update', current_score)

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

@app.route('/newgame', methods=['POST'])
def new_game():
    data = request.get_json()

    # get the data
    try:
        playerA = int(data.get('playerA'))
        playerB = int(data.get('playerB'))
        logger.debug(f'playerA: {playerA}')
        logger.debug(f'playerB: {playerB}')
    except ValueError as e:
        return jsonify({
            "status": "error",
            'message': 'player id should be an integer'
        }), 400

    # create the new game and get its gid
    try:
        gid = create_game(playerA, playerB)
    except RuntimeError as e:
        return jsonify({
            "status": "error",
            'message': str(e)
        }), 500

    return jsonify({
        "status": "success",
        "gid": gid
    }), 201

@app.route('/goal', methods=['GET'])
def goal():
    global current_score
    global current_round
    team = request.args.get('team')

    # error handling of gid
    try:
        gid = int(request.args.get('gid'))
    except ValueError:
        return jsonify({
            "status": "error",
            'message': 'gid should be an integer'
        })

    logger.debug(f'team: {team}')
    # make sure the team is right
    if team in current_score:
        current_round += 1
        current_score[team] += 1
        socketio.emit('score_update', current_score)
        logger.info(f'{team} scored, current score: {current_score[team]}')
        insert_rounds(gid, current_round, current_score) # insert the round into database
        return jsonify({
            "status": "success"
        }), 200

    # invalid team
    return jsonify({
        "status": "error",
        "message": "team not found"
    }), 400

if __name__ == "__main__":
    # app.run(debug=True, port=5000)
    socketio.run(app, debug=True, port=5000)