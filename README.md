# คู่มือการใช้งาน Clinic AI Bot

> โปรเจกต์ **Clinic AI Bot** เป็นแชทบอทตอบคำถามลูกค้าคลินิก ที่ทำงานบน **LINE Messaging** โดยใช้สถาปัตยกรรม **RAG (Retrieval-Augmented Generation)** — ค้นหาข้อมูลจากฐานข้อมูลเวกเตอร์ แล้วให้ LLM สร้างคำตอบที่อิงข้อมูลจริง
>
> 📸 *แทรกภาพรวมสถาปัตยกรรมได้ที่นี่*  
> [วางแผนภาพหรือภาพรวมระบบ]

---

## สารบัญ

1. [ภาพรวมโปรเจกต์](#1-ภาพรวมโปรเจกต์)
2. [โครงสร้างโปรเจกต์](#2-โครงสร้างโปรเจกต์)
3. [ข้อกำหนดเบื้องต้น](#3-ข้อกำหนดเบื้องต้น)
4. [การติดตั้งและตั้งค่า](#4-การติดตั้งและตั้งค่า)
5. [การกำหนดค่า Environment Variables](#5-การกำหนดค่า-environment-variables)
6. [การรันเซิร์ฟเวอร์](#6-การรันเซิร์ฟเวอร์)
7. [การ Ingest ข้อมูล PDF ลงฐานข้อมูล](#7-การ-ingest-ข้อมูล-pdf-ลงฐานข้อมูล)
8. [การใช้งาน LINE Bot](#8-การใช้งาน-line-bot)
9. [การเลือกใช้ LLM Provider](#9-การเลือกใช้-llm-provider)
10. [การเชื่อมต่อฐานข้อมูล](#10-การเชื่อมต่อฐานข้อมูล)
11. [การดีบักและการแก้ไขปัญหา](#11-การดีบักและการแก้ไขปัญหา)
12. [การปรับแต่งและพัฒนาเพิ่มเติม](#12-การปรับแต่งและพัฒนาเพิ่มเติม)
13. [รายการคำสั่งที่ใช้บ่อย](#13-รายการคำสั่งที่ใช้บ่อย)
14. [ช่องว่างสำหรับใส่ภาพ Screenshot](#14-ช่องว่างสำหรับใส่ภาพ-screenshot)

---

## 1. ภาพรวมโปรเจกต์

| คุณสมบัติ | รายละเอียด |
|---|---|
| **ประเภท** | แชทบอต LINE สำหรับตอบคำถามลูกค้าคลินิก |
| **ภาษา** | TypeScript (ES Modules) |
| **Runtime** | Node.js |
| **Web Framework** | Fastify |
| **Bot Platform** | LINE Messaging API |
| **AI Models** | Google Gemini (embedding + chat), OpenAI GPT-4o-mini, Groq (Llama) |
| **Database** | PostgreSQL (ผ่าน Supabase Pooler) |
| **Vector Search** | pgvector (1536 หรือ 3072 มิติ) |
| **PDF Processing** | pdf2json |

### 📸 *แทรกภาพผังงาน (Flow Diagram)*  
> [เช่น ภาพ: ผู้ใช้พิมพ์ใน LINE → Webhook → RAG Query → LLM ตอบกลับ]

---

## 2. โครงสร้างโปรเจกต์

```
clinic_ai_bot/
├── .env                        # ตัวแปรสภาพแวดล้อม (API Keys, DB URLs)
├── .env.example                # (ถ้ามี) ตัวอย่างค่าต่างๆ
├── package.json                # รายการ dependencies และ scripts
├── tsconfig.json               # ตั้งค่า TypeScript
├── package-lock.json           # Lock file สำหรับ npm
├── src/
│   ├── index.ts                # จุดเริ่มต้นเซิร์ฟเวอร์ Fastify
│   ├── db/
│   │   └── schema.ts           # นิยามตาราง (Drizzle ORM)
│   ├── routes/
│   │   └── line.webhook.ts     # รับ LINE Webhook
│   └── services/
│       ├── GEMINI/
│       │   ├── gemini.service.ts   # Gemini embedding + generate answer
│       │   └── rag.service.ts      # ตรรกะ RAG (คิวรีฐานข้อมูลเวกเตอร์)
│       ├── GPT/
│       │   └── gpt.service.ts      # OpenAI GPT-4o-mini RAG
│       └── GroqAPI/
│           └── Groq.service.ts     # Groq Llama RAG
├── scripts/
│   ├── ingest-pdf.ts           # สคริปต์แปลง PDF → Embedding → บันทึกลง DB
│   ├── GEMINI/                 # (มี) สคริปต์เพิ่มเติม
│   └── GPT/                    # (มี) สคริปต์เพิ่มเติม
├── data/
│   └── clinic-promotion.pdf    # เอกสาร PDF ต้นทางที่ต้องการให้บอทรู้จัก
├── node_modules/               # dependencies (ติดตั้งแล้ว)
└── USER_MANUAL.md              # คู่มือนี้
```

### 📸 *แทรกภาพโครงสร้างโฟลเดอร์*  
> [ภาพ Tree Structure หรือ Screenshot โฟลเดอร์]

---

## 3. ข้อกำหนดเบื้องต้น

ก่อนติดตั้ง ต้องมีซอฟต์แวร์และบัญชีดังนี้:

| สิ่งที่ต้องใช้ | รายละเอียด |
|---|---|
| **Node.js** | เวอร์ชัน 18 ขึ้นไป (แนะนำ 20+) |
| **npm** | มาโดยธรรมชาติกับ Node.js |
| **บัญชี Google** | เพื่อใช้ Gemini API |
| **บัญชี OpenAI** | เพื่อใช้ GPT-4o-mini |
| **บัญชี LINE Developer** | เพื่อสร้าง Channel และรับ Token |
| **บัญชี Supabase** | สำหรับ PostgreSQL พร้อม pgvector |
| *(ไม่บังคับ)* **บัญชี Groq** | สำหรับใช้ Llama model |

### 📸 *แทรกภาพการติดตั้ง Node.js / npm*  
> [เช่น ภาพ: หน้าต่าง Terminal แสดง `node -v` และ `npm -v`]

---

## 4. การติดตั้งและตั้งค่า

### 4.1 โคลนโปรเจกต์ (ถ้ามี Git)
```bash
git clone <repository-url>
cd clinic_ai_bot
```

### 4.2 ติดตั้ง Dependencies
```bash
npm install
```
> 💡 `node_modules` มีอยู่แล้วในโปรเจกต์นี้ จึงไม่จำเป็นต้องรันซ้ำ แต่ถ้าย้ายโปรเจกต์ไปเครื่องใหม่ ให้รันคำสั่งนี้

### 📸 *แทรกภาพ Terminal หลังรัน `npm install`*  
> [Screenshots แสดงข้อความ `added X packages`]

### 4.3 ตรวจสอบ TypeScript (ไม่บังคับ)
```bash
npx tsc --noEmit
```

---

## 5. การกำหนดค่า Environment Variables

ไฟล์ `.env` อยู่ที่โฟลเดอร์หลัก **ห้ามเผยแพร่** เพราะมี API Keys จริง

```env
# ==================== DATABASE ====================
# เชื่อมต่อ Postgres ผ่าน Supabase Pooler (transaction-mode) สำหรับใช้งานปกติ
DATABASE_URL="postgresql://postgres.ntlefbtcgyqbgmqiwfpq:0101067812sh@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# เชื่อมต่อ Postgres ผ่าน Session-mode Pooler (ใช้สำหรับ Migration / DDL)
DIRECT_URL="postgresql://postgres.ntlefbtcgyqbgmqiwfpq:0101067812sh@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# ==================== API KEYS ====================
PORT=3000
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret
GROQ_API_KEY=your-groq-api-key-here   # (ถ้าใช้ Groq)
```

### คำอธิบายแต่ละตัวแปร

| ตัวแปร | ความหมาย | จำเป็น? |
|---|---|---|
| `DATABASE_URL` | URL เชื่อมต่อฐานข้อมูลหลัก (transaction pooler) | ✅ ต้อง |
| `DIRECT_URL` | URL เชื่อมต่อสำหรับรันคำสั่ง DDL (session pooler) | ✅ ต้อง |
| `PORT` | พอร์ตที่เซิร์ฟเวอร์ฟัง (ค่าเริ่มต้น: 3000) | ต้อง |
| `GEMINI_API_KEY` | กุญแจ Gemini สำหรับ embedding + chat | ✅ ต้องมีอย่างน้อย 1 LLM |
| `OPENAI_API_KEY` | กุญแจ OpenAI สำหรับ GPT-4o-mini | ตัวเลือก |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token สำหรับตอบกลับผู้ใช้ LINE | ✅ ต้อง |
| `LINE_CHANNEL_SECRET` | Secret สำหรับยืนยัน webhook จาก LINE | ✅ ต้อง |
| `GROQ_API_KEY` | กุญแจ Groq สำหรับ Llama | ตัวเลือก |

### 📸 *แทรกภาพการกรอกค่าในไฟล์ .env*  
> [Screenshots แสดงไฟล์ .env ที่กรอกค่าครบ (ซ่อน API key บางส่วน)]

---

## 6. การรันเซิร์ฟเวอร์

### 6.1 รันด้วย tsx (แนะนำ)
```bash
npx tsx src/index.ts
```
หรือ
```bash
tsx src/index.ts
```

### 6.2 รันด้วย node (ถ้า compile แล้ว)
```bash
tsc && node dist/index.js
```

### 6.3 ตรวจสอบสถานะเซิร์ฟเวอร์
เปิด Browser หรือใช้ curl:
```bash
curl http://localhost:3000/
```
**ผลลัพธ์ที่คาดหวัง:**
```json
{"status":"ok","message":"Clinic AI Bot Server is Running!"}
```

### 6.4 ดู Logs
เมื่อเซิร์ฟเวอร์ทำงานจะมี log แสดง:
```
Server listening on port 3000
```
หากมีข้อผิดพลาด (เช่น missing API key) จะแสดง error ใน terminal

### 📸 *แทรกภาพ Terminal ขณะเซิร์ฟเวอร์ทำงาน*  
> [Screenshots แสดงข้อความ "Server listening on port 3000"]

---

## 7. การ Ingest ข้อมูล PDF ลงฐานข้อมูล

ก่อนใช้งานบอท ต้อง **นำข้อมูลจาก PDF มาใส่ในฐานข้อมูลเวกเตอร์** ก่อน เพื่อให้บอทค้นหาคำตอบได้

### 7.1 เตรียมไฟล์ PDF
- วางไฟล์ PDF ที่ต้องการให้บอทรู้จัก ไว้ที่โฟลเดอร์ `data/`
- ตัวอย่างในโปรเจกต์นี้: `data/clinic-promotion.pdf`
- หากต้องการใช้ PDF อื่น แก้ไข path ใน `scripts/ingest-pdf.ts` (บรรทัดที่ 76)

### 7.2 ตรวจสอบ Database
ก่อน ingest ต้องแน่ใจว่า:
- `DATABASE_URL` และ `DIRECT_URL` ใน `.env` สามารถเชื่อมต่อได้
- Supabase เปิดใช้งาน **pgvector extension** แล้ว

### 7.3 รันสคริปต์ Ingestion
```bash
npx tsx scripts/ingest-pdf.ts
```

### 7.4 ขั้นตอนการทำงาน (อธิบาย)
1. **อ่านไฟล์ PDF** โดยใช้ `pdf2json` → ได้ข้อความดิบ
2. **ทำความสะอาดข้อความ** → ลบ null bytes, control characters, ยอมรับ whitespace
3. **ตัดข้อความเป็น Chunks** → ขนาด 700 ตัวอักษร ทับซ้อน 100 ตัวอักษร
4. **สร้าง Vector Embedding** → ผ่าน Gemini `gemini-embedding-001` (3072 มิติ)
5. **บันทึกลง PostgreSQL** → ตาราง `document_chunks` (พร้อม vector index)

### 7.5 โครงสร้างตาราง `document_chunks`
```sql
CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,          -- ข้อความ Chunk
  embedding vector(3072),         -- Vector embedding
  metadata JSONB DEFAULT '{}',    -- ชื่อไฟล์, เลขหน้า, chunkIndex
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
> ⚠️ **หมายเหตุ:** สคริปต์ `ingest-pdf.ts` จะ **ลบตารางเดิม** (`DROP TABLE IF EXISTS document_chunks`) แล้วสร้างใหม่ทุกครั้ง ดังนั้นหากต้องการเก็บข้อมูลเดิม ควร backup ก่อน

### 📸 *แทรกภาพ Terminal ระหว่างรัน `ingest-pdf.ts`*  
> [Screenshots แสดง "บันทึก Chunk ที่ X/Y เรียบร้อยแล้ว" และ "🎉 ทำกระบวนการ Ingestion สำเร็จ"]

### 📸 *แทรกภาพตาราง document_chunks ใน Supabase Dashboard*  
> [Screenshots แสดงข้อมูล rows ในตาราง]

---

## 8. การใช้งาน LINE Bot

### 8.1 ตั้งค่า LINE Developer
1. ไปที่ [LINE Developers](https://developers.line.biz/)
2. สร้าง **Provider** → **Channel** (ประเภท Messaging API)
3. ตั้งค่า **Channel Access Token** และ **Channel Secret** ลง `.env`
4. ตั้งค่า **Webhook URL** เป็น `https://<your-domain>/line/webhook`

### 8.2 ทดสอบบอท
1. เพิ่มบอทเป็น Friend ใน LINE
2. ส่งข้อความ เช่น "โปรโมชั่นวันนี้มีอะไรบ้าง"
3. บอทจะตอบกลับโดยอิงข้อมูลใน `clinic-promotion.pdf`

### 8.3 โฟลว์การทำงาน LINE Bot
```
ผู้ใช้ส่งข้อความ → LINE Webhook → รับ event → ตรวจสอบชนิด Message (text)
→ เรียก processRAGQuery(userMessage)
→ ดึง vector คำถาม → คิวรี document_chunks (cosine similarity) → เลือก top 3
→ ส่ง Context + คำถาม ให้ LLM สรุปคำตอบ → ตอบกลับผู้ใช้ LINE
```

### 📸 *แทรกภาพ LINE Developer Console*  
> [Screenshots แสดงหน้า Settings Channel, Webhook URL]

### 📸 *แทรกภาพการตั้งค่า Webhook URL*  
> [Screenshots แสดงช่องกรอก Webhook URL]

### 📸 *แทรกภาพข้อความที่บอทตอบกลับ*  
> [Screenshots แสดง LINE chat ที่บอทตอบกลับ]

---

## 9. การเลือกใช้ LLM Provider

โปรเจกต์นี้รองรับ 3 LLM Providers แยกเป็น service ต่างกัน:

| Provider | Service File | Model | คุณสมบัติ |
|---|---|---|---|
| **Gemini** | `src/services/GEMINI/gemini.service.ts` | `gemini-3.6-flash`, `gemini-3.1-flash-lite` | มี fallback model, ใช้ `@google/genai` SDK |
| **OpenAI** | `src/services/GPT/gpt.service.ts` | `gpt-4o-mini` | เร็ว เสถียร ไม่เจอ 503, ใช้ `openai` SDK |
| **Groq** | `src/services/GroqAPI/Groq.service.ts` | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` | มี fallback model, ใช้ `api.groq.com` |

### หมายเหตุสำคัญ
- **LINE Bot ใช้ `processRAGQuery` จาก `src/services/GEMINI/rag.service.ts`** เท่านั้น ดังนั้นบอทจะใช้ Gemini embedding + Gemini chat โดยค่าเริ่มต้น
- หากต้องการเปลี่ยน LLM ที่บอทใช้จริง แก้ไขการ import ใน `src/routes/line.webhook.ts`
- เอกสาร `gpt.service.ts` และ `Groq.service.ts` สามารถใช้สำหรับทดสอบแยก หรือ integrate เพิ่มได้

### การสลับ LLM ที่บอทใช้
แก้ไขไฟล์ `src/routes/line.webhook.ts`:
```ts
// เปลี่ยนจาก
import { processRAGQuery } from '../services/GEMINI/rag.service.js';
// เป็น (ตัวอย่าง)
import { processRAGQuery } from '../services/GPT/gpt.service.js';
```

### 📸 *แทรกภาพ Comparison Table ระหว่าง Provider*  
> [ภาพเปรียบเทียบ Speed, Cost, Quality]

---

## 10. การเชื่อมต่อฐานข้อมูล

### 10.1 ภาพรวม
- **ORM:** Drizzle ORM (กำหนด schema ใน `src/db/schema.ts`)
- **Database:** PostgreSQL บน Supabase
- **Vector Extension:** pgvector (รองรับการค้นหา cosine similarity)
- **Connection:** ผ่าน `pg` pool client

### 10.2 Schema ที่ใช้งาน
โปรเจกต์มี 2 ตารางที่เกี่ยวข้อง:
- `clinic_embeddings` (ใน `src/db/schema.ts`) — สำหรับ Drizzle ORM (1536 มิติ)
- `document_chunks` (สร้างโดย `scripts/ingest-pdf.ts`) — สำหรับ pgvector (3072 มิติ)

> ⚠️ **ปัญหาที่พบบ่อย:** `rag.service.ts` คิวรี `document_chunks` (3072 dims) แต่ `schema.ts` กำหนด `clinic_embeddings` (1536 dims) — ควรใช้ให้ตรงกัน

### 10.3 เชื่อมต่อผ่าน Supabase
- ใช้ **Pooler** ของ Supabase (ทั้ง transaction-mode และ session-mode)
- `DATABASE_URL` → transaction pooler (พอร์ต 6543)
- `DIRECT_URL` → session pooler (พอร์ต 5432)

### 📸 *แทรกภาพ Supabase Dashboard - Database*  
> [Screenshots แสดง Table Editor, SQL Editor]

---

## 11. การดีบักและการแก้ไขปัญหา

### ปัญหาที่พบบ่อย

| อาการ | สาเหตุ | วิธีแก้ไข |
|---|---|---|
| `Server listening on port 3000` ไม่ขึ้น | Port ถูกใช้งาน หรือ `.env` ผิด | ตรวจสอบ `PORT` ใน `.env`, ลองใช้ port อื่น |
| `GEMINI_API_KEY is not defined` | ไม่ได้ตั้งค่า `.env` | ตรวจสอบ `.env` มี `GEMINI_API_KEY` จริง |
| `Cannot find module` | dependencies ยังไม่ติดตั้ง | รัน `npm install` |
| บอทไม่ตอบกลับ LINE | Webhook URL ผิด หรือ Token ผิด | ตรวจสอบ LINE Developer Console |
| `No pgvector extension` | Database ยังไม่เปิดใช้งาน pgvector | `CREATE EXTENSION IF NOT EXISTS vector;` |
| Embedding ขนาดไม่ตรงกัน | `document_chunks` ใช้ 3072 แต่ query จาก 1536 | ตรวจสอบ `rag.service.ts` |
| `Connection refused` กับ DB | `DATABASE_URL` ผิด หรือ Supabase Pooler ไม่ทำงาน | ทดสอบเชื่อมต่อผ่าน psql/DBeaver |

### ทดสอบการเชื่อมต่อ DB
```bash
# ตรวจสอบด้วย psql (ถ้าติดตั้ง)
psql "postgresql://postgres.ntlefbtcgyqbgmqiwfpq:0101067812sh@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# หรือทดสอบผ่าน Node.js
node -e "const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.connect().then(()=>console.log('DB ok')).catch(e=>console.error(e));"
```

### ดู Logs เพิ่มเติม
```bash
# รันด้วยโหมด debug
DEBUG=fastify,npm:tsx npx tsx src/index.ts
```

### 📸 *แทรกภาพ Error ใน Terminal*  
> [Screenshots แสดงข้อผิดพลาดที่พบบ่อย]

### 📸 *แทรกภาพการแก้ไข .env*  
> [Screenshots แสดงการแก้ไขค่าใน VS Code]

---

## 12. การปรับแต่งและพัฒนาเพิ่มเติม

### 12.1 เพิ่มเอกสาร PDF ใหม่
1. วางไฟล์ PDF ใหม่ใน `data/` (เช่น `data/clinic-services.pdf`)
2. แก้ path ใน `scripts/ingest-pdf.ts` (บรรทัด 76)
3. รันสคริปต์: `npx tsx scripts/ingest-pdf.ts`
4. ตรวจสอบ `document_chunks` ว่ามี rows ใหม่

### 12.2 เพิ่มฟีเจอร์ใหม่
- **เพิ่ม route:** สร้างไฟล์ใหม่ใน `src/routes/` แล้ว `fastify.register()`
- **เพิ่ม service LLM:** สร้างไฟล์ใหม่ใน `src/services/` แล้ว import ใน route
- **เพิ่ม schema:** แก้ไข `src/db/schema.ts` แล้ว migrate

### 12.3 ปรับแต่ง System Prompt
แก้ไขในไฟล์ service ที่ใช้ เช่น `generateRAGAnswer` ใน `gemini.service.ts`:
```ts
  const systemInstruction = `คุณคือผู้ช่วย...`;
```

### 📸 *แทรกภาพการแก้ไข Code ใน VS Code*  
> [Screenshots แสดงการเปิดไฟล์และแก้ไข]

### 📸 *แทรกภาพการทดสอบด้วย curl*  
> [Screenshots แสดง `curl http://localhost:3000/`]

---

## 13. รายการคำสั่งที่ใช้บ่อย

| คำสั่ง | วัตถุประสงค์ |
|---|---|
| `npx tsx src/index.ts` | เริ่มเซิร์ฟเวอร์ |
| `npx tsx scripts/ingest-pdf.ts` | Ingest PDF ลง DB |
| `npx tsc --noEmit` | ตรวจสอบ TypeScript |
| `curl http://localhost:3000/` | ทดสอบเซิร์ฟเวอร์ |
| `npm install` | ติดตั้ง dependencies |
| `psql <DATABASE_URL>` | เชื่อมต่อ PostgreSQL |

### 📸 *แทรกภาพ Terminal ที่มีคำสั่งหลายคำสั่ง*  
> [Screenshots แสดง command history]

---

## 14. ช่องว่างสำหรับใส่ภาพ Screenshot

ด้านล่างนี้คือตำแหน่งที่แนะนำให้แทรกรูปภาพ คุณสามารถเพิ่มภาพได้ทีหลัง โดยใช้รูปแบบ Markdown ดังนี้:

```markdown
![คำอธิบายภาพ](path/to/image.png)
```

### รายการรูปที่แนะนำ

| # | ตำแหน่งในคู่มือ | คำอธิบายภาพ | ชื่อไฟล์ที่แนะนำ |
|---|---|---|---|
| 1 | ส่วน 1 | ภาพผังงานระบบ (User → LINE → Webhook → RAG → LLM → Reply) | `architecture-flow.png` |
| 2 | ส่วน 2 | โครงสร้างโฟลเดอร์ | `folder-structure.png` |
| 3 | ส่วน 3 | หน้า Terminal แสดง `node -v`, `npm -v` | `node-install-check.png` |
| 4 | ส่วน 4 | หลัง `npm install` เสร็จ | `npm-install-success.png` |
| 5 | ส่วน 5 | ไฟล์ `.env` ที่กรอกค่าครบ | `env-file-configured.png` |
| 6 | ส่วน 6 | เซิร์ฟเวอร์ทำงาน | `server-running-terminal.png` |
| 7 | ส่วน 7 | ระหว่างรัน `ingest-pdf.ts` | `ingestion-progress.png` |
| 8 | ส่วน 7 | ตาราง `document_chunks` ใน Supabase | `supabase-table-rows.png` |
| 9 | ส่วน 8 | LINE Developer Console - Webhook Settings | `line-webhook-settings.png` |
| 10 | ส่วน 8 | ข้อความที่บอทตอบกลับใน LINE | `line-bot-reply.png` |
| 11 | ส่วน 9 | เปรียบเทียบ LLM Provider | `llm-provider-comparison.png` |
| 12 | ส่วน 10 | Supabase Dashboard - Database | `supabase-database.png` |
| 13 | ส่วน 11 | ข้อความ Error ที่พบบ่อย | `common-errors.png` |
| 14 | ส่วน 12 | แก้ไข Code ใน VS Code | `vscode-edit-code.png` |
| 15 | ส่วน 12 | ทดสอบด้วย curl | `curl-test-terminal.png` |
| 16 | ส่วน 13 | Terminal ที่มีคำสั่ง | `command-history.png` |

> 💡 **เคล็ดลับการถ่ายภาพ:** กด `Win + Shift + S` เพื่อ Screenshot เฉพาะส่วน, บันทึกเป็น PNG ไว้ในโฟลเดอร์ `docs/images/` แล้วอัปเดต path ในตารางด้านบน

---

## ข้อมูลเพิ่มเติม

- **Dependencies หลัก:** `@google/genai`, `@line/bot-sdk`, `express`, `fastify`, `dotenv`, `drizzle-orm`, `pg`, `openai`, `pdf-parse`, `pdf2json`
- **TypeScript Config:** `strict: true`, `module: nodenext`, `target: esnext`
- **เวอร์ชัน Node.js ที่ใช้ในโปรเจกต์:** ตรวจสอบด้วย `node -v`
- **Database:** PostgreSQL บน Supabase (Ap-Southeast-1)

---

*คู่มือนี้จัดทำโดยอัตโนมัติจากการสำรวจโครงสร้างโปรเจกต์ กรุณาตรวจสอบและอัปเดตข้อมูลให้ตรงกับสถานะปัจจุบันของโปรเจกต์*

*เอกสารนี้อยู่ที่ `USER_MANUAL.md` ในโฟลเดอร์หลัก*
