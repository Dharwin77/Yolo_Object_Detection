import os
import cv2
import numpy as np
import time
import uuid
import threading
import urllib.request
import base64
import io
from PIL import Image as PILImage
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Directory setup
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
YOLO_COCO_DIR = os.path.join(WORKSPACE_DIR, 'yolo-coco')
CAFFE_DIR = os.path.join(WORKSPACE_DIR, 'real-time-object-detection')
PROCESSED_DIR = os.path.join(WORKSPACE_DIR, 'processed_media')
UPLOAD_DIR = os.path.join(WORKSPACE_DIR, 'uploads')

os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(YOLO_COCO_DIR, exist_ok=True)

# Global states
download_state = {
    "model": None,
    "progress": 0,
    "status": "idle",
    "error": None
}

video_tasks = {}

# Class names for MobileNet SSD
SSD_CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
               "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
               "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
               "sofa", "train", "tvmonitor"]

# Generate consistent colors for classes
np.random.seed(42)
SSD_COLORS = np.random.randint(0, 255, size=(len(SSD_CLASSES), 3), dtype="uint8")
YOLO_COLORS = np.random.randint(0, 255, size=(80, 3), dtype="uint8")

# CORS setup
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Check if a file is just a Git LFS pointer
def is_lfs_pointer(filepath):
    if not os.path.exists(filepath):
        return True
    # Only flag as LFS pointer if the file actually contains the LFS version header.
    # Do NOT blanket-reject small files — coco.names (625 bytes) is a valid small file.
    try:
        with open(filepath, 'rb') as f:
            header = f.read(50).decode('utf-8', errors='ignore')
            if "version https://git-lfs" in header:
                return True
    except Exception:
        pass
    return False

# Model status endpoint
@app.route('/api/status', methods=['GET'])
def get_status():
    status = {
        "mobilenet_ssd": {
            "name": "MobileNet SSD (Caffe)",
            "status": "ready" if os.path.exists(os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.caffemodel')) and os.path.exists(os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.prototxt.txt')) else "missing",
            "weights_exists": os.path.exists(os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.caffemodel')),
            "config_exists": os.path.exists(os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.prototxt.txt'))
        },
        "yolov3": {
            "name": "YOLOv3 (COCO)",
            "status": "ready" if not (is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3.weights')) or is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3.cfg')) or is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'coco.names'))) else "missing",
            "weights_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3.weights')),
            "config_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3.cfg')),
            "labels_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'coco.names'))
        },
        "yolov3_tiny": {
            "name": "YOLOv3-Tiny (COCO)",
            "status": "ready" if not (is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3-tiny.weights')) or is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3-tiny.cfg')) or is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'coco.names'))) else "missing",
            "weights_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3-tiny.weights')),
            "config_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'yolov3-tiny.cfg')),
            "labels_exists": not is_lfs_pointer(os.path.join(YOLO_COCO_DIR, 'coco.names'))
        }
    }
    return jsonify({
        "status": "online",
        "models": status,
        "download_state": download_state
    })

# Asynchronous model downloader task
def download_model_task(model_name):
    global download_state
    try:
        download_state["model"] = model_name
        download_state["status"] = "downloading"
        download_state["progress"] = 0
        download_state["error"] = None

        urls = {}
        if model_name == "yolov3":
            urls = {
                "yolov3.weights": "https://pjreddie.com/media/files/yolov3.weights",
                "yolov3.cfg": "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3.cfg",
                "coco.names": "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"
            }
        elif model_name == "yolov3_tiny":
            urls = {
                "yolov3-tiny.weights": "https://pjreddie.com/media/files/yolov3-tiny.weights",
                "yolov3-tiny.cfg": "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3-tiny.cfg",
                "coco.names": "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"
            }
        else:
            raise ValueError(f"Unknown model name: {model_name}")

        # Total sizes for progress estimation
        sizes = {
            "yolov3.weights": 248007048,
            "yolov3.cfg": 8342,
            "yolov3-tiny.weights": 35434956,
            "yolov3-tiny.cfg": 1915,
            "coco.names": 624
        }

        total_bytes = sum(sizes.get(f, 1000000) for f in urls.keys())
        downloaded_bytes = 0

        for filename, url in urls.items():
            filepath = os.path.join(YOLO_COCO_DIR, filename)
            
            # Simple header to look like a browser
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            
            with urllib.request.urlopen(req) as response:
                # Open with overwrite
                with open(filepath, 'wb') as f:
                    while True:
                        chunk = response.read(16384)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        # Avoid division by zero
                        percent = round((downloaded_bytes / total_bytes) * 100, 1)
                        download_state["progress"] = min(percent, 99.9)

        download_state["status"] = "success"
        download_state["progress"] = 100
    except Exception as e:
        download_state["status"] = "error"
        download_state["error"] = str(e)

# Trigger model download
@app.route('/api/download-model', methods=['POST'])
def trigger_download():
    global download_state
    if download_state["status"] == "downloading":
        return jsonify({"error": "A download is already in progress"}), 400
    
    data = request.json or {}
    model = data.get("model")
    if model not in ["yolov3", "yolov3_tiny"]:
        return jsonify({"error": "Invalid model selection"}), 400
        
    thread = threading.Thread(target=download_model_task, args=(model,))
    thread.daemon = True
    thread.start()
    return jsonify({"message": f"Started downloading {model}", "status": "downloading"})

# Download progress
@app.route('/api/download-progress', methods=['GET'])
def get_download_progress():
    return jsonify(download_state)

# Core Object Detection Logic
def _run_ssd_on_tile(net, image, offset_x, offset_y, orig_W, orig_H, confidence_threshold):
    """Run MobileNet SSD on a single image tile and return detections in original image coordinates."""
    tH, tW = image.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(image, (300, 300)), 0.007843, (300, 300), 127.5)
    net.setInput(blob)
    raw = net.forward()
    results = []
    for i in range(raw.shape[2]):
        confidence = float(raw[0, 0, i, 2])
        if confidence > confidence_threshold:
            idx = int(raw[0, 0, i, 1])
            if idx == 0:
                continue
            label = SSD_CLASSES[idx]
            box = raw[0, 0, i, 3:7] * np.array([tW, tH, tW, tH])
            (startX, startY, endX, endY) = box.astype("int")
            # Map tile coordinates back to original image coordinates
            startX = max(0, startX + offset_x)
            startY = max(0, startY + offset_y)
            endX = min(orig_W, endX + offset_x)
            endY = min(orig_H, endY + offset_y)
            if endX > startX and endY > startY:
                results.append({
                    "class": label,
                    "confidence": confidence,
                    "box": [startX, startY, endX - startX, endY - startY]
                })
    return results


def run_opencv_detection(image, model_type, confidence_threshold=0.5, nms_threshold=0.4):
    H, W = image.shape[:2]
    detections_list = []

    if model_type == "mobilenet_ssd":
        # Load Caffe Model
        prototxt = os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.prototxt.txt')
        caffemodel = os.path.join(CAFFE_DIR, 'MobileNetSSD_deploy.caffemodel')
        
        if not os.path.exists(prototxt) or not os.path.exists(caffemodel) or is_lfs_pointer(caffemodel):
            raise FileNotFoundError("MobileNet SSD Caffe model or prototxt is missing or corrupted. Please make sure the model files are present.")
            
        net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)

        # --- Tiled detection strategy ---
        # Run on the full image + a 2x2 grid of overlapping tiles.
        # This dramatically improves recall for small/dense objects because
        # MobileNet SSD internally resizes to 300x300; tiling preserves local detail.
        all_raw = []

        # 1. Full image pass
        all_raw.extend(_run_ssd_on_tile(net, image, 0, 0, W, H, confidence_threshold))

        # 2. 2x2 overlapping tiles (50% overlap)
        tile_w = W // 2 + W // 8   # 62.5% of width per tile
        tile_h = H // 2 + H // 8
        step_x = W // 2
        step_y = H // 2
        for row in range(2):
            for col in range(2):
                x0 = min(col * step_x, W - tile_w)
                y0 = min(row * step_y, H - tile_h)
                x1 = min(x0 + tile_w, W)
                y1 = min(y0 + tile_h, H)
                tile = image[y0:y1, x0:x1]
                all_raw.extend(_run_ssd_on_tile(net, tile, x0, y0, W, H, confidence_threshold))

        # Apply NMS across all tiles to remove duplicates
        if all_raw:
            boxes_nms = [[d["box"][0], d["box"][1], d["box"][2], d["box"][3]] for d in all_raw]
            confs_nms = [d["confidence"] for d in all_raw]
            idxs = cv2.dnn.NMSBoxes(boxes_nms, confs_nms, confidence_threshold, nms_threshold)
            if len(idxs) > 0:
                for i in idxs.flatten():
                    detections_list.append(all_raw[i])

    elif model_type in ["yolov3", "yolov3_tiny"]:
        # Get paths
        cfg_name = "yolov3.cfg" if model_type == "yolov3" else "yolov3-tiny.cfg"
        weights_name = "yolov3.weights" if model_type == "yolov3" else "yolov3-tiny.weights"

        cfg_path = os.path.join(YOLO_COCO_DIR, cfg_name)
        weights_path = os.path.join(YOLO_COCO_DIR, weights_name)
        labels_path = os.path.join(YOLO_COCO_DIR, 'coco.names')

        if is_lfs_pointer(weights_path) or is_lfs_pointer(cfg_path):
            raise FileNotFoundError("YOLO weights or configs are missing or not fully downloaded.")

        labels = open(labels_path).read().strip().split("\n")
        net = cv2.dnn.readNetFromDarknet(cfg_path, weights_path)

        # Determine output layer names
        ln = net.getLayerNames()
        try:
            ln = [ln[i[0] - 1] for i in net.getUnconnectedOutLayers()]
        except:
            ln = [ln[i - 1] for i in net.getUnconnectedOutLayers()]

        # Use 608x608 for full YOLO, 416 for tiny (tiny doesn't benefit from larger input)
        # Larger input size = significantly better detection of small objects in crowded scenes
        input_size = 608 if model_type == "yolov3" else 416
        blob = cv2.dnn.blobFromImage(image, 1 / 255.0, (input_size, input_size), swapRB=True, crop=False)
        net.setInput(blob)
        layerOutputs = net.forward(ln)

        boxes = []
        confidences = []
        classIDs = []

        for output in layerOutputs:
            for detection in output:
                scores = detection[5:]
                classID = np.argmax(scores)
                confidence = scores[classID]

                if confidence > confidence_threshold:
                    box = detection[0:4] * np.array([W, H, W, H])
                    (centerX, centerY, width, height) = box.astype("int")

                    x = int(centerX - (width / 2))
                    y = int(centerY - (height / 2))

                    boxes.append([x, y, int(width), int(height)])
                    confidences.append(float(confidence))
                    classIDs.append(classID)

        # Non-maxima suppression
        idxs = cv2.dnn.NMSBoxes(boxes, confidences, confidence_threshold, nms_threshold)

        if len(idxs) > 0:
            for i in idxs.flatten():
                # Constrain box boundaries
                x, y, w, h = boxes[i]
                x = max(0, x)
                y = max(0, y)
                w = min(w, W - x)
                h = min(h, H - y)

                detections_list.append({
                    "class": labels[classIDs[i]],
                    "confidence": confidences[i],
                    "box": [x, y, w, h]
                })

    return detections_list

# Draw detections on OpenCV Image
def draw_detections(image, detections_list, model_type):
    annotated = image.copy()
    
    for det in detections_list:
        x, y, w, h = det["box"]
        label = det["class"]
        conf = det["confidence"]
        
        # Color matching
        if model_type == "mobilenet_ssd":
            idx = SSD_CLASSES.index(label) if label in SSD_CLASSES else 0
            color = [int(c) for c in SSD_COLORS[idx]]
        else:
            labels_path = os.path.join(YOLO_COCO_DIR, 'coco.names')
            labels = open(labels_path).read().strip().split("\n")
            idx = labels.index(label) if label in labels else 0
            color = [int(c) for c in YOLO_COLORS[idx]]
            
        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
        text = f"{label}: {conf:.2f}"
        
        # Draw label background box
        label_size, base_line = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        y_label = max(y, label_size[1] + 10)
        cv2.rectangle(annotated, (x, y_label - label_size[1] - 5), (x + label_size[0], y_label + base_line - 5), color, cv2.FILLED)
        
        cv2.putText(annotated, text, (x, y_label - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        
    return annotated

# Image detection endpoint
@app.route('/api/detect', methods=['POST'])
def detect_image():
    app.logger.info("[DEBUG] Received POST request on /api/detect")
    app.logger.info(f"[DEBUG] request.files keys: {list(request.files.keys())}")
    app.logger.info(f"[DEBUG] request.form: {dict(request.form)}")
    
    sample_name = request.form.get('sample_name')
    model_type = request.form.get('model', 'mobilenet_ssd')
    conf_threshold = float(request.form.get('confidence', 0.5))
    nms_threshold = float(request.form.get('threshold', 0.3))
    image = None
    
    if sample_name:
        img_path = os.path.join(WORKSPACE_DIR, 'Object dection using image', 'images', sample_name)
        if not os.path.exists(img_path):
            app.logger.info(f"[DEBUG] Rejecting request: Sample image {sample_name} not found")
            return jsonify({"error": f"Sample image {sample_name} not found"}), 400
        image = cv2.imread(img_path)
        if image is None:
            app.logger.info(f"[DEBUG] Rejecting request: Failed to read sample image {sample_name}")
            return jsonify({"error": "Failed to read sample image"}), 400
    else:
        if 'image' not in request.files:
            app.logger.info("[DEBUG] Rejecting request: 'image' not in request.files")
            return jsonify({"error": "No image file provided"}), 400
            
        file = request.files['image']
        data = file.read()
        app.logger.info(f"[DEBUG] Uploaded file: name={file.filename}, mime={file.mimetype}, size={len(data)} bytes")
        
        if len(data) == 0:
            app.logger.info("[DEBUG] Rejecting: zero-byte file received")
            return jsonify({"error": "Empty file received — the image has 0 bytes"}), 400

        image = None

        # --- Attempt 1: OpenCV native decode (fastest path for JPG/PNG) ---
        file_bytes = np.frombuffer(data, np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        # --- Attempt 2: Pillow decode (handles WebP, GIF, BMP, TIFF, etc.) ---
        if image is None:
            try:
                pil_img = PILImage.open(io.BytesIO(data))
                # GIFs: grab first frame
                pil_img.seek(0)
                # Convert to RGB then to BGR for OpenCV
                pil_img = pil_img.convert("RGB")
                image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                app.logger.info("[DEBUG] Decoded via Pillow fallback")
            except Exception as pil_err:
                app.logger.info(f"[DEBUG] Pillow decode also failed: {pil_err}")

        if image is None:
            app.logger.info("[DEBUG] Both decoders failed — unsupported or corrupted image")
            return jsonify({"error": "Unsupported or corrupted image. Please upload a JPG, PNG, WebP, or GIF."}), 400
        
    try:
        start_time = time.time()
        detections = run_opencv_detection(image, model_type, conf_threshold, nms_threshold)
        latency = time.time() - start_time
        
        # Ensure all coordinates are native Python int types (not numpy.int32)
        serializable_detections = []
        for det in detections:
            serializable_detections.append({
                "class": det["class"],
                "confidence": float(det["confidence"]),
                "box": [int(det["box"][0]), int(det["box"][1]), int(det["box"][2]), int(det["box"][3])]
            })
        
        # Draw bounding boxes for static image output
        annotated_image = draw_detections(image, serializable_detections, model_type)
        _, buffer = cv2.imencode('.jpg', annotated_image)
        base64_image = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "success": True,
            "detections": serializable_detections,
            "latency_ms": round(latency * 1000, 2),
            "annotated_image": f"data:image/jpeg;base64,{base64_image}"
        })
    except Exception as e:
        app.logger.error(f"[DEBUG] Exception during detection: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Video processing worker thread
def process_video_task(task_id, input_path, output_filename, model_type, conf_threshold, nms_threshold):
    global video_tasks
    video_tasks[task_id] = {"progress": 0, "status": "processing", "error": None}

    # Change cwd to workspace so OpenCV finds the openh264 DLL for H.264 encoding
    original_cwd = os.getcwd()
    os.chdir(WORKSPACE_DIR)

    writer = None
    vs = None
    try:
        vs = cv2.VideoCapture(input_path)
        total_frames = int(vs.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = vs.get(cv2.CAP_PROP_FPS) or 30

        W = int(vs.get(cv2.CAP_PROP_FRAME_WIDTH))
        H = int(vs.get(cv2.CAP_PROP_FRAME_HEIGHT))

        output_path = os.path.join(PROCESSED_DIR, output_filename)

        # Try H.264 (avc1) first — required for browser playback.
        # openh264-1.8.0-win64.dll must be in WORKSPACE_DIR (already downloaded).
        codec_used = "avc1"
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (W, H), True)

        if not writer.isOpened():
            # Fallback: mp4v (plays in some players but not all browsers)
            app.logger.warning("[VIDEO] avc1/H.264 unavailable, falling back to mp4v")
            writer.release()
            codec_used = "mp4v"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(output_path, fourcc, fps, (W, H), True)

        app.logger.info(f"[VIDEO] Writing with codec: {codec_used}")
        
        frame_idx = 0

        while True:
            grabbed, frame = vs.read()
            if not grabbed:
                break

            # Perform object detection on this frame
            detections = run_opencv_detection(frame, model_type, conf_threshold, nms_threshold)

            # Draw detections
            annotated_frame = draw_detections(frame, detections, model_type)
            writer.write(annotated_frame)

            frame_idx += 1
            if total_frames > 0:
                progress = round((frame_idx / total_frames) * 100, 1)
                video_tasks[task_id]["progress"] = progress

        writer.release()
        vs.release()
        os.chdir(original_cwd)

        video_tasks[task_id]["status"] = "success"
        video_tasks[task_id]["progress"] = 100
        video_tasks[task_id]["video_url"] = f"/api/video/{output_filename}"
        video_tasks[task_id]["codec"] = codec_used

    except Exception as e:
        video_tasks[task_id]["status"] = "error"
        video_tasks[task_id]["error"] = str(e)
        if writer is not None:
            writer.release()
        if vs is not None:
            vs.release()
        os.chdir(original_cwd)

# Video upload and process endpoint
@app.route('/api/process-video', methods=['POST'])
def process_video():
    file = None
    input_path = None
    
    # Check if a custom file is uploaded or a sample is selected
    sample_name = request.form.get('sample_name')
    if sample_name:
        input_path = os.path.join(WORKSPACE_DIR, 'Object detection using video', 'videos', sample_name)
        if not os.path.exists(input_path):
            return jsonify({"error": f"Sample video {sample_name} not found"}), 400
    else:
        if 'video' not in request.files:
            return jsonify({"error": "No video file provided"}), 400
        file = request.files['video']
        filename = f"{uuid.uuid4()}_{file.filename}"
        input_path = os.path.join(UPLOAD_DIR, filename)
        file.save(input_path)
        
    model_type = request.form.get('model', 'mobilenet_ssd')
    conf_threshold = float(request.form.get('confidence', 0.5))
    nms_threshold = float(request.form.get('threshold', 0.3))
    
    task_id = str(uuid.uuid4())
    output_filename = f"processed_{task_id}.mp4"
    
    thread = threading.Thread(target=process_video_task, args=(task_id, input_path, output_filename, model_type, conf_threshold, nms_threshold))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        "success": True,
        "task_id": task_id,
        "status": "processing"
    })

# Check video processing progress
@app.route('/api/video-progress/<task_id>', methods=['GET'])
def get_video_progress(task_id):
    if task_id not in video_tasks:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(video_tasks[task_id])

# Serve processed video file
@app.route('/api/video/<filename>', methods=['GET'])
def serve_processed_video(filename):
    return send_from_directory(PROCESSED_DIR, filename)

# Expose sample images and videos
@app.route('/api/samples/images', methods=['GET'])
def get_sample_images():
    img_dir = os.path.join(WORKSPACE_DIR, 'Object dection using image', 'images')
    images = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    return jsonify({"images": images})

@app.route('/api/samples/images/<filename>', methods=['GET'])
def serve_sample_image(filename):
    img_dir = os.path.join(WORKSPACE_DIR, 'Object dection using image', 'images')
    return send_from_directory(img_dir, filename)

@app.route('/api/samples/videos', methods=['GET'])
def get_sample_videos():
    vid_dir = os.path.join(WORKSPACE_DIR, 'Object detection using video', 'videos')
    videos = [f for f in os.listdir(vid_dir) if f.lower().endswith(('.mp4', '.avi', '.mov'))]
    return jsonify({"videos": videos})

@app.route('/api/samples/videos/<filename>', methods=['GET'])
def serve_sample_video(filename):
    vid_dir = os.path.join(WORKSPACE_DIR, 'Object detection using video', 'videos')
    return send_from_directory(vid_dir, filename)

# Run server
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    print(f"[INFO] Starting Flask backend on http://0.0.0.0:{port}  (debug={debug})")
    app.run(host='0.0.0.0', port=port, debug=debug)

