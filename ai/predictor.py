# predictor_rf.py
import joblib
import numpy as np

class RealTimePredictor:
    def __init__(self, model_path="random_forest_model.pkl"):
        self.model = joblib.load(model_path)
        self.feature_len = self.model.n_features_in_

    def update_and_predict(self, feature_vector):
        # 若特征不完整或长度不一致，跳过
        if any(f is None for f in feature_vector) or len(feature_vector) != self.feature_len:
            return None

        X = np.array(feature_vector).reshape(1, -1)
        probs = self.model.predict_proba(X)[0]  # [p0, p1]
        return {
            "playerA": int(probs[0] * 100),
            "playerB": int(probs[1] * 100)
        }

