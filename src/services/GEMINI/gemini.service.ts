import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

const ai = new GoogleGenAI({ apiKey });

/**
 * แปลง ข้อความ เป็น Vector Embedding (3072 dims)
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.embedding?.values) {
    throw new Error(`Embedding API Error [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data.embedding.values;
}

/**
 * ส่ง Context + คำถาม ให้ Gemini สร้างคำตอบ
 */
export async function generateRAGAnswer(userQuery: string, context: string): Promise<string> {
  const systemInstruction = `คุณคือผู้ช่วยตอบคำถามลูกค้า โปรดตอบคำถามโดยอิงจากข้อมูลบริบท (Context) ที่กำหนดให้อย่างถูกต้อง สุภาพ และกระชับ หากไม่มีข้อมูลในบริบท ให้ตอบอย่างสุภาพว่าไม่พบข้อมูล\n\n[Context]\n${context}`;

  // เปลี่ยนชื่อโมเดลเป็นรุ่นล่าสุดตามที่ API แนะนำ
  const fallbackModels = [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite'
  ];

  for (const modelName of fallbackModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: userQuery }]
          }
        ],
        config: {
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        }
      });

      if (response.text) {
        return response.text;
      }
    } catch (error: any) {
      console.warn(`[Gemini Error - ${modelName}]:`, error?.message || error);
    }
  }

  return 'ขออภัย ขณะนี้ระบบประมวลผลมีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้งในครู่นะครับ';
}