# CV Parser Project Context for GitHub Copilot

> **📖 Complete Architecture:** See [../ARCHITECTURE.md](../ARCHITECTURE.md) for full system design and implementation patterns.
> **🤖 This Document:** GitHub Copilot-optimized context for code completion and suggestions.

## Project Overview
**Name:** CV Parser
**Type:** Multi-Provider AI Document Processor with Vector Storage
**Goal:** Parse CVs/Resumes, extract structured data using configurable AI providers (Browser/Ollama/OpenAI), generate embeddings locally or via APIs, and store everything in IndexedDB for fast retrieval and future semantic search.

## Technology Stack
- **Frontend:** Angular 17 (Standalone Components, RxJS, CommonModule, FormsModule)
- **Backend:** Node.js + Express
- **AI/ML Providers:** 
  - **Browser Mode:**
    - **Chat:** WebLLM (`@mlc-ai/web-llm`) - Phi-3, Llama-3 models
    - **Embeddings:** Transformers.js (`@xenova/transformers`) - MiniLM, GTE models
  - **Ollama Mode:**
    - **Chat & Embeddings:** Local Ollama REST API (http://localhost:11434/api)
  - **OpenAI Mode:**
    - **Chat:** OpenAI API (gpt-4o-mini, gpt-4o, gpt-3.5-turbo)
    - **Embeddings:** Falls back to Browser/Ollama
- **Storage:** IndexedDB (via `idb` v8.0.0) - `ai-vector-db` database
- **File Parsing:** 
  - PDF: `pdfjs-dist` v5.4.449 (worker: `./assets/pdf.worker.min.mjs`)
  - DOCX: `mammoth` v1.11.0
  - Text: Native FileReader

## Architecture

### Frontend Services (`frontend/web/src/app/services/`)

#### 1. **ModelRegistryService** (`model-registry.service.ts`)
- **Role:** Centralized model configuration and state management
- **Features:**
  - Provider-specific model catalogs (Browser/Ollama/OpenAI)
  - RxJS BehaviorSubjects for reactive updates
  - localStorage persistence for:
    - `selectedProvider`
    - `selectedEmbeddingModel` / `selectedChatModel`
    - `openaiApiKey`
    - `ollamaApiUrl` / `ollamaApiKey`
- **Key Methods:**
  - `setProvider(provider)` - Switch provider, update model lists
  - `getCurrent*ModelId()` - Get selected model IDs
  - `checkBrowserCache()` - Query WebLLM cache status
  - `updateOllamaModels()` - Fetch and merge installed/available models

#### 2. **OllamaService** (`ollama.service.ts`)
- **API Endpoints:**
  - `/api/tags` - List installed models
  - `/api/pull` - Download models (streaming)
  - `/api/generate` - Chat completion
  - `/api/embeddings` - Generate embeddings
- **Critical Method:** `pullModel(modelName, progressCallback)`
  - Returns AsyncGenerator<void>
  - Callback signature: `(completed, total, digest?, status?) => void`
  - **digest**: Layer identifier for multi-layer progress tracking
  - **status**: "pulling" | "verifying" | "writing manifest" | "success"
- **Features:**
  - Configurable base URL and API key
  - Recommended model library (fallback to static list)
  - Dynamic model fetching via backend proxy

#### 3. **EmbeddingService** (`embedding.service.ts`)
- **Role:** Multi-provider embedding generation facade
- **Configuration:**
  ```typescript
  env.allowLocalModels = false;
  env.remoteHost = 'http://localhost:3000/models/';
  ```
- **Provider Logic:**
  - **Browser:** Transformers.js pipeline with mean pooling + normalization
  - **Ollama:** Delegates to `OllamaService.getEmbeddings()`
  - **OpenAI:** Not directly supported (uses Ollama/Browser fallback)
- **Methods:**
  - `initModel(modelId)` - Load browser model (lazy)
  - `getEmbedding(text)` - Returns `number[]` array

#### 4. **LocalExtractionService** (`local-extraction.service.ts`)
- **Role:** Multi-provider chat/extraction facade
- **WebLLM Lifecycle:**
  - Engine creation: `CreateMLCEngine(modelId, { initProgressCallback })`
  - Model switching: Try `engine.reload(modelId)`, fallback to recreate
  - Error recovery: Unload engine, 500ms delay, create new
- **Provider Delegation:**
  - **Browser:** WebLLM chat completion with JSON parsing
  - **Ollama:** `OllamaService.generate()`
  - **OpenAI:** `OpenAIService.generate()`
- **Extraction Prompt:**
  - System: "Extract structured data, return JSON only"
  - User: Field specs (fullName, email, skills, experience, education, certifications) + CV text
  - Temperature: 0.1 (deterministic)
  - Retry logic with JSON validation

#### 5. **StorageService** (`storage.service.ts`)
- **IndexedDB Schema:**
  ```typescript
  Database: 'ai-vector-db', version: 4
  ObjectStore: 'documents', keyPath: 'requestId'
  Index: 'by-timestamp' on timestamp field
  
  Document {
    requestId: string;        // UUID v4
    doc_location: string;     // Original filename
    doc_vector: number[];     // Full document embedding
    user_data: any;           // Extracted JSON
    user_data_vector: number[]; // JSON embedding
    fileType: string;         // 'pdf' | 'docx' | 'txt' | 'md' | 'json'
    timestamp: number;        // Date.now()
  }
  ```
- **Methods:**
  - `storeDocument(...)` - Insert/update
  - `getAllDocuments()` - Fetch all
  - `deleteDocument(requestId)` - Remove by ID
  - `importDocuments(documents[])` - Batch import with transaction

#### 6. **FileParsingService** (`file-parsing.service.ts`)
- **Supported Formats:** PDF, DOCX, DOC, TXT, MD, JSON
- **Methods:**
  - `parseFile(file: File): Promise<string>`
  - Private: `parsePdf()`, `parseDocx()`, `readTextFile()`
- **PDF.js Configuration:**
  - Worker: `pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs'`
  - Page-by-page text extraction with concatenation

### Frontend Components (`frontend/web/src/app/components/`)

#### **AppComponent** (`app.component.ts`)
- **Role:** Main orchestrator, Service integration, High-level state management
- **Delegates to:**
  - `ModelSelectComponent` (UI): Model dropdowns & actions
  - `FileUploaderComponent` (UI): File input & progress visualization
  - `DocumentListComponent` (Feature): Accordion view of processed CVs
  - `ModelConfigComponent` (Feature): Settings container
    - `BrowserConfigComponent`
    - `OllamaConfigComponent`
    - `OpenAiConfigComponent`

#### **AppComponent State**
- **Key State:**
  - `documents: any[]` - In-memory cache of stored documents
  - `steps: ProgressStep[]` - Pipeline step tracking
  - `progressPercent: number` - Global progress (0-100)
  - `selectedProvider: ModelProvider` - 'browser' | 'ollama' | 'openai'
  - `isPullingEmbedding/Chat: boolean` - Download flags
  - `embeddingPullProgress / chatPullProgress` - Progress objects with digest tracking
- **Automated Pipeline (onFileSelected):**
  1. **Parse File:** Extract text via FileParsingService
  2. **Load Models:** Initialize chat + embedding models (if not cached/installed)
  3. **Extract Data:** Call LocalExtractionService with CV text
  4. **Generate Doc Vector:** Embed full document text
  5. **Generate Data Vector:** Embed extracted JSON string
  6. **Store:** Save to IndexedDB via StorageService
- **Multi-Layer Progress Tracking:**
  ```typescript
  const digestProgress = new Map<string, number>();
  
  for await (const _ of ollamaService.pullModel(modelId, (completed, total, digest, status) => {
    if (digest) {
      digestProgress.set(digest, completed);
    }
    
    const totalDownloaded = Array.from(digestProgress.values()).reduce((a, b) => a + b, 0);
    const totalSize = total * digestProgress.size;
    const percent = Math.min(100, Math.round((totalDownloaded / totalSize) * 100));
    
    // Handle special statuses
    if (status === 'verifying' || status === 'writing manifest') {
      percent = 100; // or maintain last known value
    }
  })) {}
  ```
- **UI Features:**
  - Provider tabs (Browser/Ollama/OpenAI)
  - Model dropdowns with Installed/Available grouping
  - Download buttons (disabled for installed models)
  - Real-time progress bars (pipeline + model downloads)
  - Document accordion with SVG file icons
  - Export/Import functionality

### Backend (`backend/`)

#### **Express Server** (`server.js`)
- **Endpoints:**
  - `GET /models/*` - Proxy Hugging Face requests for Transformers.js
    - Adds Authorization header (Bearer token)
    - Streams response with preserved headers
  - `POST /upload` - Multer file upload
    - Saves to `uploads/` with timestamp prefix
    - Returns `{ filename, path, originalname }`
  - `POST /extract` - MCP-based extraction
    - Body: `{ text: string }`
    - Returns: Extracted JSON or `{ error }`
- **Middleware:**
  - CORS enabled
  - JSON body parser (10MB limit)
  - Multer disk storage

#### **MCP Server** (`mcp-server.js`)
- **Tool:** `extract_cv_data`
- **LLM:** OpenAI gpt-4o-mini (hardcoded API key)
- **Prompt Engineering:**
  - System: "Extract structured data, return JSON only"
  - User: Field list + CV text (truncated to 10k chars)
  - Temperature: 0.1
- **Response Cleaning:**
  - Strip markdown code blocks (```json)
  - Parse JSON with error recovery
  - Return `{ raw_text, error }` on parse failure

## Key Features & Patterns

### Automated Processing Pipeline
- **Trigger:** File selection in input
- **Flow:** Parse → Load → Extract → Vectorize (2x) → Store
- **Progress Tracking:** 6-step ProgressStep array with status icons
- **Error Handling:** Step-level error status with graceful degradation

### Multi-Provider Architecture
- **Single Interface:** Services provide unified API
- **Provider Detection:** Check `ModelRegistryService.selectedProvider$`
- **Conditional Logic:** Switch/case based on provider in service methods
- **State Persistence:** Provider + model selections saved to localStorage

### UI Components
- **Progress Bar:** Horizontal bar + expandable `<details>` with step list
- **File Icons:** Dynamic SVG with color-coded type badges
  - PDF: Red (#dc3545)
  - DOCX: Blue (#007bff)
  - TXT: Gray (#6c757d)
  - MD: Purple (#6f42c1)
  - JSON: Green (#28a745)
- **Accordion:** Collapsible document cards with summary + detail view
- **Settings Panel:** Collapsible with tab navigation

## Common Tasks & Patterns

### Adding New File Type
1. Update `FileParsingService.parseFile()` switch statement
2. Add parser method (e.g., `private parseXml()`)
3. Update `AppComponent.getFileColor()` for icon color
4. Add file extension to input `accept` attribute

### Modifying Extraction Fields
1. Backend: Update prompt in `mcp-server.js`
2. Frontend: Update UI template in `AppComponent` (document detail section)
3. Adjust validation in `LocalExtractionService.extractData()`

### Adding New AI Provider
1. Create service (e.g., `AnthropicService`)
2. Add provider to `ModelProvider` type in `ModelRegistryService`
3. Add model configs to `ModelRegistryService` arrays
4. Update `EmbeddingService` and `LocalExtractionService` with provider cases
5. Add UI tab in `AppComponent` template
6. Add configuration inputs (API key, URL, etc.)

## Critical Gotchas

### 1. Ollama Multi-Layer Downloads
- **Issue:** Progress resets for each layer, causing UI jumps
- **Solution:** Track per-digest progress, aggregate totals
- **Reference:** `AppComponent.pullOllamaModel()` and `AppComponent.downloadChatModel()`

### 2. WebLLM Engine State
- **Issue:** GPU state persists between model loads
- **Solution:** Try reload first, recreate on failure, add 500ms delay
- **Reference:** `LocalExtractionService.initialize()`

### 3. IndexedDB Version Upgrades
- **Issue:** Schema changes require migration
- **Current Approach:** Drop and recreate store (data loss acceptable in dev)
- **Reference:** `StorageService` constructor upgrade callback

### 4. Transformers.js CORS
- **Issue:** Direct HF requests fail due to CORS + auth
- **Solution:** Backend proxy at `/models/*` adds auth, enables CORS
- **Reference:** `server.js` proxy endpoint, `embedding.service.ts` env config

### 5. Angular Build Failure (sharp/onnxruntime)
- **Issue**: Build fails resolving Node modules (`sharp`, `fs`, `path`) from transformers.js
- **Solution**: Mock in `tsconfig.json` paths + `package.json` browser field + `src/app/mocks/sharp.mock.ts`
- **Reference**: `tsconfig.json` ("paths"), `package.json` ("browser")

### 6. Progress Callback Timing
- **Issue:** High-frequency callbacks can freeze UI
- **Solution:** Debounce updates, use `Math.min(100, ...)` to cap percent
- **Reference:** All progress tracking code

## Development Commands
- **Frontend:** `cd frontend/web && npm start` → http://localhost:4200
- **Backend:** `cd backend && npm start` → http://localhost:3000
- **Ollama:** `ollama serve` (required for Ollama mode)

## Testing Scenarios
1. **Browser Mode:** Upload CV, observe WebLLM download progress, verify IndexedDB storage
2. **Ollama Mode:** Start Ollama, refresh library, download model, upload CV
3. **OpenAI Mode:** Enter API key, select model, upload CV, verify extraction quality
4. **Export/Import:** Export database, clear IndexedDB (DevTools), import, verify restoration
5. **Error Handling:** Stop Ollama mid-process, observe error status, retry
