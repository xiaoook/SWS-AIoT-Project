from Backend.logger import logger
from Backend.core.dataManage import *
from flask import Blueprint, jsonify, request

analysis_bp = Blueprint('analysis', __name__)

@analysis_bp.route('/analysis/game', methods=['GET'])
def game_analysis():
    gid = request.args.get('gid')
    if gid is None:
        return jsonify({
            'status': 'error',
            'message': 'Invalid parameter'
        }), 400
    analysis = get_game_analysis(gid)
    if analysis is None:
        return jsonify({
            'status': 'error',
            'message': 'Game analysis not found'
        }), 404

    return jsonify({
        'status': 'success',
        'analysis': analysis
    }), 200

@analysis_bp.route('/analysis/game/new', methods=['POST'])
def new_game_analysis():
    data = request.get_json()
    logger.debug(f"New game analysis request: {data}")
    gid = data.get('gid')
    error_type_a = data.get('A_type')
    analysis_a = data.get('A_analysis')
    error_type_b = data.get('B_type')
    analysis_b = data.get('B_analysis')
    if gid is None:
        return jsonify({
            'status': 'error',
            'message': 'Invalid parameter'
        }), 400

    try:
        insert_game_analysis(gid, error_type_a, analysis_a, error_type_b, analysis_b)
    except RuntimeError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    return jsonify({
        'status': 'success',
    }), 200

@analysis_bp.route('/analysis/round/<gid>', methods=['GET'])
def round_analysis(gid=None):
    analyses = get_round_analysis(gid)
    if analyses is None:
        logger.error("Round analysis not found")
        return jsonify({
            'status': 'error',
            'message': 'Game analysis not found'
        }), 404

    return jsonify({
        'status': 'success',
        'analyses': analyses
    }), 200

@analysis_bp.route('/analysis/round/new', methods=['POST'])
def new_round_analysis(gid=None):
    data = request.get_json()
    gid = data.get('gid')
    rid = data.get('rid')
    error_type_a = data.get('A_type')
    error_type_b = data.get('B_type')
    analysis_a = data.get('A_analysis')
    analysis_b = data.get('B_analysis')

    if gid is None:
        logger.error("Invalid parameter")
        return jsonify({
            'status': 'error',
            'message': 'Invalid parameter'
        }), 400

    insert_round_analysis(gid, rid, error_type_a, analysis_a, error_type_b, analysis_b)

    return jsonify({
        'status': 'success'
    }), 200