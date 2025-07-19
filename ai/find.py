import cv2

def find_cameras(max_index=5):
    for i in range(max_index):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            print(f"Camera found at index {i}")
            cap.release()
        else:
            print(f"No camera at index {i}")

find_cameras()
