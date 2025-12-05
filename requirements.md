# CV Parser - Project Requirements & Specifications

## 1. Project Overview

**CV Parser** is a multi-provider, privacy-focused web application designed to automate the processing, analysis, and storage of Curriculum Vitae (CV) documents. It supports three AI provider modes: Browser-based (WebLLM/Transformers.js), Local (Ollama), and Cloud (OpenAI), giving users flexibility in choosing their preferred AI backend while maintaining optional local-first capabilities.

## 2. Technology Stack

- **Frontend**: Angular 17+ (Standalone Components, RxJS Observables, CommonModule, FormsModule)
- **Backend**: Node.js with Express (Model proxy, file upload handler, MCP server integration)
- **AI/ML Providers**:
  - **Browser**: WebLLM (Chat), Transformers.js (Embeddings)
  - **Ollama**: Local LLM execution (Chat & Embeddings) via REST API
  - **OpenAI**: Cloud-based GPT models via API
- **File Parsing**: 
  - PDF: `pdfjs-dist` (v5.4.449)
  - DOCX/DOC: `mammoth` (v1.11.0)
  - Text formats: Native FileReader API
- **Styling**: Vanilla CSS (Premium, responsive design)
- **Storage**: IndexedDB via `idb` library (v8.0.0) for structured document storage with vector embeddings

## 3. Key Features

### 3.1 Multi-Provider AI Architecture

- **Provider Selection**: Users can switch between Browser, Ollama, and OpenAI providers via UI tabs
- **Browser Mode**:
  - Runs entirely client-side using WebGPU
  - No external API calls for inference
  - Models downloaded once and cached
  - Chat: WebLLM (Phi-3, Llama-3)
  - Embeddings: Transformers.js (MiniLM, GTE)
- **Ollama Mode**:
  - Connects to local Ollama instance (default: http://localhost:11434/api)
  - Supports optional API key authentication
  - Dynamic model library fetching from backend proxy
  - Real-time model download with multi-layer progress tracking
  - Chat & Embedding model management
- **OpenAI Mode**:
  - Cloud-based inference via OpenAI API
  - API key stored in localStorage
  - Models: GPT-4o-mini, GPT-4o, GPT-3.5-turbo

### 3.2 Document Processing Pipeline

- **Upload**: Supports PDF, DOCX, DOC, TXT, MD, JSON formats
- **Parsing**:
  - Frontend service extracts raw text from all formats
  - PDF.js worker configured for async PDF processing
  - Mammoth.js for DOCX binary parsing
- **Automated Workflow**:
  1. File Upload & Type Detection
  2. Text Extraction
  3. Model Loading (if not cached/installed)
  4. Structured Data Extraction via LLM
  5. Dual Vector Generation (Document Text + Extracted JSON)
  6. IndexedDB Storage with Metadata

### 3.3 Model Management

- **Model Registry Service**:
  - Centralized configuration for all providers
  - Provider-specific model catalogs
  - Persistent selection via localStorage
- **Download Manager (Ollama)**:
  - Explicit "Download" buttons for uninstalled models
  - **Multi-layer Progress Tracking**: Tracks download progress by layer digest to ensure smooth 0-100% progress bars without jumps
  - Real-time status updates (Status messages, download speed, completion percentage)
  - Handles "verifying" and "writing manifest" states
- **Cache Detection (Browser)**:
  - WebLLM cache checking for browser models
  - Visual indicators for cached models
- **Installation Detection (Ollama)**:
  - Grouping of installed vs. available models
  - Refresh capability to update library

### 3.4 Data Management & Storage

- **IndexedDB Architecture**:
  - Database: `ai-vector-db` (version 4)
  - Object Store: `documents` (keyPath: `requestId`)
  - Schema:

    ```typescript
  
    {
      requestId: string;        // UUID v4
      doc_location: string;     // Original filename
      doc_vector: number[];     // Full document embedding
      user_data: any;           // Extracted structured data (JSON)
      user_data_vector: number[]; // Extracted data embedding
      fileType: string;         // 'pdf', 'docx', 'txt', 'md', 'json'
      timestamp: number;        // Unix timestamp
    }
    ```

  - Index: `by-timestamp` for chronological queries
- **Import/Export**:
  - Full database export to JSON file
  - Batch import with transaction safety
  - Preserves all vectors and metadata
- **CRUD Operations**:
  - Create: Atomic document insertion
  - Read: Get all documents, get by ID
  - Delete: Individual document removal

### 3.5 User Interface Design

- **Premium Aesthetic**:
  - Clean, modern design with consistent spacing
  - Color-coded file type indicators
  - Smooth transitions and hover effects
  - Responsive layout (max-width: 800px centered container)
- **Provider Configuration Panel**:
  - Collapsible settings section
  - Tab-based provider selection
  - Inline API key/URL configuration
  - Model selection dropdowns with grouping (Installed/Available)
- **Real-time Progress Indicators**:
  - Main pipeline progress bar (0-100%)
  - Expandable step-by-step details with status icons (✓/⏳/✗/○)
  - Model loading progress overlay
  - Download progress bars for Ollama models
- **Document Accordion**:
  - Collapsible document cards with summary header
  - Dynamic SVG file type icons with color coding
  - Inline structured data display (Name, Email, Skills, Experience)
  - Vector preview (first 5 dimensions)
  - Delete functionality with confirmation
- **Interactive Elements**:
  - File type color mapping (PDF: red, DOCX: blue, TXT: gray, MD: purple, JSON: green)
  - Disabled states during processing
  - Tooltips and helper text
  - Import/Export controls

## 4. Technical Specifications

### 4.1 Service Architecture

#### 4.1.1 AppComponent (`app.component.ts`)

- **Role**: Main orchestrator and UI controller
- **Key Responsibilities**:
  - File upload handling and type detection
  - Progress tracking and UI state management
  - Model download orchestration (multi-layer progress calculation)
  - Document lifecycle management (load, display, delete)
  - Provider switching coordination
- **State Management**:
  - `documents: any[]` - In-memory document cache
  - `steps: ProgressStep[]` - Pipeline step tracking
  - `progressPercent: number` - Global progress
  - Provider-specific model lists and selection states
  - Download progress tracking objects (with digest-based calculation)

#### 4.1.2 EmbeddingService (`embedding.service.ts`)

- **Role**: Multi-provider embedding generation facade
- **Configuration**:
  - Transformers.js environment configured to use backend proxy
  - `env.remoteHost = 'http://localhost:3000/models/'`
- **Provider Handling**:
  - Browser: Pipeline-based feature extraction with pooling/normalization
  - Ollama: Delegates to OllamaService.getEmbeddings()
  - OpenAI: Not directly supported for embeddings (uses Ollama/Browser)
- **Features**:
  - Lazy model initialization
  - Progress callbacks for browser model loading
  - Model caching and reuse

#### 4.1.3 LocalExtractionService (`local-extraction.service.ts`)

- **Role**: Multi-provider chat/extraction facade
- **Provider Handling**:
  - Browser: WebLLM engine management with reload support
  - Ollama: Delegates to OllamaService.generate()
  - OpenAI: Delegates to OpenAIService.generate()
- **WebLLM Lifecycle**:
  - Engine creation with progress callbacks
  - Reload optimization for model switching
  - Error recovery and engine recreation
  - GPU reset delay handling
- **Extraction Logic**:
  - Structured prompt engineering for CV parsing
  - JSON validation and error handling
  - Retry mechanism with fallback

#### 4.1.4 OllamaService (`ollama.service.ts`)

- **Endpoints**:
  - `/api/tags` - List installed models
  - `/api/pull` - Download models with streaming progress
  - `/api/generate` - Chat completion
  - `/api/embeddings` - Generate embeddings
- **Model Library**:
  - Fetches recommended models from backend proxy (`/ollama/library`)
  - Fallback to hardcoded model list
  - Merges installed + available models
- **pullModel Method**:
  - **Critical**: Streams progress events with `digest` field for layer tracking
  - Returns AsyncGenerator for real-time progress updates
  - Handles status states: "pulling", "verifying", "writing manifest", "success"
  - Callback signature: `(completed: number, total: number, digest?: string, status?: string) => void`
- **API Configuration**:
  - Configurable base URL
  - Optional API key authentication
  - Custom headers injection

#### 4.1.5 ModelRegistryService (`model-registry.service.ts`)

- **Role**: Centralized model catalog and state management
- **Data Structures**:
  - Static model definitions for Browser, Ollama (base list)
  - Dynamic Ollama model updates via service integration
  - RxJS BehaviorSubjects for reactive updates
- **Persistence**:
  - localStorage keys:
    - `selectedProvider` - Active provider
    - `selectedEmbeddingModel` - Embedding model ID
    - `selectedChatModel` - Chat model ID
    - `openaiApiKey` - OpenAI API key (if configured)
    - `ollamaApiUrl` - Custom Ollama URL
    - `ollamaApiKey` - Ollama authentication key
- **Methods**:
  - Provider switching with model list updates
  - Model selection persistence
  - Cache/Installation status tracking
  - Config getters/setters

#### 4.1.6 StorageService (`storage.service.ts`)

- **IndexedDB Operations**:
  - Database initialization with schema upgrades
  - Store management (clear old stores on upgrade)
  - CRUD methods:
    - `storeDocument()` - Insert/update single document
    - `getAllDocuments()` - Fetch all documents
    - `deleteDocument()` - Remove by requestId
    - `importDocuments()` - Batch import with transaction
- **Schema Evolution**:
  - Version 4 (current): Full vector support with fileType
  - Upgrade strategy: Delete and recreate store (data loss acceptable for demo)

#### 4.1.7 FileParsingService (`file-parsing.service.ts`)

- **PDF Parsing**:
  - PDF.js worker configuration: `./assets/pdf.worker.min.mjs`
  - Page-by-page text extraction
  - Text content item concatenation
- **DOCX Parsing**:
  - Mammoth.js raw text extraction
  - ArrayBuffer-based processing
- **Text File Parsing**:
  - FileReader for TXT, MD, JSON
  - Promise-based async reading

### 4.2 Backend Architecture

#### 4.2.1 Express Server (`server.js`)

- **Endpoints**:
  - `GET /models/*` - Hugging Face model proxy for Transformers.js
    - Forwards requests to huggingface.co with authentication
    - Streams responses with preserved headers
  - `POST /upload` - Multer-based file upload
    - Saves files to `uploads/` directory with timestamp prefix
    - Returns file metadata (filename, path, originalname)
  - `POST /extract` - MCP-based structured data extraction
    - Accepts `{ text: string }` payload
    - Delegates to CvExtractionServer.process()
    - Returns extracted JSON or error
- **Middleware**:
  - CORS enabled for frontend access
  - JSON body parser (10MB limit)
  - Multer disk storage configuration

#### 4.2.2 MCP Server (`mcp-server.js`)

- **Model Context Protocol Implementation**:
  - Tool: `extract_cv_data`
  - Input Schema: `{ text: string }`
  - Output: Structured JSON with CV fields
- **LLM Integration**:
  - OpenAI API (gpt-4o-mini)
  - System prompt: "Extract structured data, return JSON only"
  - User prompt: Detailed field specification + resume text
  - Temperature: 0.1 (deterministic)
- **Response Handling**:
  - Markdown code block cleanup
  - JSON parsing with error recovery
  - Returns `{ raw_text, error }` on parse failure

### 4.3 Critical Implementation Details

#### 4.3.1 Ollama Model Downloads - Multi-Layer Progress

**Problem**: Ollama downloads models in multiple layers (blobs). Each layer has its own progress stream that resets from 0-100%. Naively displaying `completed/total` causes progress bar jumping.

**Solution**: Track progress per `digest` (layer identifier) and aggregate:

```typescript
// Map to store cumulative progress per digest
const digestProgress = new Map<string, number>();

ollamaService.pullModel(modelId, (completed, total, digest, status) => {
  if (digest) {
    // Store progress for this specific layer
    digestProgress.set(digest, completed);
  }
  
  // Calculate total progress across all layers
  const totalDownloaded = Array.from(digestProgress.values())
    .reduce((sum, val) => sum + val, 0);
  
  // Total size = current total * number of unique digests seen
  const totalSize = total * digestProgress.size;
  
  const percent = totalSize > 0 
    ? Math.min(100, Math.round((totalDownloaded / totalSize) * 100))
    : 0;
});
```

**Status Handling**:

- "pulling": Normal download, show progress
- "verifying": Force 100% or maintain last percentage
- "writing manifest": Force 100%
- "success": Complete, hide progress

#### 4.3.2 WebLLM Engine Management

**Challenge**: GPU state persistence and model switching

**Strategies**:

1. **Reload Pattern**: Try `engine.reload(newModelId)` before recreating
2. **Error Recovery**: On reload failure, unload and create new engine
3. **GPU Reset Delay**: 500ms delay after unload before creating new engine
4. **Progress Callbacks**: Wire through to UI for user feedback

#### 4.3.3 Transformers.js Backend Proxy

**Purpose**: Bypass CORS and Hugging Face authentication requirements

**Configuration**:

```typescript
env.allowLocalModels = false;
env.remoteHost = 'http://localhost:3000/models/';
```

**Request Flow**:

1. Transformers.js requests `/Xenova/model-name/resolve/main/file.json`
2. Backend proxies to `https://huggingface.co/Xenova/model-name/resolve/main/file.json`
3. Backend adds `Authorization: Bearer <HF_TOKEN>` header
4. Response streamed back to client

#### 4.3.4 IndexedDB Schema Upgrades

**Current Version**: 4

**Upgrade Logic**:

```typescript
upgrade(db, oldVersion, newVersion, transaction) {
  // Drop old store to ensure clean schema
  if (db.objectStoreNames.contains('documents')) {
    db.deleteObjectStore('documents');
  }
  
  // Recreate with current schema
  const store = db.createObjectStore('documents', { keyPath: 'requestId' });
  store.createIndex('by-timestamp', 'timestamp');
}
```

**Trade-off**: Data loss on version upgrade (acceptable for demo/development phase)

## 5. Use Cases & User Stories

### 5.1 User Persona: An unemloyed technical Privacy-Conscious person

#### Use Case 1.1: Process Candidate CVs Locally

**Goal**: Extract structured data from CVs without sending to cloud

**User Story 1.1.1: Configure Local Ollama**:

- **As** an unemloyed technical Privacy-Conscious person
- **I want to** use my locally running Ollama instance
- **So that** I can upload and process offline CVs without using paid cloud LLMs and without requiring internet

**Acceptance Criteria**:

- Can configure custom Ollama URL
- Can verify connection status
- Can see list of installed models
- Can download new models with progress tracking

**Tasks**:

1. Open Settings panel
2. Select "Ollama (Local)" tab
3. Verify default URL (http://localhost:11434/api)
4. Click "Refresh Library" to sync model list
5. System groups models into "Installed" and "Available to Download"

**User Story 1.1.2: Download Required Models**:

- **As** an unemloyed technical Privacy-Conscious person
- **I want to** download AI models once
- **So that** I can upload and process CVs offline without using paid cloud LLMs and without requiring internet

**Acceptance Criteria**:

- Can select chat models that are **Available to Download** (not available offline or not yet pulled from ollama)
- Can select embedding models that are **Available to Download** (not available offline or not yet pulled from ollama)
- Download button only enabled for models the are **Available to Download** (not available offline or not yet pulled from ollama)
- See real-time progress (0-100%)
- See status messages
  - pulling/verifying/success
  - total size of the model, how much have been downloaded
  - download sped
- Models persist across sessions

**Tasks**:

1. Select "nomic-embed-text" from Embedding dropdown
2. Click "Download" button
3. Observe multi-layer progress bar
4. Wait for "Success" status
5. Repeat for chat model (e.g., "llama3:8b")

**User Story 1.1.3: Delete Installed Models**:

- **As** an unemployed technical Privacy-Conscious person
- **I want to** delete installed models safely
- **So that** I can free up disk space without accidentally removing models I need

**Acceptance Criteria**:

- "Delete" button visible for installed models
- "Delete" button enabled only when model is installed
- **2-Step Confirmation**:
  - First click changes button text to "Confirm?" (Red warning state)
  - Second click (within 3 seconds) triggers deletion
  - If no second click, button reverts to "Delete"
- UI shows "Deleting..." status during removal
- Dropdowns disabled during deletion
- After deletion, model moves to "Available to Download" list

**Tasks**:

1. Select installed model
2. Click "Delete" -> Verify button changes to "Confirm?"
3. Click "Confirm?" -> Verify "Deleting..." status
4. Verify model removed and "Download" button enabled

**User Story 1.1.4: Upload and Process CV**:

- **As** an unemloyed technical Privacy-Conscious person
- **I want to** upload my CV
- **So that** I can extract structured information automatically

**Acceptance Criteria**:

- Can upload PDF, DOCX, TXT, MD, JSON files
- See file type icon immediately after selection
- See progress bar with 6 steps:
  1. Parsing File
  2. Loading Models
  3. Extracting Structured Data
  4. Generating Document Vector
  5. Generating Data Vector
  6. Storing in Database
- Each step shows status: Pending (○) / Loading (⏳) / Completed (✓) / Error (✗)
- Final result stored in IndexedDB with all vectors

**Tasks**:

1. Click file input
2. Select CV file (e.g., "John_Doe_Resume.pdf")
3. System auto-starts processing
4. Expand progress details to see step status
5. Wait for 100% completion
6. Verify document appears in accordion below

### 5.2 User Persona: An unemployed non-technical person

#### Use Case 2.1: Use Browser-Based AI (No Server Required)

**Goal**: Process CVs entirely in browser without technical setup or costs

**User Story 2.1.1: Configure Browser Mode**:

- **As** an unemployed non-technical person
- **I want to** run AI entirely in browser
- **So that** I don't need to install servers or pay for API calls and can process my CV without technical knowledge

**Acceptance Criteria**:

- Can use browser-based LLMs without installing any additional software
- Leverage WebGPU for AI response generation (if browser supports it)
- See model sizes (2-4GB) and estimated download times before download
- Models download once and cache locally in the browser
- Works offline after initial model download

**Tasks**:

1. Open Settings panel
2. Click "Browser (Beta)" tab
3. Read WebGPU requirement notice
4. Select "Phi-3 Mini (3.8B)" for chat
5. Upload first CV to trigger model download
6. See "Model Loading: Downloading [model-name]..." overlay

**User Story 2.1.2: Offline Processing**:

- **As** an unemployed non-technical person
- **I want to** process my CV without internet
- **So that** I can work on my CV anywhere without worrying about connectivity or data costs

**Acceptance Criteria**:

- Models cached after first download (✅ Cached indicator)
- Can upload and process with no network
- All processing happens client-side
- Results stored in IndexedDB (persistent across sessions)

**Tasks**:

1. Disconnect from internet
2. Refresh page (models already cached)
3. Upload CV
4. Processing succeeds without network calls

### 5.3 User Persona: A tech-savvy job seeker with access to cloud AI

#### Use Case 3.1: Use Cloud AI for Best Results

**Goal**: Get highest quality CV parsing using cloud-based AI models

**User Story 3.1.1: Configure OpenAI API**:

- **As** a tech-savvy job seeker with OpenAI API access
- **I want to** use GPT-4 for extraction
- **So that** I get the highest quality structured data from my CV with minimal errors

**Acceptance Criteria**:

- Can select "OpenAI (Cloud)" tab
- Can enter API key securely (masked input)
- Key persists in localStorage for future sessions
- Can select from GPT models (4o-mini, 4o, 3.5-turbo)
- See clear instructions on how to obtain an API key

**Tasks**:

1. Open Settings panel
2. Click "OpenAI (Cloud)" tab
3. Enter API key (sk-...)
4. Click "Save"
5. Select "gpt-4o-mini" from Chat Model dropdown
6. Upload CV for processing

**User Story 3.1.2: Multiple Document Processing with Export**:

- **As** a tech-savvy job seeker
- **I want to** process multiple versions of my CV and export results
- **So that** I can compare different CV formats and keep a backup of extracted data

**Acceptance Criteria**:

- Can upload CV documents sequentially (one at a time currently)
- All documents stored in browser's IndexedDB
- Can export all documents to JSON file for backup
- JSON includes all fields (vectors, metadata, extracted data)
- Can import JSON back to restore database on different device or browser

**Tasks**:

1. Upload first CV version (e.g., "CV_2025_Tech.pdf"), wait for completion
2. Upload second CV version (e.g., "CV_2025_General.docx"), wait for completion
3. Upload third CV version (e.g., "CV_2024_Archive.pdf"), wait for completion
4. Click "Export Data" button
5. JSON file downloaded with all 3 document versions
6. Open in another browser or device, click "Import Data"
7. Select exported JSON file
8. All 3 CV versions restored with extracted data

### 5.4 Cross-Cutting Use Cases

#### Use Case 4.1: Document Management

**User Story 4.1.1: View Stored Documents**:

- **As** any user
- **I want to** see all my processed CV documents
- **So that** I can review and manage different versions of my CV

**Acceptance Criteria**:

- See document count in header (e.g., "Stored Documents (3)")
- Each document shows:
  - File type icon (color-coded for PDF, DOCX, TXT, etc.)
  - Name extracted from CV
  - Document ID (first 8 chars)
  - Delete button
- Can expand to see full details:
  - Original filename
  - Full name
  - Email
  - Skills (comma-separated list)
  - Experience (formatted cards with company/role/dates)
  - Vector preview (first 5 dimensions for technical users)

**Tasks**:

1. Scroll to "Stored Documents" section
2. See count: "Stored Documents (3)"
3. Each document is a collapsible card
4. Click summary to expand
5. See all extracted fields
6. See vector previews at bottom

**User Story 4.1.2: Delete Unwanted Documents**:

- **As** any user
- **I want to** remove processed documents
- **So that** I can manage storage and privacy

**Acceptance Criteria**:

- Delete button visible in collapsed summary
- Click stops event propagation (doesn't expand card)
- Document immediately removed from UI
- Removed from IndexedDB permanently

**Tasks**:

1. Find document to delete
2. Click red "Delete" button
3. Document disappears from list
4. Count decrements
5. Refresh page - document still deleted

### 5.5 Error Handling & Edge Cases

#### Use Case 5.1: Handle Connection Failures

**User Story 5.1.1: Ollama Not Running**:

- **As** a user trying to use local AI
- **I want to** see clear error messages if Ollama is not running
- **So that** I know exactly what to do to fix the issue

**Acceptance Criteria**:

- "Refresh Library" shows error message
- Cannot download models
- Helper text: "Ensure Ollama is running ('ollama serve')"

**User Story 5.1.2: Invalid OpenAI Key**:

- **As** a user trying to use OpenAI
- **I want to** see clear error messages if my API key is wrong
- **So that** I can correct it and continue processing my CV

**Acceptance Criteria**:

- Extraction step shows error status (✗)
- Error message includes HTTP status
- Can edit key and retry

#### Use Case 5.2: Handle Unsupported Files

**User Story 5.2.1: Upload Invalid File**:

- **As** any user
- **I want to** see error for unsupported file types
- **So that** I know what formats work

**Acceptance Criteria**:

- File input restricts to: .txt, .md, .json, .pdf, .docx, .doc
- If bypass restriction, parsing step shows error
- Error message: "Unsupported file type: .xyz"

### 5.6 Advanced Features (Future)

#### Use Case 6.1: Semantic Search

**Status**: Schema ready, UI not implemented

**User Story 6.1.1: Search by Skills**:

- **As** a user with multiple CV versions stored
- **I want to** search through my documents using natural language queries
- **So that** I can quickly find which CV version emphasizes specific skills or experiences

**Acceptance Criteria**:

- Search input generates query vector
- Cosine similarity calculated against all doc_vectors
- Results ranked by similarity score
- Top N results displayed

#### Use Case 6.2: Job Description Matching

**Status**: Planned

**User Story 6.2.1: Match CV to Job Description**:

- **As** a job seeker
- **I want to** paste a job description and compare it with my CV
- **So that** I can see how well my CV matches the job requirements and which version is best suited

**Acceptance Criteria**:

- JD text field in UI
- Vector generated for JD
- Similarity calculated against user_data_vectors
- Results show match percentage

## 6. Technical Requirements

### 6.1 Performance Requirements

- **Model Loading**: Should complete within 60s for browser models (4GB)
- **Document Processing**: Should complete within 10s for typical CV
- **UI Responsiveness**: Progress updates every 500ms minimum
- **Storage Capacity**: Support 100+ documents without performance degradation

### 6.2 Security Requirements

- **API Keys**: Stored in localStorage (user responsibility for key security)
- **Data Isolation**: IndexedDB sandboxed per origin
- **No Telemetry**: No data sent to external services except user-configured APIs

### 6.3 Compatibility Requirements

- **Browsers**: Chrome 113+, Edge 113+ (WebGPU required for browser mode)
- **Node.js**: v18+ for backend
- **Ollama**: v0.1.0+ for local mode

### 6.4 Functional Requirements

- **FR1**: System shall support three AI provider modes (Browser, Ollama, OpenAI)
- **FR2**: System shall parse PDF, DOCX, TXT, MD, JSON files
- **FR3**: System shall extract: fullName, email, skills, experience, education, certifications
- **FR4**: System shall generate embeddings for document text and extracted JSON
- **FR5**: System shall store all data in IndexedDB with vector fields
- **FR6**: System shall support full database export/import via JSON
- **FR7**: System shall track model download progress with multi-layer aggregation

## 7. Future Roadmap

- **Phase 2 (Q1 2026)**:
  - Semantic search UI implementation
  - Batch upload (multiple files at once)
  - Job description matching interface
- **Phase 3 (Q2 2026)**:
  - Comparison view (side-by-side candidates)
  - Advanced filtering (experience years, skills, etc.)
  - PDF export of candidate summaries
- **Phase 4 (Q3 2026)**:
  - Real-time collaboration features
  - ATS integration plugins
  - Custom extraction templates

### 5.7 UI Refinements

#### Use Case 7.1: Model Configuration Order

**User Story 7.1.1: Chat Model First**:

- **As** a user
- **I want** the "Chat Model" configuration to be displayed before the "Embedding Model" configuration within the "Model Configuration" panel
- **So that** the order is more intuitive, as the chat model is often configured before the embedding model in typical workflows

**Acceptance Criteria**:

- When the "Model Configuration" panel is expanded, the "Chat Model (Data Extraction)" section and its controls appear above the "Embedding Model (Vector Search)" section.

**Tasks**:

- [x] Modify the HTML template to reorder the model sections.
- [x] Verify the change in the browser.

#### Use Case 7.2: Clean Model Configuration UI

**User Story 7.2.1: Simplified Labels and Layout**:

- **As** a user
- **I want** a clean and uncluttered configuration panel
- **So that** I can easily scan and select models without distraction

**Acceptance Criteria**:

- "Chat Model" label does not contain "(Data Extraction)".
- "Embedding Model" label does not contain "(Vector Search)".
- Helper text "Used to convert text into vectors..." is removed.
- "Ensure Ollama is running..." note is moved to the bottom of the panel.

**Tasks**:

- [x] Update `app.component.ts` to move Ollama note to bottom.
- [x] Update `app.component.ts` to remove label suffixes and helper text.
- [x] Verify changes with browser test.

#### Use Case 7.3: Download Cancellation

**User Story 7.3.1: Cancel Model Download**:

- **As** a user
- **I want** to be able to cancel a model download in progress
- **So that** I can stop an accidental download or retry a stuck one without refreshing the page

**Acceptance Criteria**:

- When "Download" is clicked, the button is replaced by a "Cancel" button.
- Clicking "Cancel" stops the download immediately.
- The UI reverts to the "Download" state (button reappears, progress bar clears).
- Works for both Chat and Embedding models.

**Tasks**:

- [x] Update `OllamaService` to support `AbortSignal`.
- [x] Update `AppComponent` to implement cancel logic and UI toggling.
- [x] Verify with browser test.

#### Use Case 7.4: Context-Aware Action Buttons

**User Story 7.4.1: Dynamic Download/Delete**:

- **As** a user
- **I want** to see only the relevant action button for the selected model
- **So that** the interface is cleaner and less confusing

**Acceptance Criteria**:

- If the selected model is **Installed**: Show "Delete" button. Hide "Download".
- If the selected model is **Not Installed**: Show "Download" button. Hide "Delete".
- If a download is **In Progress**: Show "Cancel" button. Hide others.
- Applies to both Chat and Embedding models.

**Tasks**:

- [x] Update `AppComponent` template logic.
- [x] Update `isModelInstalled` logic to handle missing models correctly.
- [x] Verify with browser test.

#### Use Case 7.5: Consistent UI Layout

**User Story 7.5.1: Fixed Width Controls**:

- **As** a user
- **I want** the action buttons and dropdowns to maintain a consistent size and alignment
- **So that** the UI doesn't jump or shift when I switch between different models or states

**Acceptance Criteria**:

- Action buttons (Download, Cancel, Delete) have a fixed width (e.g., 100px).
- Button text is centered.
- Dropdowns take up the remaining available width.
- Layout remains stable when toggling between states.

**Tasks**:

- [x] Apply fixed width and centering styles to buttons in `AppComponent`.
- [x] Verify layout stability with browser test.
