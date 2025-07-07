 README  
   
 ## 项目简介  
   
 本项目基于视频或摄像头实时检测乒乓球赛场，追踪球和球拍位置，计算速度和加速度，使用LSTM模型做运动预测，并自动保存比赛事件数据和进球视频片段。  
   
 ---  
   
 ## 运行环境  
   
 - Python 3.10+  
 - 依赖库：`opencv-python`, `numpy`, `pandas`, `torch` 等  
 - 需要已训练好的LSTM模型文件 `lstm_model.pt`  
 - 视频或摄像头设备路径作为输入  
   
 ---  
   
 ## 运行方法  
   
 ```bash  
 > python monitor.py  
 ```  
   
 默认会读取脚本中 `video_path` 指定的视频文件或摄像头设备，开始实时分析。  
   
 ---  
   
 ## 如何获取预测数据  
   
 - 程序每隔0.5秒使用最近1秒的追踪数据调用LSTM模型进行预测  
 - 预测概率实时显示在视频窗口右侧，格式如下：  
   
 ```  
 === LSTM Prediction ===  
 Player 1: 0.735  
 Player 2: 0.265  
 ```  
   
 ---  
   
 ## 事件数据（JSON文件）  
   
 - 程序会在发生进球时，自动分析进球前3秒的数据生成运动建议  
 - 事件数据以JSON格式追加保存到 `goal_events.json`  
 - JSON格式示例：  
   
 ```json  
 {  
     "timestamp": 1688700000.123,  
     "scorer": 1,  
     "score_player1": 3,  
     "score_player2": 2,  
     "issues": [  
         "Paddle2 speed variability high",  
         "Paddle1 too far from ball"  
     ],  
     "suggestions": [  
         "Smooth out motion to reduce unnecessary energy loss.",  
         "Improve anticipation and closer positioning to seize control."  
     ]  
 }  
 ```  
   
 ---  
   
 ## 进球视频片段  

  
 - 当检测到进球事件时，会自动保存进球发生前3秒的比赛视频片段  
 - 视频保存路径格式为：  
   
 ```  
 recording/goal_clip_<scorer>_<timestamp>.mp4  
 ```  
   
 例如：  
   
 ```  
 recording/goal_clip_1_1688700000.mp4  
 ```  
   
 ---  
   


