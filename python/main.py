import json
import base64
from io import BytesIO
from PIL import Image, ImageDraw
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Load the model globally
model = YOLO("yolov8n.pt")

class Data(BaseModel):
    images: Optional[List[str]] = None
    path_list: Optional[List[str]] = None

def process_bytes_image(image_data: str) -> Image.Image:
    image_data = image_data.split(',')[1]  # Remove the "data:image/png;base64," part
    return Image.open(BytesIO(base64.b64decode(image_data)))

def draw_boxes(image: Image.Image, result) -> Image.Image:
    draw = ImageDraw.Draw(image)
    for box in result.boxes:
        if model.names[int(box.cls)] == 'person':
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            draw.rectangle([x1, y1, x2, y2], outline="red", width=2)
    return image

def image_to_base64(image: Image.Image) -> str:
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

@app.options("/detect")
async def options_detect():
    return {"message": "OK"}

@app.post("/detect")
async def detect_persons(data: Data) -> dict:
    results_dict = {}
    processed_images = []

    try:

        if data.path_list:
            images = [Image.open(path) for path in data.path_list]
        elif data.images:
            images = [process_bytes_image(image_data) for image_data in data.images]
        else:
            raise HTTPException(status_code=400, detail="Either 'images' or 'path_list' must be provided")

        # Run detection on all images at once
        results = model(images, conf=0.5)

        # Count persons for each image and draw boxes
        for i, (image, result) in enumerate(zip(images, results)):
            person_count = sum(1 for detection in result.boxes if model.names[int(detection.cls)] == 'person')
            results_dict[f"camera_{i}"] = person_count
            
            # Draw bounding boxes
            image_with_boxes = draw_boxes(image, result)
            
            # Convert image to base64
            processed_images.append(image_to_base64(image_with_boxes))

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing images: {str(e)}")

    return {
        "results": results_dict,
        "processed_images": processed_images
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

