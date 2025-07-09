import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import export_text
from sklearn.metrics import classification_report, confusion_matrix

# 1. 加载数据
df = pd.read_csv("/home/mkbk/code/nus/proj/tracking_data_clean.csv")  # 修改为你的CSV路径

# 2. 选择特征列和目标列
features = [
    'ball_u', 'ball_v', 'ball_speed', 'ball_acc', 'ball_dir',
    'paddle1_u', 'paddle1_v', 'paddle1_speed', 'paddle1_acc', 'paddle1_dir',
    'paddle2_u', 'paddle2_v', 'paddle2_speed', 'paddle2_acc', 'paddle2_dir',
    'dist_ball_paddle1', 'dist_ball_paddle2', 'dist_paddle1_paddle2', 'dist_ball_goal'
]

target = 'in_goal'  # 或者改成 'scorer'

# 3. 数据清洗（删除缺失）
df = df.dropna(subset=features + [target])

# 4. 分割数据
X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 5. 训练随机森林模型
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 6. 输出模型评估结果
y_pred = clf.predict(X_test)
print("分类报告：")
print(classification_report(y_test, y_pred))
print("混淆矩阵：")
print(confusion_matrix(y_test, y_pred))

# 7. 输出特征重要性
importances = clf.feature_importances_
feature_importance = pd.Series(importances, index=features).sort_values(ascending=False)
print("特征重要性：")
print(feature_importance)

# 8. 可选：导出一棵树的规则
print("\n示例决策树规则（部分）：")
print(export_text(clf.estimators_[0], feature_names=features, max_depth=3))
