import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import OpenAI from 'openai';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("OpenAI API Key:", process.env.OPENAI_API_KEY ? "พร้อมใช้งาน" : "ไม่พบ Key");

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
    .replace(/\0/g, '') // กรอง Null bytes กัน Postgres Error
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
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

  console.log('3. กำลังสร้าง Vector Embeddings ผ่าน OpenAI API และบันทึกลง Database...');

  let i = 0;
  for (const chunk of chunks) {
    if (!chunk) continue;

    // ยิงสร้าง Embedding ผ่าน OpenAI SDK
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
      encoding_format: 'float',
    });

    const embedding = response.data[0]?.embedding;

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
  console.log('🎉 [OpenAI] ทำกระบวนการ Ingestion สำเร็จเรียบร้อย!');
}

runIngestion().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err);
});