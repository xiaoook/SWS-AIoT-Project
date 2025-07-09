import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, random_split
import torch.nn as nn
import torch.optim as optim
from model import LSTMClassifier

class ScoreSequenceDataset(Dataset):
    def __init__(self, csv_path, window_sec=1.0):
        self.df = pd.read_csv(csv_path)
        self.window_sec = window_sec
        self.feature_cols = [
            "ball_u","ball_v","ball_speed","ball_acc","ball_dir",
            "paddle1_u","paddle1_v","paddle1_speed","paddle1_acc","paddle1_dir",
            "paddle2_u","paddle2_v","paddle2_speed","paddle2_acc","paddle2_dir",
            "dist_ball_paddle1","dist_ball_paddle2",
            "dist_paddle1_paddle2",
            "dist_ball_goal"
        ]
        self.samples = []
        self.labels = []

        self.prepare_samples()

    def prepare_samples(self):
        df = self.df
        scorer_rows = df[df['scorer'] != 0].index.tolist()

        for idx in scorer_rows:
            score_time = df.loc[idx, 'timestamp']
            scorer = int(df.loc[idx, 'scorer']) - 1  # 标签0或1

            window_start_time = score_time - 2
            window_end_time = score_time - 0.5
            window_df = df[(df['timestamp'] >= window_start_time) & (df['timestamp'] < window_end_time)]
            window_df = window_df.dropna(subset=self.feature_cols)

            if len(window_df) == 0:
                continue

            data = window_df[self.feature_cols].values.astype(np.float32)
            self.samples.append(torch.tensor(data))
            self.labels.append(scorer)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx], self.labels[idx]

def collate_fn(batch):
    sequences, labels = zip(*batch)
    lengths = [len(seq) for seq in sequences]
    padded_seqs = torch.nn.utils.rnn.pad_sequence(sequences, batch_first=True)
    labels = torch.tensor(labels)
    lengths = torch.tensor(lengths)
    return padded_seqs, labels, lengths

def train_one_epoch(model, train_loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    total_samples = 0
    for batch_seqs, batch_labels, batch_lens in train_loader:
        batch_seqs = batch_seqs.to(device)
        batch_labels = batch_labels.to(device)
        batch_lens = batch_lens.to(device)

        optimizer.zero_grad()
        outputs = model(batch_seqs, batch_lens)

        loss = criterion(outputs, batch_labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * batch_seqs.size(0)
        total_samples += batch_seqs.size(0)

    avg_loss = total_loss / total_samples if total_samples > 0 else 0
    return avg_loss

def evaluate(model, test_loader, device):
    model.eval()
    total_correct = 0
    total_samples = 0
    with torch.no_grad():
        for test_seqs, test_labels, test_lens in test_loader:
            test_seqs = test_seqs.to(device)
            test_labels = test_labels.to(device)
            test_lens = test_lens.to(device)

            outputs = model(test_seqs, test_lens)
            _, preds = torch.max(outputs, 1)
            total_correct += (preds == test_labels).sum().item()
            total_samples += test_seqs.size(0)

    accuracy = total_correct / total_samples if total_samples > 0 else 0
    return accuracy

if __name__ == "__main__":
    csv_path = "tracking_data_clean.csv"
    window_sec = 2
    batch_size = 4
    epochs = 20

    dataset = ScoreSequenceDataset(csv_path, window_sec=window_sec)
    scorer_counts = [0, 0]
    for label in dataset.labels:
        scorer_counts[label] += 1
    print(f"Player 1 得分次数: {scorer_counts[0]}")
    print(f"Player 2 得分次数: {scorer_counts[1]}")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LSTMClassifier(input_size=len(dataset.feature_cols)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    for epoch in range(epochs):
        total_len = len(dataset)
        train_len = int(total_len * 0.8)
        test_len = total_len - train_len
        train_set, test_set = torch.utils.data.random_split(dataset, [train_len, test_len])

        train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)
        test_loader = DataLoader(test_set, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)

        train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device)
        test_acc = evaluate(model, test_loader, device)

        print(f"Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.4f} - Test Accuracy: {test_acc:.4f}")

    torch.save(model.state_dict(), "lstm_model.pt")
    print("模型已保存到: lstm_model.pt")
