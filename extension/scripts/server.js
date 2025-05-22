import fetch from 'node-fetch';  // Use import instead of require
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';  

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/generate-comment', async (req, res) => {
  const { text, emotion, user_id } = req.body;

  if (!text || !emotion || !user_id) {
    res.status(400).send('Missing postText, emotion, or user ID');
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
      return res.status(429).send(usageResult.error);
    }
    
  } catch (error) {
    console.error('Error checking usage:', error);  // Log the detailed error
    return res.status(500).send('Error checking usage');
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
      res.status(500).send(errorOutput);
      return;
    }

    // Log the generated comment into the database
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

    res.send(response.trim());
  });
});

app.listen(port, () => {
  console.log(`Server running at https://api.linkedgage.com:${port}`);
});
