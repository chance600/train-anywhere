
import {
    PoseLandmarker,
    FilesetResolver,
    PoseLandmarkerResult
} from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { VisionData } from '../types/vision';

// Configuration
const POSE_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

class VisionService {
    private poseLandmarker: PoseLandmarker | null = null;
    private objectDetector: cocoSsd.ObjectDetection | null = null;
    private isInitializing = false;
    private isInitialized = false;

    // Singleton Instance
    private static instance: VisionService;

    private constructor() { }

    public static getInstance(): VisionService {
        if (!VisionService.instance) {
            VisionService.instance = new VisionService();
        }
        return VisionService.instance;
    }

    public async initialize(loadHeavyModels: boolean = false): Promise<void> {
        if (this.isInitialized || this.isInitializing) return;
        this.isInitializing = true;

        try {
            console.log('👁️ VisionService: Initializing...');

            // 1. Load MediaPipe Pose (Lightweight)
            const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: POSE_MODEL_PATH,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });
            console.log('✅ VisionService: Pose Model Loaded');

            // 2. Load Object Detection (Pro Feature / Heavy)
            // Only load if explicitly requested (Feature Gating)
            if (loadHeavyModels) {
                console.log('🏋️ VisionService: Loading Object Detector...');
                await tf.setBackend('webgl');
                await tf.ready();
                this.objectDetector = await cocoSsd.load({
                    base: 'lite_mobilenet_v2' // Faster than mobilenet_v1
                });
                console.log('✅ VisionService: Object Detector Loaded');
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('❌ VisionService Initialization Failed:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    public async detect(video: HTMLVideoElement, timestamp: number, useObjectDetection: boolean = false): Promise<VisionData> {
        if (!this.isInitialized || !this.poseLandmarker) {
            return { pose: null, objects: [], timestamp };
        }

        // 1. Pose Detection
        let poseResult: PoseLandmarkerResult | null = null;
        try {
            poseResult = this.poseLandmarker.detectForVideo(video, timestamp);
        } catch (e) {
            console.warn("Pose detect error", e);
        }

        // 2. Object Detection (Throttled or Gated)
        let objects: cocoSsd.DetectedObject[] = [];
        if (this.objectDetector && useObjectDetection) {
            // NOTE: Object detection is heavy. In a real loop, we might run this every N frames.
            // For now, we assume the caller handles throttling or we are on a powerful device.
            // We might add internal throttling here later.
            try {
                objects = await this.objectDetector.detect(video);
            } catch (e) {
                console.warn("Object detect error", e);
            }
        }

        return {
            pose: poseResult,
            objects,
            timestamp
        };
    }

    public getIsInitialized(): boolean {
        return this.isInitialized;
    }
}

export const visionService = VisionService.getInstance();
