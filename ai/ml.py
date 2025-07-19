import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.ensemble import AdaBoostClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
import warnings
import joblib

warnings.filterwarnings("ignore")  # 屏蔽部分不必要警告

# 读取数据
df = pd.read_csv(r"C:\Users\cxlou\Desktop\SWS-AIoT-Project\ai\csv\combined_data.csv")
print("选手 1 进球数:", (df["scorer"] == 1).sum())
print("选手 2 进球数:", (df["scorer"] == 2).sum())

df = df.sort_values(by=["timestamp"]).reset_index(drop=True)

# 选取进球前 0.5 ~ 1 秒的帧
selected_rows = []
goal_events = df[df["in_goal"] == 1]
for _, goal_row in goal_events.iterrows():
    goal_time = goal_row["timestamp"]
    scorer = goal_row["scorer"] - 1  # 转为 0/1
    candidates = df[(df["timestamp"] >= goal_time - 1) & (df["timestamp"] < goal_time - 0.5)]
    for _, row in candidates.iterrows():
        new_row = row.copy()
        new_row["scorer"] = scorer
        selected_rows.append(new_row)
selected_df = pd.DataFrame(selected_rows)

# 特征和标签
features = [
    "ball_u", "ball_v", "ball_speed", "ball_angle",
    "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_angle",
    "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_angle"
]
X = selected_df[features].values
y = selected_df["scorer"].values

# 拆分训练/验证集
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
'''
# 模型字典
model_dict = {
    "AdaBoost": AdaBoostClassifier(n_estimators=100, learning_rate=0.1, random_state=42),
    "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42),
    "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
    "SVM": SVC(probability=True, random_state=42),
    "MLP": MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
    "DecisionTree": DecisionTreeClassifier(max_depth=28, random_state=42),
    "KNN": KNeighborsClassifier(n_neighbors=5),
    "GaussianNB": GaussianNB()
}

# 遍历模型训练和评估
for model_name, model in model_dict.items():
    model.fit(X_train, y_train)
    y_pred = model.predict(X_val)
    
    # 有些模型没有 predict_proba，要处理一下
    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(X_val)[:, 1]
    elif hasattr(model, "decision_function"):
        y_prob = model.decision_function(X_val)
        # SVM的decision_function可能输出连续值，需要映射到[0,1]
        # 简单归一化处理
        y_prob = (y_prob - y_prob.min()) / (y_prob.max() - y_prob.min())
    else:
        y_prob = None
    
    accuracy = accuracy_score(y_val, y_pred)
    precision = precision_score(y_val, y_pred, zero_division=0)
    recall = recall_score(y_val, y_pred, zero_division=0)
    f1 = f1_score(y_val, y_pred, zero_division=0)
    auroc = roc_auc_score(y_val, y_prob) if y_prob is not None else None
    
    print(f"\n模型: {model_name}")
    print(f"  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1-score:  {f1:.4f}")
    print(f"  AUROC:     {auroc:.4f}" if auroc is not None else "  AUROC:     N/A")
    '''
# 随机森林模型
model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model.fit(X_train, y_train)

# 评估
y_pred = model.predict(X_val)
y_prob = model.predict_proba(X_val)[:, 1]

print("\n评估结果：")
print(f"  Accuracy:  {accuracy_score(y_val, y_pred):.4f}")
print(f"  Precision: {precision_score(y_val, y_pred):.4f}")
print(f"  Recall:    {recall_score(y_val, y_pred):.4f}")
print(f"  F1-score:  {f1_score(y_val, y_pred):.4f}")
print(f"  AUROC:     {roc_auc_score(y_val, y_prob):.4f}")

# 保存模型
joblib.dump(model, "random_forest_model.pkl")
print("\n✅ 随机森林模型已保存为 random_forest_model.pkl")
