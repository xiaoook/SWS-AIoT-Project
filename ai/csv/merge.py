import pandas as pd
import os
import glob

# 设置你的 CSV 文件所在文件夹路径
csv_folder = r"C:\Users\cxlou\Desktop\SWS-AIoT-Project\ai\csv"
 # ← 修改为你的实际路径

# 查找所有 CSV 文件
csv_files = glob.glob(os.path.join(csv_folder, "*.csv"))

# 读取并合并所有 CSV
df_list = []
for file in csv_files:
    df = pd.read_csv(file)
    df_list.append(df)

# 合并为一个 DataFrame
combined_df = pd.concat(df_list, ignore_index=True)

# 按照时间排序（可选）
combined_df = combined_df.sort_values(by="timestamp").reset_index(drop=True)

# 保存为新的 CSV（可选）
combined_df.to_csv("combined_data.csv", index=False)

print(f"✅ 合并完成，总共有 {len(combined_df)} 行数据。")
