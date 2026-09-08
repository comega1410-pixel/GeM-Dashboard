<div align="center">

# 🏛️ GeM Compliance Copilot

### AI-Powered Bid Compliance Verification for Government e-Marketplace

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash-4285F4?logo=google)](https://ai.google.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

**Evidence-grounded, requirement-level compliance verification with deterministic rules, semantic AI reasoning, source citations, confidence scores, and human review.**

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Tech Stack](#-tech-stack) · [How It Works](#-how-it-works) · [API](#-api-reference)

</div>

---

## 🎯 The Problem

Government procurement on GeM involves reviewing **large volumes of tender requirements** against bidder-submitted documents. A procurement officer must manually verify whether every mandatory requirement — from financial thresholds to certifications to technical specifications — has been adequately satisfied across dozens of documents.

This is **time-consuming, error-prone, and difficult to audit**.

## 💡 Our Solution

GeM Compliance Copilot converts unstructured GeM bid documents into a **structured compliance matrix** and automatically maps each requirement to supporting bidder evidence.

It combines:
- **Deterministic rule-based validation** for quantifiable requirements (turnover ≥ ₹5 Cr, delivery ≤ 60 days)
- **AI-powered semantic verification** for subjective requirements (similar project experience, OEM authorization)
- **Three-state classification** — `COMPLIANT`, `NON-COMPLIANT`, or `NEEDS_REVIEW`
- **Full traceability** — every decision links back to the source document and page

> **The AI doesn't just give an answer — it shows you why.**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📋 **Requirement Extraction** | Automatically identifies and categorizes all bid requirements from tender PDFs |
| 🔍 **Evidence Extraction** | Pulls key data points (financial figures, dates, certifications, specs) from bidder documents |
| ⚖️ **Hybrid Compliance Engine** | Rule engine for numeric checks + Gemini AI for semantic evaluation |
| 📊 **Compliance Matrix** | Interactive table with expandable rows showing requirement → evidence → decision |
| 🎯 **Risk Scoring** | Category-level breakdown (Financial, Technical, Experience, Certification, Documentation) |
| 🟢🟡🔴 **Three-State Classification** | COMPLIANT / NEEDS_REVIEW / NON_COMPLIANT with confidence scores |
| 🤖 **AI Executive Summary** | Gemini-generated natural language summary of the analysis |
| 📄 **PDF Report Generation** | Downloadable, audit-grade compliance report with full evidence trail |
| 🔐 **Mandatory Failure Detection** | System never auto-qualifies when mandatory requirements fail |
| 📁 **Smart Document Classification** | Auto-detects document types from filenames |

---

## 🏗️ Architecture

```
                    FRONTEND
                 Next.js 16 + Tailwind v4
                       │
                       ↓
                  Backend API
                 Express 5 + Prisma
                       │
        ┌──────────────┼───────────────┐
        ↓              ↓               ↓
 Document          Requirement      Bid/User
 Processing        Extraction       Management
        │              │
        ↓              ↓
   PDF Parse       Gemini AI
        │              │
        └───────┬──────┘
                ↓
        Compliance Engine
                │
       ┌────────┴────────┐
       ↓                 ↓
 Rule Engine       Semantic Engine
 (Deterministic)   (Gemini AI)
       │                 │
       └────────┬────────┘
                ↓
         Compliance Matrix
                │
                ↓
          Risk Scoring
                │
           ┌────┴────┐
           ↓         ↓
      Dashboard   PDF Report
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** running on `localhost:5432`
- **Google Gemini API Key** — [Get one here](https://aistudio.google.com/apikey)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/gem-compliance-copilot.git
cd gem-compliance-copilot
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY and DATABASE_URL

# Initialize the database
npx prisma db push
npx prisma generate

# Start the dev server
npm run dev
```

The backend API will be running at **http://localhost:5000**

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be running at **http://localhost:3000**

### 4. Environment Variables

Create a `backend/.env` file:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gem_compliance"
GEMINI_API_KEY="your-gemini-api-key-here"
UPLOAD_DIR="./uploads"
CORS_ORIGIN="http://localhost:3000"
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **Next.js 16** | React framework with App Router |
| **Tailwind CSS v4** | Utility-first CSS with custom design tokens |
| **TypeScript** | Type-safe development |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Express 5** | HTTP API server |
| **Prisma** | Type-safe PostgreSQL ORM |
| **Google Gemini 2.0 Flash** | AI for requirement extraction, evidence extraction, semantic compliance |
| **pdf-parse** | Text extraction from PDFs |
| **PDFKit** | PDF compliance report generation |
| **Multer** | File upload handling |
| **TypeScript** | Type-safe development |

### Database
| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Relational database for bids, requirements, evidence, compliance results |

---

## ⚙️ How It Works

### The Pipeline

```
1. Upload          Officer uploads GeM bid document + bidder submissions (PDFs)
       ↓
2. Process         pdf-parse extracts text from all documents
       ↓
3. Extract Reqs    Gemini AI identifies all requirements from the tender
                   Each requirement is categorized and structured:
                   { code, category, description, mandatory, operator, threshold, unit }
       ↓
4. Extract Evidence Gemini AI extracts evidence data points from bidder documents
                   { fieldName, extractedValue, pageNumber, confidence, rawText }
       ↓
5. Rule Engine     For quantifiable requirements (turnover ≥ ₹5 Cr):
                   - Finds relevant evidence by category/keyword matching
                   - Extracts numeric values (handles crore/lakh notation)
                   - Compares against thresholds → COMPLIANT or NON_COMPLIANT
       ↓
6. Semantic Engine For non-quantifiable requirements:
                   - Sends requirement + all evidence to Gemini
                   - AI evaluates sufficiency with reasoning
                   - Returns COMPLIANT / NON_COMPLIANT / NEEDS_REVIEW
       ↓
7. Risk Scoring    Aggregates results by category, detects mandatory failures
                   Risk level: LOW / MEDIUM / HIGH / CRITICAL
       ↓
8. Dashboard       Interactive compliance matrix with expandable evidence rows
       ↓
9. Report          Downloadable PDF with full audit trail
```

### Requirement Categories

| Category | Examples |
|----------|----------|
| `FINANCIAL` | Minimum turnover, net worth, GST registration |
| `EXPERIENCE` | Years of operation, similar contracts, completed projects |
| `CERTIFICATION` | ISO 9001, BIS, CE, product-specific certifications |
| `TECHNICAL` | Processor specs, RAM, storage, display, hardware parameters |
| `LEGAL` | Declarations, affidavits, signed undertakings, authorization letters |
| `DOCUMENT_VALIDITY` | Certificate expiry, document completeness |
| `BID_SPECIFIC` | Delivery timeline, location, warranty, payment terms |

---

## 📡 API Reference

### Bids

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bids` | Create a new bid |
| `GET` | `/api/bids` | List all bids |
| `GET` | `/api/bids/:id` | Get bid with full details |
| `DELETE` | `/api/bids/:id` | Delete a bid |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bids/:bidId/documents` | Upload PDFs (multipart/form-data) |
| `GET` | `/api/bids/:bidId/documents` | List documents for a bid |

### Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bids/:bidId/analyze` | Trigger compliance analysis |
| `GET` | `/api/bids/:bidId/compliance` | Get compliance matrix + risk score |
| `GET` | `/api/bids/:bidId/compliance/:reqId` | Get detail for a single requirement |
| `GET` | `/api/bids/:bidId/summary` | Generate AI executive summary |
| `GET` | `/api/bids/:bidId/report` | Download PDF compliance report |

---

## 📁 Project Structure

```
gem-compliance-copilot/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── config.ts              # Environment config
│   │   ├── index.ts               # Express app entry point
│   │   ├── lib/
│   │   │   ├── gemini.ts          # Google Gemini AI client
│   │   │   └── prisma.ts          # Prisma client
│   │   ├── middleware/
│   │   │   └── upload.ts          # Multer file upload config
│   │   ├── routes/
│   │   │   ├── bids.ts            # Bid CRUD routes
│   │   │   ├── compliance.ts      # Analysis & compliance routes
│   │   │   ├── documents.ts       # Document upload routes
│   │   │   └── report.ts          # PDF report download
│   │   └── services/
│   │       ├── complianceEngine.ts # Main orchestrator
│   │       ├── documentProcessor.ts# PDF text extraction
│   │       ├── evidenceExtractor.ts# AI evidence extraction
│   │       ├── reportGenerator.ts  # PDF report with PDFKit
│   │       ├── requirementExtractor.ts # AI requirement extraction
│   │       ├── riskScorer.ts       # Risk scoring engine
│   │       ├── ruleEngine.ts       # Deterministic rule evaluation
│   │       └── semanticEngine.ts   # AI semantic evaluation
│   ├── .env                       # Environment variables (not committed)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout + navbar
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── globals.css        # Design system + tokens
│   │   │   ├── upload/
│   │   │   │   └── page.tsx       # 3-step upload wizard
│   │   │   └── bids/
│   │   │       ├── page.tsx       # All analyses table
│   │   │       └── [bidId]/
│   │   │           └── page.tsx   # Compliance matrix + report
│   │   └── lib/
│   │       └── api.ts             # Typed API client
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## 🧪 User Workflow

1. **Create Analysis** — Officer enters bid title and GeM bid number
2. **Upload Documents** — Drag-and-drop the tender PDF and bidder submission PDFs
3. **Tag Document Types** — System auto-detects types; officer can adjust
4. **Run Analysis** — Click "Run Compliance Analysis"
5. **View Dashboard** — See compliance matrix with 🟢 PASS / 🟡 REVIEW / 🔴 FAIL
6. **Drill Down** — Click any requirement row to see evidence, source page, and AI reasoning
7. **Download Report** — Generate and download a full PDF compliance report

---

## 🔒 Design Principles

1. **AI Assists, Never Replaces** — The system recommends; the officer decides
2. **Three States, Not Two** — NEEDS_REVIEW prevents false confidence
3. **Evidence-Grounded** — Every decision traces to a source document and page
4. **Mandatory Failures Block** — Even one mandatory failure = no auto-qualification
5. **Confidence Scores** — Every AI decision includes a calibrated confidence score
6. **Audit Trail** — Full report with document references for compliance defense

---

## 👥 Team

Built for **Smart India Hackathon 2026**

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
