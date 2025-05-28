import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';  
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS with specific options
const corsOptions = {
  origin: 'https://www.linkedin.com',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware with options
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/generate-comment', cors(corsOptions), async (req, res) => {
  //console.log('Received request:', req.body);
  const { text, emotion, user_id } = req.body;

  if (!text || !emotion || !user_id) {
    //console.log('Missing required fields:', { text: !!text, emotion: !!emotion, user_id: !!user_id });
    res.status(400).json({ error: 'Missing postText, emotion, or user ID' });
    return;
  }

  // Check usage limit by calling the Flask API
  try {
    const usageResponse = await fetch('https://dashboard.linkedgage.com/check_usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ user_id })
    });

    const usageResult = await usageResponse.json();

    if (usageResponse.status === 429) {
      return res.status(429).json({ error: usageResult.error });
    }
    
  } catch (error) {
    console.error('Error checking usage:', error);
    return res.status(500).json({ error: 'Error checking usage' });
  }

  // Continue generating the comment if usage check is successful
  const prompt = `Please write a LinkedIn comment that is brief, no more than 5 sentences, and conveys a ${emotion.toLowerCase()} tone. The comment should be based on the following post: "${text}".`;
  
  // Use absolute path for try.js
  const tryJsPath = path.join('/var/www/linkedin-commenter-v2/extension/scripts', 'try.js');
  //console.log('Using try.js at:', tryJsPath);
  
  const child = spawn('node', [tryJsPath, prompt]);

  let response = '';
  let errorOutput = '';

  child.stdout.on('data', (data) => {
    response += data.toString();
  });

  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  child.on('close', async (code) => {
    if (code !== 0) {
      console.error(`try.js process exited with code ${code}`);
      console.error(errorOutput);
      res.status(500).json({ error: errorOutput });
      return;
    }

    // Log the generated comment into the database
    try {
      await fetch('https://dashboard.linkedgage.com/log_comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        user_id: user_id,
        post_text: text,
        generated_comment: response.trim(),
        emotion: emotion
      })
    });
    } catch (error) {
      console.error('Error logging comment:', error);
      // Continue even if logging fails
    }

    res.json({ comment: response.trim() });
  });
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at: http://localhost:${port}/health`);
  console.log('Server directory:', '/var/www/linkedin-commenter-v2/extension/scripts');
});
