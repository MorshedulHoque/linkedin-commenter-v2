import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { GoogleGenerativeAI } from "@google/generative-ai";

const prompt = process.argv[2];  // Command-line argument

async function run() {
  if (!prompt) {
    console.error('No prompt provided');
    return;
  }

  // Ensure the API_KEY is available
  if (!process.env.API_KEY) {
    console.error('API_KEY is not set.');
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.7  // Temperature is set to adjust creativity
    },
  });

  try {
    const result = await model.generateContent(prompt);

    if (result && result.response) {
      const responseText = result.response.text;
      if (typeof responseText === 'function') {
        let fullResponse = responseText().trim();

        // Strip leading and trailing quotation marks if present
        if (fullResponse.startsWith('"') && fullResponse.endsWith('"')) {
          fullResponse = fullResponse.slice(1, -1);
        }

        console.log(fullResponse);
      } else {
        throw new Error('Invalid response format: response.text is not a function.');
      }
    } else {
      throw new Error('Invalid or empty response from the model.');
    }
  } catch (error) {
    console.error('Error generating content:', error.message);
  }
}

run();
