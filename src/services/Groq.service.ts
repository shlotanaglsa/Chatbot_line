import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

/**
 * แปลงข้อความเป็น Vector Embedding
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
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
 * ส่ง Context + คำถาม ให้ GROQ ประมวลผลคำตอบ
 */
export async function generateRAGAnswer(userQuery: string, context: string): Promise<string> {
  const systemInstruction = `คุณคือผู้ช่วยตอบคำถามลูกค้า โปรดตอบคำถามโดยอิงจากข้อมูลบริบท (Context) ที่กำหนดให้อย่างถูกต้อง สุภาพ และกระชับ หากไม่มีข้อมูลในบริบท ให้ตอบอย่างสุภาพว่าไม่พบข้อมูล\n\n[Context]\n${context}`;

  // ใช้โมเดลมาตรฐานที่เปิดใช้งานแน่นอนของ Groq
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  for (const modelName of models) {
    try {
      const response = await groq.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
      });

      if (response.choices[0]?.message?.content) {
        return response.choices[0].message.content;
      }
    } catch (error: any) {
      console.warn(`[Groq Error - ${modelName}]:`, error?.message || error);
    }
  }

  return 'ขออภัย ขณะนี้ระบบประมวลผลมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง';
}