import json
import base64
from io import BytesIO
from PIL import Image
from ultralytics import YOLO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

# Load the model globally
model = YOLO("yolov8n.pt")

class Data(BaseModel):
    images: List[str] | None = None
    path_list: List[str] | None = None

def process_bytes_image(image_data: str) -> Image.Image:
    image_data = image_data.split(',')[1]  # Remove the "data:image/png;base64," part
    return Image.open(BytesIO(base64.b64decode(image_data)))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}


@app.post("/detect")
async def detect_persons(data: Data) -> dict[str, int]:
    results_dict = {}

    try:

        if data.path_list:
            images = [Image.open(path) for path in data.path_list]
        else:
            images = [process_bytes_image(image_data) for image_data in data.images]

        # Decode base64 images
        # images = []
        # for image_data in data.images:
        #     image_data = image_data.split(',')[1]  # Remove the "data:image/png;base64," part
        #     image = Image.open(BytesIO(base64.b64decode(image_data)))
        #     images.append(image)
        
        # Run detection on all images at once
        results = model(images, conf=0.5)

        # Count persons for each image
        for i, result in enumerate(results):
            person_count = sum(1 for detection in result.boxes if model.names[int(detection.cls)] == 'person')
            results_dict[f"camera_{i}"] = person_count

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing images: {str(e)}")

    return results_dict

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

