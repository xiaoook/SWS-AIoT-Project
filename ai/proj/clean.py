import pandas as pd

# 读取CSV
df = pd.read_csv("tracking_data1.csv")

# 查看哪些列有空值
print(df.isnull().sum())

# 删除含有空值的行
df_clean = df.dropna()

# 如果空值是空字符串，也可以用：
# df_clean = df[(df != '').all(axis=1)]

# 保存到新的CSV文件
df_clean.to_csv("tracking_data_clean.csv", index=False)
