import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from Backend.core.dataManage import *
from Backend.logger import logger
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hockey!'
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

current_score = {
    'A': 0,
    'B': 0
}
current_round = 0
current_game = 0

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

@app.route('/games/new', methods=['POST'])
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

    # change the current game to the new game
    global current_game
    global current_score
    global current_round
    current_game = gid
    current_score = {'A': 0, 'B': 0}
    current_round = 0

    return jsonify({
        "status": "success",
        "gid": gid
    }), 201

@app.route('/goal', methods=['GET'])
def goal():
    global current_score
    global current_round
    global current_game
    team = request.args.get('team')
    gid = current_game

    if gid == 0:
        logger.error(f'A game should be selected, the gid now is {gid}')
        return jsonify({
            "status": "error",
            "message": "please select a game"
        }), 400

    logger.debug(f'team: {team}')
    # make sure the team is right
    if team in current_score:
        current_round += 1
        current_score[team] += 1
        socketio.emit('score_update', current_score)
        logger.info(f'{team} scored, current score: {current_score[team]}')
        insert_rounds(gid, current_round, current_score) # insert the round into database
        update_game(gid, current_score)
        return jsonify({
            "status": "success",
            'score': current_score
        }), 200

    # invalid team
    return jsonify({
        "status": "error",
        "message": "team not found"
    }), 400

@app.route('/games/select', methods=['GET'])
def select_game():
    global current_score
    global current_round
    global current_game

    try:
        game = int(request.args.get('game'))
    except ValueError as e:
        game = request.args.get('game')
        logger.error(f'invalid game {game}, should be an integer')
        return jsonify({
            "status": "error",
            'message': f'invalid game {game}, should be an integer'
        }), 400

    game = retrieve_selected_game(game)

    # game not found
    if game == {}:
        return jsonify({
            "status": "error",
            "message": "game not found"
        }), 404

    # set global variables
    current_score = {
        'A': game['pointA'],
        'B': game['pointB']
    }
    current_round = game['pointA'] + game['pointB']
    current_game = game['gid']
    socketio.emit('score_update', current_score)

    logger.info(f'game {game["gid"]} is selected')

    return jsonify({
        "status": "success",
        "game": game
    }), 200

@app.route('/games/update', methods=['POST'])
def change_game_status():
    data = request.get_json()
    gid = data.get('gid')
    status = data.get('status').lower()
    duration = data.get('duration')
    global current_score
    logger.debug(f'gid: {gid}, status: {status}, duration: {duration}')

    # verify whether the gid is the current game
    if gid != current_game:
        logger.error(f'game {gid} is not the current game')
        return jsonify({
            "status": "error",
            "message": f'game {gid} is not the current game'
        }), 400

    update_game(gid, current_score, status=status, duration=duration)
    return jsonify({
        "status": "success"
    })

@app.route('/games/delete', methods=['DELETE'])
def delete_game():
    data = request.get_json()
    gid = data.get('gid')
    logger.debug(f'gid: {gid}')

    global current_score
    global current_round
    global current_game

    if gid == current_game:
        current_score = {'A': 0, 'B': 0}
        current_round = 0
        current_game = 0
        socketio.emit('score_update', current_score)

    delete_selected_game(gid)
    return jsonify({
        "status": "success"
    }), 200

@app.route('/games/delete/all', methods=['DELETE'])
def call_delete_all_games():
    delete_all_games()
    return jsonify({
        "status": "success"
    })

@app.route('/player/create', methods=['POST'])
def create_player():
    data = request.get_json()
    name = data.get('name')
    new_player(name)
    return jsonify({
        "status": "success",
        "name": name
    }), 201

@app.route('/player/all', methods=['GET'])
def all_players():
    players = fetch_all_players()
    if players is None:
        return jsonify({
            "status": "error",
            "message": "database error"
        }), 500

    logger.info(f'Found {len(players)} players')
    return jsonify({
        "status": "success",
        "players": players
    }), 200

if __name__ == "__main__":
    # app.run(debug=True, port=5000)
    socketio.run(app, debug=True, port=5000)