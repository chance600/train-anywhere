
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';
import * as path from 'path';

// Manual Env Parser
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envConfig: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envConfig[key.trim()] = value.trim();
    }
});

const API_KEY = envConfig['VITE_GEMINI_API_KEY'];

if (!API_KEY) {
    console.error("❌ No VITE_GEMINI_API_KEY found in .env.local");
    process.exit(1);
}

const MODEL_NAME = "gemini-2.5-flash";
const IMAGE_PATH = "/Users/alec/.gemini/antigravity/brain/c178bf7c-ca71-432a-87c6-f8e725cbf8c3/uploaded_image_1765673607522.jpg";

async function runTest() {
    console.log(`🚀 Starting Test...`);
    console.log(`🔑 Key: ${API_KEY.substring(0, 10)}...`);
    console.log(`🤖 Model: ${MODEL_NAME}`);
    console.log(`🖼️  Image: ${IMAGE_PATH}`);

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const imageBuffer = fs.readFileSync(IMAGE_PATH);
        const base64Image = imageBuffer.toString('base64');

        const prompt = "Analyze this workout log. Extract exercises, sets, and reps as JSON.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log("\n✅ SUCCESS! AI Output:\n");
        console.log(text);

    } catch (error: any) {
        console.error("\n❌ FAILED:", error.message);
        if (error.response) {
            console.error("Error Details:", JSON.stringify(error.response, null, 2));
        }
    }
}

runTest();
