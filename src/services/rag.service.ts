import { Pool } from 'pg';
// เปลี่ยน path และฟังก์ชันให้ดึงมาจากไฟล์ service ของ Gemini ที่เราทำไว้
import { getEmbedding, generateRAGAnswer } from './gemini.service.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function processRAGQuery(userMessage: string): Promise<string> {
  const queryEmbedding = await getEmbedding(userMessage);
  const vectorString = `[${queryEmbedding.join(',')}]`;

  const query = `
    SELECT content, 1 - (embedding <=> $1::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> $1::vector
    LIMIT 3;
  `;

  const result = await pool.query(query, [vectorString]);

  if (result.rows.length === 0) {
    return 'ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในระบบ';
  }

  const context = result.rows.map((row) => row.content).join('\n---\n');
  const answer = await generateRAGAnswer(userMessage, context);
  return answer;
}