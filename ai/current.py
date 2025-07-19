import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

# 1. 读取并排序数据
df = pd.read_csv("train_data.csv")
df = df.sort_values(by=["timestamp"]).reset_index(drop=True)

# 2. 提取每次进球前0.2秒内帧，给标签
selected_rows = []
goal_events = df[df["in_goal"] == 1]
for _, goal_row in goal_events.iterrows():
    goal_time = goal_row["timestamp"]
    scorer = goal_row["scorer"]-1  # 转成0/1标签，paddle1赢为1
    candidates = df[
        (df["timestamp"] < goal_time-0.2) &
        (df["timestamp"] >= goal_time - 0.4)
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
y = (selected_df["scorer"] == 1).astype(float).values  # 转成0/1标签，paddle1赢为1

# 4. 训练/验证拆分
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42
)
X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
y_train_tensor = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
X_val_tensor = torch.tensor(X_val, dtype=torch.float32)
y_val_tensor = torch.tensor(y_val, dtype=torch.float32).unsqueeze(1)

# 5. 构造DataLoader
batch_size = 16
train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
val_dataset = TensorDataset(X_val_tensor, y_val_tensor)
train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=batch_size)

# 6. 定义MLP模型
class MLP(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    def forward(self, x):
        return self.net(x)

model = MLP(input_dim=X.shape[1])
criterion = nn.BCELoss()
optimizer = optim.Adam(model.parameters(), lr=1e-3)

# 7. 训练20轮
for epoch in range(50):
    model.train()
    running_loss = 0.0

    for batch_x, batch_y in train_loader:
        optimizer.zero_grad()
        outputs = model(batch_x)
        loss = criterion(outputs, batch_y)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * batch_x.size(0)

    epoch_loss = running_loss / len(train_loader.dataset)

    # 验证集评估
    model.eval()
    all_val_preds = []
    all_val_probs = []
    with torch.no_grad():
        for val_x, val_y in val_loader:
            val_outputs = model(val_x)
            all_val_probs.append(val_outputs)
            all_val_preds.append((val_outputs > 0.5).float())

    all_val_probs = torch.cat(all_val_probs).cpu().numpy()
    all_val_preds = torch.cat(all_val_preds).cpu().numpy()
    val_acc = (all_val_preds == y_val_tensor.cpu().numpy()).mean()
    val_auc = roc_auc_score(y_val, all_val_probs)

    print(f"Epoch {epoch+1:02d} - Loss: {epoch_loss:.4f} - Val Acc: {val_acc:.4f} - Val AUROC: {val_auc:.4f}")

# 8. 验证集逐帧预测概率并打印
model.eval()
with torch.no_grad():
    val_probs = model(X_val_tensor).squeeze().numpy()

val_df = selected_df.iloc[len(y_train):].copy()


