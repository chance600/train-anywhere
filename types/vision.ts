import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { DetectedObject } from '@tensorflow-models/coco-ssd';

export interface VisionData {
    pose: PoseLandmarkerResult | null;
    objects: DetectedObject[];
    velocity?: VelocityMetrics;
    timestamp: number;
}

export interface VelocityMetrics {
    vector: [number, number]; // [vx, vy] in pixels/sec (or normalized meters/sec)
    magnitude: number;
    isExplosive: boolean;
    powerWatts?: number;
}

export interface VisionState {
    isWeighted: boolean;
    weightId?: string; // e.g. 'dumbbell', 'human'
    calibrationFactor: number; // pixels to meters ratio
}
