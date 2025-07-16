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
    gid = data['gid']
    error_type_a = data['A_type']
    analysis_a = data['A_analysis']
    error_type_b = data['B_type']
    analysis_b = data['B_analysis']
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