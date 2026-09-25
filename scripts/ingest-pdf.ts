import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key ที่โหลดมา:", apiKey ? "มีค่าอยู่ (ซ่อนตัวอักษร)" : "ไม่มีค่า (Undefined)");

/**
 * ฟังก์ชันยิงสร้าง Embedding ผ่าน Gemini REST API (gemini-embedding-001)
 */
async function getGeminiEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        parts: [{ text: text }]
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

function extractTextFromPDF(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      const error = errData?.parserError || errData;
      reject(error);
    });

    pdfParser.on('pdfParser_dataReady', () => {
      const rawText = pdfParser.getRawTextContent();
      resolve(rawText);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

function chunkText(text: string, chunkSize: number = 700, overlap: number = 100): string[] {
  const cleanedText = text
    .replace(/\0/g, '') // ลบ Null bytes
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '') // ลบ Control characters
    .replace(/\s+/g, ' ')
    .trim();

  const chunks: string[] = [];
  let index = 0;

  while (index < cleanedText.length) {
    const chunk = cleanedText.slice(index, index + chunkSize);
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    index += chunkSize - overlap;
  }

  return chunks;
}

async function runIngestion() {
  const pdfPath = path.join(process.cwd(), 'data', 'clinic-promotion.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error(`ไม่พบไฟล์ PDF ที่ตำแหน่ง: ${pdfPath}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('0. กำลังเตรียมตาราง document_chunks (ขนาด 3072 dimensions)...');
  await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
  
  // ลบตารางเดิมที่มีขนาด 768 ออกก่อน
  await client.query('DROP TABLE IF EXISTS document_chunks;');

  // สร้างตารางใหม่ด้วยขนาด 3072
  await client.query(`
    CREATE TABLE document_chunks (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      embedding vector(3072),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✔ ตาราง document_chunks (3072 dims) พร้อมใช้งาน');

  console.log('1. กำลังอ่านไฟล์ PDF...');
  const pdfText = await extractTextFromPDF(pdfPath);

  console.log('2. กำลังแบ่งข้อความออกเป็น Chunk...');
  const chunks = chunkText(pdfText, 700, 100);
  console.log(`ตัดได้ทั้งหมด ${chunks.length} Chunks`);

  console.log('3. กำลังสร้าง Vector Embeddings ผ่าน Gemini REST API และบันทึกลง Database...');

  let i = 0;
  for (const chunk of chunks) {
    if (!chunk) continue;

    const embedding = await getGeminiEmbedding(chunk);

    if (!embedding) {
      console.error(`ไม่สามารถรับค่า Embedding สำหรับ Chunk ที่ ${i + 1} ได้`);
      continue;
    }

    const query = `
      INSERT INTO document_chunks (content, embedding, metadata)
      VALUES ($1, $2::vector, $3)
    `;

    await client.query(query, [
      chunk,
      `[${embedding.join(',')}]`,
      JSON.stringify({ source: 'clinic-promotion.pdf', chunkIndex: i }),
    ]);

    i++;
    console.log(`บันทึก Chunk ที่ ${i}/${chunks.length} เรียบร้อยแล้ว`);
  }

  await client.end();
  console.log('🎉 ทำกระบวนการ Ingestion และสร้าง Database สำเร็จเรียบร้อย!');
}

runIngestion().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err);
});