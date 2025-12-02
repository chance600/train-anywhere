import { Results } from '@mediapipe/pose';

export interface Point {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ExerciseConfig {
  name: string;
  calculateProgress: (landmarks: Point[]) => number;
  checkForm?: (landmarks: Point[]) => string | null;
  thresholds: {
    start: number;
    middle: number; // The "rep complete" point (e.g., bottom of squat)
    end: number;    // Return to start
  };
  instruction: string;
}

// Helper to calculate angle between three points (A, B, C) where B is the vertex
export const calculateAngle = (a: Point, b: Point, c: Point): number => {
  if (!a || !b || !c) return 0;

  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
};

export const EXERCISE_CATALOG: Record<string, ExerciseConfig> = {
  'Squats': {
    name: 'Squats',
    instruction: "Stand with feet shoulder-width apart. Lower your hips back and down.",
    calculateProgress: (landmarks: Point[]) => {
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];
      return calculateAngle(hip, knee, ankle);
    },
    checkForm: (landmarks: Point[]) => {
      // Check for knees caving in (valgus)
      // Simple heuristic: if knee x is inside hip x significantly
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];

      if (leftHip && rightHip && leftKnee && rightKnee) {
        const hipWidth = Math.abs(leftHip.x - rightHip.x);
        const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
        if (kneeWidth < hipWidth * 0.8) {
          return "Keep your knees out!";
        }
      }
      return null;
    },
    thresholds: {
      start: 160, // Standing straight
      middle: 90, // Squat depth (knees at 90 degrees)
      end: 150    // Return to standing
    }
  },
  'Pushups': {
    name: 'Pushups',
    instruction: "Start in a plank position. Lower your chest to the floor.",
    calculateProgress: (landmarks: Point[]) => {
      const shoulder = landmarks[11];
      const elbow = landmarks[13];
      const wrist = landmarks[15];
      return calculateAngle(shoulder, elbow, wrist);
    },
    checkForm: (landmarks: Point[]) => {
      // Check for sagging hips
      const shoulder = landmarks[11];
      const hip = landmarks[23];
      const ankle = landmarks[27];
      const bodyAngle = calculateAngle(shoulder, hip, ankle);
      if (bodyAngle < 160) {
        return "Keep your back straight!";
      }
      return null;
    },
    thresholds: {
      start: 160, // Arms extended
      middle: 80, // Chest down (elbows bent)
      end: 150    // Return to plank
    }
  },
  'Bicep Curls': {
    name: 'Bicep Curls',
    instruction: "Hold weights with palms facing forward. Curl towards shoulders.",
    calculateProgress: (landmarks: Point[]) => {
      // Shoulder (11/12), Elbow (13/14), Wrist (15/16)
      const shoulder = landmarks[11];
      const elbow = landmarks[13];
      const wrist = landmarks[15];
      return calculateAngle(shoulder, elbow, wrist);
    },
    thresholds: {
      start: 160, // Arms extended
      middle: 45, // Curled up
      end: 150    // Return
    }
  }
};
