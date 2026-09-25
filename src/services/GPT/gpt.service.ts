import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

// เชื่อมต่อ OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 1. แปลงข้อความเป็น Vector Embedding (ยังคงใช้ Gemini embedding เพื่อให้ตรงกับโครงสร้างตู้เก็บข้อมูล 3072 dims เดิม)
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
 * 2. ส่ง Context + คำถาม ให้ GPT-4o-mini สร้างคำตอบ (เร็ว เสถียร ไม่เจอ 503)
 */
export async function generateRAGAnswer(userQuery: string, context: string): Promise<string> {
  const systemInstruction = `คุณคือผู้ช่วยตอบคำถามลูกค้า โปรดตอบคำถามโดยอิงจากข้อมูลบริบท (Context) ที่กำหนดให้อย่างถูกต้อง สุภาพ และกระชับ หากไม่มีข้อมูลในบริบท ให้ตอบอย่างสุภาพว่าไม่พบข้อมูล\n\n[Context]\n${context}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // ใช้โมเดลมาตรฐานที่เร็วและเสถียรที่สุด
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.2, // ควบคุมไม่ให้มโนออกนอกทะเล
    });

    return response.choices[0]?.message?.content || 'ขออภัย ไม่สามารถสร้างคำตอบได้ในขณะนี้';
  } catch (error: any) {
    console.error('[OpenAI Error]:', error?.message || error);
    return 'ขออภัย ขณะนี้ระบบประมวลผลมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง';
  }
}