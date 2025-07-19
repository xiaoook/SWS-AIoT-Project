import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

# 1. 读取并排序数据
df = pd.read_csv("train_data.csv")
df = df.sort_values(by=["timestamp"]).reset_index(drop=True)

# 2. 提取每次进球前 0.2 秒内的帧，统一打上进球时的 scorer 标签
selected_rows = []
goal_events = df[df["in_goal"] == 1]
for _, goal_row in goal_events.iterrows():
    goal_time = goal_row["timestamp"]
    scorer = goal_row["scorer"] - 1  # 转成0/1标签，paddle1赢为1
    # 修改：选取进球前 0.2 秒内的帧（不包括进球帧本身）
    candidates = df[
        (df["timestamp"] >= goal_time - 1.5) &
        (df["timestamp"] < goal_time -1)
    ]
    for _, row in candidates.iterrows():
        new_row = row.copy()
        new_row["scorer"] = scorer
        selected_rows.append(new_row)

selected_df = pd.DataFrame(selected_rows)

# 3. 特征和标签
features = [
    "ball_u", "ball_v", "ball_speed", "ball_angle",
    "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_angle",
    "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_angle"
]
X = selected_df[features].values
y = selected_df["scorer"].values  # paddle1赢为1

# 4. 拆分训练集和验证集
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 5. 训练 XGBoost 模型
model = xgb.XGBClassifier(
    max_depth=5,
    n_estimators=100,
    learning_rate=0.1,
    use_label_encoder=False,
    eval_metric='logloss',
    random_state=42
)

model.fit(X_train, y_train)

# 6. 评估
y_pred = model.predict(X_val)
y_prob = model.predict_proba(X_val)[:, 1]

print("Val Accuracy:", accuracy_score(y_val, y_pred))
print("Val AUROC:", roc_auc_score(y_val, y_prob))
