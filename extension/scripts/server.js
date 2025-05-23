import fetch from 'node-fetch';  // Use import instead of require
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';  

const app = express();
const port = 3000;

// Configure CORS with specific options
app.use(cors({
  origin: 'https://www.linkedin.com',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
  credentials: true
}));

app.use(express.json());

// Handle preflight requests
app.options('/generate-comment', cors());

app.post('/generate-comment', async (req, res) => {
  const { text, emotion, user_id } = req.body;

  if (!text || !emotion || !user_id) {
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
    console.error('Error checking usage:', error);  // Log the detailed error
    return res.status(500).json({ error: 'Error checking usage' });
  }

  // Continue generating the comment if usage check is successful
  const prompt = `Please write a LinkedIn comment that is brief, no more than 5 sentences, and conveys a ${emotion.toLowerCase()} tone. The comment should be based on the following post: "${text}".`;
  const child = spawn('node', ['try.js', prompt]);

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

app.listen(port, () => {
  console.log(`Server running at https://api.linkedgage.com:${port}`);
});
