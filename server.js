import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'https://hasanhashmi1.github.io', 
    'http://localhost:5173' 
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

if (!process.env.GROQ_API_KEY) {
  console.error('ERROR: GROQ_API_KEY is not defined in environment variables');
  process.exit(1);
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/summarize', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Invalid request format',
        details: 'Request body must be a JSON object'
      });
    }

    const { transcript, customPrompt } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Transcript is required',
        details: 'Please provide a valid transcript string'
      });
    }

    if (transcript.length > 50000) {
      return res.status(400).json({
        error: 'Transcript too long',
        details: 'Maximum transcript length is 50,000 characters'
      });
    }

    const { text: summary } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: `
        You are an expert meeting assistant that provides professional summaries.
        Follow these guidelines:
        1. Identify key decisions and action items
        2. Highlight important discussion points
        3. Maintain neutral, professional tone
        4. Structure output clearly with headings if needed
        5. ${customPrompt || 'Provide a comprehensive summary'}
      `,
      prompt: `Meeting Transcript:\n\n${transcript}`,
      maxTokens: 1500,
      temperature: 0.2 // Lower temperature for more factual outputs
    });

    res.json({
      success: true,
      summary,
      model: 'llama-3.3-70b-versatile',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Summarization Error:', error);

    let statusCode = 500;
    let errorMessage = 'Failed to generate summary';
    let errorDetails = error.message;

    if (error.message.includes('API key')) {
      statusCode = 401;
      errorMessage = 'Authentication failed';
    } else if (error.message.includes('model')) {
      statusCode = 400;
      errorMessage = 'Model configuration error';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString()
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      healthCheck: 'GET /health',
      summarize: 'POST /api/summarize'
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Groq model: llama-3.3-70b-versatile`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});