import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './envConfig.js';

export const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
