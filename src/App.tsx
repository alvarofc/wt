import { useState, useEffect, useRef } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { tempDir } from '@tauri-apps/api/path';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';;
import './App.css';

import { join } from '@tauri-apps/api/path';

function App() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState(3); // New state for interval
  const [isCapturing, setIsCapturing] = useState(false); // New state for start/stop
  const [detectionResults, setDetectionResults] = useState<Record<string, number>>({});
  const [processedImages, setProcessedImages] = useState<string[]>([]);
  const videoRefs = useRef<HTMLVideoElement[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function getDevices() {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceInfos.filter(device => device.kind === "videoinput");
        setDevices(videoDevices);
      } catch (error) {
        console.error("Error fetching devices: ", error);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    async function startStreams() {
      for (let i = 0; i < selectedDeviceIds.length; i++) {
        const deviceId = selectedDeviceIds[i];
        if (videoRefs.current[i]) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId }
            });
            videoRefs.current[i].srcObject = stream;
          } catch (error) {
            console.error(`Error accessing camera ${deviceId}: `, error);
          }
        }
      }
    }
    if (selectedDeviceIds.length > 0) {
      startStreams();
    }
  }, [selectedDeviceIds]);

  useEffect(() => {
    if (!isCapturing) return;

    const intervalId = setInterval(async () => {
      let images: string[] = [];
      selectedDeviceIds.forEach((_, index) => {
        const video = videoRefs.current[index];
        if (video && canvasRef.current) {
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL("image/png");
            images.push(frame);
          }
        }
      });

      try {
        const response = await fetch('http://localhost:8000/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ images: images }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const results = data.results;
        const processedImages = data.processed_images;

        const newDetectionResults: Record<string, number> = {};
        selectedDeviceIds.forEach((deviceId, index) => {
          newDetectionResults[deviceId] = results[`camera_${index}`] || 0;
        });
        setDetectionResults(newDetectionResults);

        // Update state with processed images
        setProcessedImages(processedImages);

      } catch (error) {
        console.error("Error running detection:", error);
      }
    }, intervalSeconds * 1000);

    return () => clearInterval(intervalId);
  }, [selectedDeviceIds, intervalSeconds, isCapturing]);

  const handleDeviceSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    if (selectedOptions.includes("")) {
      // If "Deselect All" option is selected, clear all selections
      setSelectedDeviceIds([]);
      event.target.value = "";
    } else {
      setSelectedDeviceIds(selectedOptions);
    }
  };

  const handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIntervalSeconds(Number(event.target.value));
  };

  const handleStartStop = () => {
    setIsCapturing(!isCapturing);
  };

  return (
    <div className="app-container">
      {isSidebarOpen && (
        <div className="sidebar">
          <h2>Sidebar</h2>
          <p>Additional content can go here.</p>
        </div>
      )}
      <div className="main-content">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        </button>
        <h1>My Tauri App</h1>
        <div>
          <label htmlFor="cameraSelect">Select Cameras: </label>
          <select
            id="cameraSelect"
            multiple
            onChange={handleDeviceSelection}
            value={selectedDeviceIds}
          >
            <option value="">Deselect All</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="intervalInput">Interval (seconds): </label>
          <input
            id="intervalInput"
            type="number"
            min="1"
            value={intervalSeconds}
            onChange={handleIntervalChange}
          />
        </div>
        <button 
          onClick={handleStartStop}
          disabled={selectedDeviceIds.length === 0}
        >
          {isCapturing ? "Stop" : "Start"}
        </button>
        <div className="video-container">
          {selectedDeviceIds.map((deviceId, index) => (
            <div key={deviceId} className="video-wrapper">
              <h2>{devices.find(device => device.deviceId === deviceId)?.label || `Camera ${deviceId}`}</h2>
              <video
                ref={el => {
                  if (el) {
                    videoRefs.current[index] = el;
                  }
                }}
                autoPlay
                className="video"
              />
              <p>Persons detected: {detectionResults[deviceId] || 0}</p>
              {processedImages.map((image, index) => (
                <img key={index} src={`data:image/png;base64,${image}`} alt={`Processed image ${index}`} />
              ))}
            </div>
          ))}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

export default App;

