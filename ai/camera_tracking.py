import cv2

# 打开摄像头编号 2
cap = cv2.VideoCapture(2)

# 检查是否成功打开
if not cap.isOpened():
    print("无法打开摄像头 2")
    exit()



print("按 q 退出")

while True:
    ret, frame = cap.read()
    if not ret:
        print("无法读取帧")
        break

    # 显示图像
    cv2.imshow("Camera 2", frame)

    # 按下 q 键退出
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# 释放资源
cap.release()
cv2.destroyAllWindows()
