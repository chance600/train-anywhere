
# 🧬 TrainAnywhere Evolution Prompt
**Copy and paste this ENTIRE document into a new chat to resume work.**

---

I am the **Senior Lead Engineer** handing off the **TrainAnywhere** project to you.
This is a high-stakes, "Premium Aesthetics" PWA fitness application.
**Your Mission**: Implement "Rich AR Skins" (Superhero/Princess overlays) using MediaPipe, while maintaining the robust community features we just shipped.

## � System Architecture
-   **App**: React 19 + Vite + TypeScript. PWA (Service Worker installed).
-   **Backend**: Supabase (`zrtambthzaxfapeeplwc`). Auth, Database, Storage, Edge Functions.
-   **Hosting**: Vercel (`https://train-anywhere.vercel.app`).
-   **Styling**: TailwindCSS. *Constraint*: Must be "Premium", "Glassmorphism", "Vibrant". No basic designs.

## ✅ State of the Union (Completed Features)
1.  **Community Engine**:
    -   **Challenges**: `Squattober`, `Push Up Pro` are LIVE.
    -   **Seeding**: `seed-community` Edge Function populates data. *Note: We assign challenges to the first Admin user, NOT dummy users.*
    -   **Visibility**: RLS policies are **FIXED** (Removed "infinite recursion" bug). Public challenges are visible to ALL authenticated users.
    -   **Feed**: Activity, Friend Requests, and Challenge Joins are tracked.
2.  **Camera Workout**:
    -   **AI Rep Counting**: Gemini Flash 1.5 (Multimodal) via Edge Functions.
    -   **Party Mode (Level 1)**: Simple CSS filters (Neon/Fire). Burst particles on reps.
    -   **Resilience**: Mirror Mode logic is handled via CSS `transform: scaleX(-1)`. Mic permission denial GRACEFULLY falls back to video-only.

## 🚧 Critical "Gotchas" & Developer Notes
1.  **RLS Policies**: Do NOT re-introduce recursive RLS checks between `challenges` and `challenge_participants`. Keep the `challenges` policy simple: `is_public OR is_creator`.
2.  **Date Filtering**: We removed the strict `gte(end_date)` filter in `ChallengeList.tsx` because it was flaky with timezones. Trust the RLS and simple ordering.
3.  **Deployment**:
    -   Supabase CLI is authenticated locally.
    -   **MISSING**: `VITE_VAPID_PUBLIC_KEY` and private keys are NOT in the Vercel Production Environment yet. Push notifications work locally but fail in prod until user adds keys.
4.  **CLI Auth**: If you need to verify visibility, use `node scripts/debug_challenges.js`.

## 🎯 Phase 11: Rich AR Skins (The Next Big Thing)
**Context**: The user wants "Fun Mode" to be truly immersive. CSS filters are not enough. We need **Face/Body Tracking Anchors**.

### 🛠️ Implementation Strategy (MediaPipe)
1.  **Library**: Install `@mediapipe/tasks-vision`. using `npm install`.
2.  **Load Model**:
    -   Download the `face_landmarker.task` bundle (or `pose_landmarker`).
    -   Initialize it in `components/CameraWorkout.tsx` inside a `useEffect`.
3.  **The Loop**:
    -   In `analyzeFrame` (or separate loop), send the video frame to MediaPipe.
    -   Get `faceLandmarks` (for Masks/Crowns) or `poseLandmarks` (for Iron Man Chest/Hand repulsor rays).
4.  **Rendering**:
    -   Use a `<canvas>` overlay on top of the `<video>`.
    -   Draw SVGs/Images at the landmark coordinates (e.g., `noseTip` for mask center, `forehead` for crown).
    -   **Performance**: Ensure we don't drop below 30FPS. Throttle detection if needed (only detect every 2nd frame, interpolate rendering).

### 🎨 Asset Ideas (To Generate or Find)
-   **Iron Man HUD**: SVGs reacting to gaze.
-   **Princess Crown**: Sits on forehead landmarks.
-   **Superstar Aura**: Particles emitting from body outline.

## 🏋️‍♀️ Phase 12: Unified Vision (Synergy)
**Context**: "Party Mode" and "Vision Tracking" must work together.
-   **Goal**: Single **Perception Layer** feeding both Fun (Skins) and Analytics (Data).
-   **Architecture (The Unified Pipeline)**:
    1.  **Input**: Single Camera Stream.
    2.  **Perception**: MediaPipe (Pose) + TFJS (Object) runs *once* per frame.
    3.  **Data Bus**: Emits `{ pose, object, velocity, rom_score }`.
    4.  **Consumer A (Analytics)**: "Silent Tracking" in background (Web Worker). Logs weight/reps even if overlay is off.
    5.  **Consumer B (Skins)**: Renders overlays (Crowns, HUDs) *reactive* to the Data Bus.
-   **Technical Strategy**:
    -   **MediaPipe**: For Pose/Face.
    -   **TFJS/YOLO**: For Object Detection (Dumbbells/Plates).
    -   **Constraint**: Vision Tracking must NOT break the existing Gemini Rep Counter.

### 🚦 Step 0: Day 1 Gameplay
1.  **Install**: `npm install @mediapipe/tasks-vision @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl`.
2.  **Scaffold**: Create `services/VisionService.ts` to encapsulate the model loaders.

---

## 🚀 System Boot Protocol
**IMMEDIATE ACTION REQUIRED upon starting the new session:**

1.  **Context Loading**:
    -   Read `package.json` to confirm no AR libs are installed yet.
    -   Read `components/CameraWorkout.tsx` to understand the current `requestAnimationFrame` loop.
    -   Read `services/geminiService.ts` to see how we handle AI state.
2.  **Verification**:
    -   Run `node scripts/debug_challenges.js` to verify your database connection is active.
3.  **Architecture**:
    -   Draft the interface for `VisionService.ts` before writing code.
    -   Ensure it supports the **Unified Pipeline** (Pose + Object data streaming).
4.  **Execution**:
    -   Start with **Step 0** (Install & Scaffold).
