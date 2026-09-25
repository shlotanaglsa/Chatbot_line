import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key ที่โหลดมา:", apiKey ? "มีค่าอยู่ (ซ่อนตัวอักษร)" : "ไม่มีค่า (Undefined)");

// ฟังก์ชันยิงสร้าง Embedding ตรงหา Gemini REST API ( Cloud 100% )
// ฟังก์ชันยิงสร้าง Embedding ตรงหา Gemini REST API ( Cloud 100% )
// ฟังก์ชันยิงสร้าง Embedding ผ่าน Gemini REST API (ใช้ embedding-001)
// ฟังก์ชันยิงสร้าง Embedding ผ่าน Gemini REST API ( Cloud 100% )
async function getGeminiEmbedding(text: string): Promise<number[]> {
  // แก้ไขชื่อโมเดลใน URL เป็น gemini-embedding-001 หรือ text-embedding-004
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
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
  // ลบ Null byte (\u0000) และคลีนข้อความขยะที่ติดมาจาก PDF
  const cleanedText = text
    .replace(/\0/g, '') // ลบ Null bytes ที่ทำให้ Postgres พัง
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

  console.log('1. กำลังอ่านไฟล์ PDF...');
  const pdfText = await extractTextFromPDF(pdfPath);

  console.log('2. กำลังแบ่งข้อความออกเป็น Chunk...');
  const chunks = chunkText(pdfText, 700, 100);
  console.log(`ตัดได้ทั้งหมด ${chunks.length} Chunks`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('3. กำลังสร้าง Vector Embeddings ผ่าน Gemini REST API และบันทึกลง Database...');

  let i = 0;
  for (const chunk of chunks) {
    if (!chunk) continue;

    // ยิงตรงไป Cloud ของ Google
    const embedding = await getGeminiEmbedding(chunk);

    if (!embedding) {
      console.error(`ไม่สามารถรับค่า Embedding สำหรับ Chunk ที่ ${i + 1} ได้`);
      continue;
    }

    const query = `
      INSERT INTO clinic_embeddings (content, embedding, metadata)
      VALUES ($1, $2, $3)
    `;

    await client.query(query, [
      chunk,
      JSON.stringify(embedding),
      JSON.stringify({ source: 'clinic-promotion.pdf', chunkIndex: i }),
    ]);

    i++;
    console.log(`บันทึก Chunk ที่ ${i}/${chunks.length} เรียบร้อยแล้ว`);
  }

  await client.end();
  console.log('🎉 ทำกระบวนการ Ingestion สำเร็จเรียบร้อย!');
}

runIngestion().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err);
});