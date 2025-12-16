
import { DetectedObject } from '@tensorflow-models/coco-ssd';
import { Point } from './exerciseLogic';
import { VisionData } from '../types/vision';

// --- Constants ---
const GRAVITY = 9.81; // m/s^2
const SMOOTHING_FACTOR = 0.3; // Exponential smoothing (0-1)
const DEFAULT_PIXELS_TO_METERS = 0.0025; // Rough heuristic (1px = 2.5mm)

// --- Types ---
export interface TrackerState {
    lastPosition: { x: number, y: number } | null;
    lastTimestamp: number;
    velocitySmooth: number;
}

// --- Velocity Calculator ---
export class VelocityCalculator {
    private state: TrackerState = {
        lastPosition: null,
        lastTimestamp: 0,
        velocitySmooth: 0
    };

    private pixelScale: number = DEFAULT_PIXELS_TO_METERS;

    constructor(customScale?: number) {
        if (customScale) this.pixelScale = customScale;
    }

    public setScale(scale: number) {
        this.pixelScale = scale;
    }

    public calculate(
        currentPos: { x: number, y: number },
        timestamp: number
    ): { velocity: number, isExplosive: boolean, power: number, vector: [number, number] } {

        // 1. First Frame Check
        if (!this.state.lastPosition || this.state.lastTimestamp === 0) {
            this.state.lastPosition = currentPos;
            this.state.lastTimestamp = timestamp;
            return { velocity: 0, isExplosive: false, power: 0, vector: [0, 0] };
        }

        // 2. Delta Time (Seconds)
        const dt = (timestamp - this.state.lastTimestamp) / 1000;
        if (dt <= 0 || dt > 1.0) {
            // Reset if jump is too large (lag spike) or zero
            this.state.lastPosition = currentPos;
            this.state.lastTimestamp = timestamp;
            return { velocity: 0, isExplosive: false, power: 0, vector: [0, 0] };
        }

        // 3. Delta Distance (Pixels)
        const dx = currentPos.x - this.state.lastPosition.x;
        const dy = currentPos.y - this.state.lastPosition.y; // Corrected: +Y is down in generic canvas, but we usually track magnitude
        const distancePx = Math.sqrt(dx * dx + dy * dy);

        // 4. Velocity (Meters / Second)
        const rawVelocity = (distancePx * this.pixelScale) / dt;

        // 5. Smoothing (Low pass filter)
        const smoothedVelocity =
            (rawVelocity * SMOOTHING_FACTOR) +
            (this.state.velocitySmooth * (1 - SMOOTHING_FACTOR));

        // 6. Update State
        this.state.lastPosition = currentPos;
        this.state.lastTimestamp = timestamp;
        this.state.velocitySmooth = smoothedVelocity;

        return {
            velocity: smoothedVelocity,
            isExplosive: smoothedVelocity > 1.0, // > 1 m/s is typically explosive
            power: 0, // Placeholder, calculated externally with Mass
            vector: [dx / dt, dy / dt] // Vector in pixels/sec
        };
    }

    public reset() {
        this.state = { lastPosition: null, lastTimestamp: 0, velocitySmooth: 0 };
    }
}

// --- Smart Weight Detection ---
export const detectWeight = (
    objects: DetectedObject[],
    leftWrist: Point | undefined,
    rightWrist: Point | undefined,
    canvasWidth: number,
    canvasHeight: number
): { isWeighted: boolean, objectName?: string } => {

    // 1. Filter for Dumbbells/Weights
    // CocoSSD classes: 'bottle', 'cup' often proxy for dumbbells in testing. 
    // Real dumbbells might be classified as 'sports ball', 'bottle', or 'remote'.
    // We accept generic objects for now or strictly 'dumbbell' if custom model.
    const relevantObjects = objects.filter(obj =>
        ['bottle', 'cup', 'sports ball', 'dumbbell', 'cell phone'].includes(obj.class)
    );

    if (relevantObjects.length === 0 || (!leftWrist && !rightWrist)) {
        return { isWeighted: false };
    }

    // 2. Proximity Check (Heuristic)
    // Distance Threshold: 10% of screen width (approx 50-100px)
    const CONNECTION_THRESHOLD = canvasWidth * 0.15;

    let connected = false;
    let detectedName = '';

    relevantObjects.forEach(obj => {
        const [x, y, w, h] = obj.bbox;
        const cx = x + w / 2;
        const cy = y + h / 2;

        // Check Left Wrist
        if (leftWrist) {
            // Wrist coords are 0-1 normalized, convert to px
            const wx = leftWrist.x * canvasWidth;
            const wy = leftWrist.y * canvasHeight;
            const dist = Math.sqrt(Math.pow(cx - wx, 2) + Math.pow(cy - wy, 2));
            if (dist < CONNECTION_THRESHOLD) {
                connected = true;
                detectedName = obj.class;
            }
        }

        // Check Right Wrist
        if (rightWrist) {
            const wx = rightWrist.x * canvasWidth;
            const wy = rightWrist.y * canvasHeight;
            const dist = Math.sqrt(Math.pow(cx - wx, 2) + Math.pow(cy - wy, 2));
            if (dist < CONNECTION_THRESHOLD) {
                connected = true;
                detectedName = obj.class;
            }
        }
    });

    return { isWeighted: connected, objectName: detectedName };
};
