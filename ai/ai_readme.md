 # 🏓 AI Table Tennis Tracker - 使用说明

 本项目包括实时视觉追踪、回合分析、比赛总结、以及基于LSTM的胜率预测。

 ---

 ## 📦 文件结构说明

 - `cv.py`：视觉追踪逻辑（检测球、球拍、得分）。
 - `rule_based_report.py`：规则分析报告生成。
 - `predict.py`：使用LSTM模型预测每0.5s的得分概率。
 - `tracking_data.csv`：由系统自动生成的追踪数据文件。
 - `lstm_model.pt`：训练好的LSTM模型。

 ---

 ## 🔧 1. 视觉模块接口（cv.py）

 ### tracker.process_frame()

 - **说明**：处理单帧图像，检测球、球拍、进球事件等。
 - **使用**（需在循环中调用）：

 ```python
 while True:
     if not tracker.process_frame():
         break
 ```
 ---

 ### tracker.update_game_state(in_goal, scorer, round_id, game_id)

 - **说明**：随时调用，更新当前回合的游戏状态。
 - **参数**：
   - `in_goal`: 是否进球（True / False）
   - `scorer`: 得分方（1 或 2）
   - `round_id`: 当前回合编号
   - `game_id`: 当前比赛编号
 - **用法**：

 ```python
 tracker.update_game_state(
     in_goal=in_goal,
     scorer=scorer,
     round_id=tracker.round_id,
     game_id=tracker.game_id
 )
 ```

 ---
 ## 📊 2. 分析报告接口（rule_based_report.py）

 ### get_round_report_dict(game_id, round_id)

 - **说明**：获取某一场比赛的某一回合的分析。
 - **返回结构**：

 ```python
 {
     "game_id": 1,
     "round_id": 2,
     "paddle1": {
         "keywords": [...],
         "advice": "...",
         "status": "good|warning|normal"
     },
     "paddle2": {
         ...
     }
 }
 ```

 ---

 ### get_game_report_dict(game_id)

 - **说明**：获取整个比赛的分析报告。
 - **返回结构**：

 ```python
 {
     "game_id": 1,
     "paddle1": {
         "keywords": [...],
         "advice": "...",
         "status": "..."
     },
     "paddle2": {
         ...
     }
 }
 ```

 ---

 ## 🔮 3. 胜率预测接口（predict.py）

 ### get_prediction_dict()

 - **说明**：基于 `tracking_data.csv` 的前2秒窗口，每0.5秒预测一次 paddle1 和 paddle2 的胜率。
 - **返回结构**：

 ```python
 {
     2.0: {"paddle1": 0.64, "paddle2": 0.36},
     2.5: {"paddle1": 0.68, "paddle2": 0.32},
     ...
 }
 ```

 - **调用示例**：

 ```python
 from predict import get_prediction_dict

 predictions = get_prediction_dict()
 print(predictions[3.5])
 ```

 - **附加输出**：
   - `prediction_result.csv`：保存每次预测结果
   - `prediction_result.json`：保存字典格式结果

 ---

 ## ✅ 注意事项

 - 所有接口依赖 `tracking_data.csv`，请先运行 `tracker.process_frame()`。
 - 使用预测模块前，请先训练好 `lstm_model.pt`。
 - 所有方法均可嵌入服务或定期批处理调用。
