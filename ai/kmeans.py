import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader, TensorDataset

# 1. 读取数据
df = pd.read_csv("/home/mkbk/code/nus/proj/tracking_data_clean.csv")
data = df.select_dtypes(include=[np.number])  # 只用数值列

# 2. 标准化
scaler = StandardScaler()
X_scaled = scaler.fit_transform(data)
X_tensor = torch.tensor(X_scaled, dtype=torch.float32)

# 3. 定义自编码器
class Autoencoder(nn.Module):
    def __init__(self, input_dim, encoding_dim=5):
        super(Autoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, encoding_dim),
            nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.Linear(encoding_dim, 64),
            nn.ReLU(),
            nn.Linear(64, input_dim)
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

# 4. 初始化模型
input_dim = X_scaled.shape[1]
encoding_dim = 5
model = Autoencoder(input_dim, encoding_dim)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# 5. 训练模型
dataset = TensorDataset(X_tensor, X_tensor)
dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

for epoch in range(10):
    for batch_x, _ in dataloader:
        optimizer.zero_grad()
        outputs = model(batch_x)
        loss = criterion(outputs, batch_x)
        loss.backward()
        optimizer.step()
    if (epoch+1) % 10 == 0:
        print(f"Epoch [{epoch+1}/100], Loss: {loss.item():.4f}")

# 6. 获取编码特征
with torch.no_grad():
    X_encoded = model.encoder(X_tensor).numpy()

# 7. 聚类
kmeans = KMeans(n_clusters=4, random_state=42)
labels = kmeans.fit_predict(X_encoded)
df["cluster"] = labels

# 8. 保存结果
df.to_csv("clustered_output.csv", index=False)

# 9. 可视化（PCA降维）
pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_encoded)

plt.figure(figsize=(8, 6))
for i in range(4):
    plt.scatter(X_pca[labels == i, 0], X_pca[labels == i, 1], label=f"Cluster {i}")
plt.legend()
plt.title("Player Clusters")
plt.savefig("cluster_plot.png")
plt.show()
