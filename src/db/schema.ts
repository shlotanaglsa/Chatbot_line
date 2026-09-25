// src/db/schema.ts
import { pgTable, serial, text, vector, timestamp } from 'drizzle-orm/pg-core';

export const clinicEmbeddings = pgTable('clinic_embeddings', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),                  // ข้อความ Chunk ที่ตัดออกมา
  embedding: vector('embedding', { dimensions: 1536 }), // Vector 1536 มิติสำหรับ text-embedding-3-small
  metadata: text('metadata'),                         // สำหรับเก็บชื่อไฟล์ หรือเลขหน้า (ถ้ามี)
  createdAt: timestamp('created_at').defaultNow(),
});