# Agent Instructions - CV Parser

> **📖 Master Architecture:** See [../ARCHITECTURE.md](../ARCHITECTURE.md) for complete technical reference.
> **🤖 This Document:** AI agent-specific implementation guidance and patterns.

## Project Overview
CV Parser is a multi-provider web application for processing and analyzing CVs using browser-based AI (WebLLM/Transformers.js), local AI (Ollama), or cloud AI (OpenAI).

## Technology Stack
- **Frontend**: Angular 17+ (Standalone Components, RxJS Observables)
- **Backend**: Node.js (Express)
- **AI Providers**: 
  - Browser: WebLLM (Chat), Transformers.js (Embeddings)
  - Ollama: Local REST API for Chat & Embeddings
  - OpenAI: Cloud API for Chat
- **Storage**: IndexedDB (via `idb` v8.0.0)
- **File Parsing**: pdfjs-dist, mammoth, FileReader

## Critical Implementation Details

### Multi-Provider Architecture
The application supports three AI provider modes that users can switch between via tabs in the UI:

**Browser Mode**:
- WebLLM for chat completion (Phi-3, Llama-3)
- Transformers.js for embeddings (MiniLM, GTE)
- All processing happens client-side
- Models download once and cache in IndexedDB
- Requires WebGPU support
- No API keys needed

**Ollama Mode**:
- Connects to local Ollama instance (default: http://localhost:11434/api)
- Supports both chat and embedding models
- Dynamic model library fetching
- Optional API key authentication
- Real-time model download with multi-layer progress tracking

**OpenAI Mode**:
- Cloud-based chat completion (GPT-4o-mini, GPT-4o, GPT-3.5-turbo)
- API key stored in localStorage
- Falls back to Browser/Ollama for embeddings

### Service Architecture

**ModelRegistryService** - Centralized state management:
- Manages provider selection and model catalogs
- RxJS BehaviorSubjects for reactive updates
- localStorage persistence for all configuration
- Methods: `setProvider()`, `getCurrent*ModelId()`, `updateOllamaModels()`

**EmbeddingService** - Multi-provider facade:
- Delegates to correct provider based on ModelRegistry state
- Browser: Transformers.js pipeline with mean pooling + normalization
- Ollama: Direct API calls via OllamaService
- Configuration: `env.remoteHost = 'http://localhost:3000/models/'` for HF proxy

**LocalExtractionService** - Chat/extraction facade:
- WebLLM engine management with reload optimization
- Provider delegation (Browser/Ollama/OpenAI)
- Extraction prompt engineering with JSON validation
- Error recovery and retry logic

**StorageService** - IndexedDB operations:
- Schema version 4 with `documents` object store
- Document structure: requestId, doc_location, doc_vector, user_data, user_data_vector, fileType, timestamp
- Methods: storeDocument, getAllDocuments, deleteDocument, importDocuments
- Upgrade strategy: Drop and recreate store on version change

**FileParsingService** - File format handling:
- PDF: pdfjs-dist with worker configuration
- DOCX: mammoth for raw text extraction
- Text: FileReader for TXT, MD, JSON

**OllamaService** - Ollama API integration:
- Endpoints: /api/tags, /api/pull, /api/generate, /api/embeddings
- Model library fetching with fallback to static list
- Configurable base URL and API key

**OpenAIService** - OpenAI API integration:
- Chat completion with configurable model selection
- API key management
- JSON response parsing

### Ollama Model Downloads - Multi-Layer Progress Tracking
**Problem**: Ollama downloads models in multiple layers (blobs). Each layer has its own progress stream that resets from 0-100%. Naively displaying `completed/total` causes progress bar jumping.

**Solution**: Track progress per `digest` (layer identifier) and aggregate:

```typescript
// In AppComponent.downloadEmbeddingModel() or AppComponent.downloadChatModel()
const digestProgress = new Map<string, number>();

for await (const _ of this.ollamaService.pullModel(modelId, 
  (completed, total, digest, status) => {
    if (digest) {
      // Store cumulative progress for this specific layer
      digestProgress.set(digest, completed);
    }
    
    // Calculate total progress across all layers
    const totalDownloaded = Array.from(digestProgress.values())
      .reduce((sum, val) => sum + val, 0);
    
    // Total size = current layer total * number of unique digests seen
    const totalSize = total * digestProgress.size;
    
    // Calculate percentage, capped at 100
    const percent = totalSize > 0 
      ? Math.min(100, Math.round((totalDownloaded / totalSize) * 100))
      : 0;
    
    // Update progress object
    this.embeddingPullProgress.percent = percent;
    
    // Handle special statuses
    if (status === 'verifying' || status === 'writing manifest') {
      this.embeddingPullProgress.percent = 100;
      this.embeddingPullProgress.status = status;
    }
  }
)) {
  // Generator yields on each progress update
}
```

**Status Handling**:
- "pulling": Normal download, show calculated progress
- "verifying": Force 100% or maintain last percentage
- "writing manifest": Force 100%
- "success": Complete, hide progress UI

**Critical**: The `OllamaService.pullModel()` method MUST pass the `digest` field from the Ollama API response to the progress callback. This is the only way to differentiate between layers.

### WebLLM Engine Management
**Challenge**: GPU state persistence, model switching, and error recovery

**Lifecycle Pattern**:
```typescript
// In LocalExtractionService.initialize()
if (this.engine) {
  try {
    // Try to reload existing engine (faster than recreate)
    await this.engine.reload(modelId);
    return;
  } catch (reloadErr) {
    // Reload failed, clean up and recreate
    try { await this.engine.unload(); } catch (e) { }
    this.engine = null;
  }
}

if (!this.engine) {
  // Add delay to allow GPU to reset
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create new engine with progress callbacks
  this.engine = await CreateMLCEngine(modelId, { 
    initProgressCallback: (report) => {
      this.progress = report.text;
      if (progressCallback) progressCallback(report.text);
    }
  });
}
```

**Best Practices**:
- Always try `reload()` before recreating engine
- Catch and handle reload errors gracefully
- Add 500ms delay after unload before creating new engine
- Wire progress callbacks through to UI

### Transformers.js Backend Proxy
**Purpose**: Bypass CORS restrictions and add Hugging Face authentication

**Frontend Configuration**:
```typescript
// In embedding.service.ts
env.allowLocalModels = false;
env.remoteHost = 'http://localhost:3000/models/';
```

**Backend Proxy** (server.js):
```javascript
app.get('/models/*', async (req, res) => {
  const modelPath = req.params[0];
  const hfUrl = `https://huggingface.co/${modelPath}`;
  
  const response = await fetch(hfUrl, {
    headers: {
      'Authorization': `Bearer ${HF_API_KEY}`
    }
  });
  
  // Stream response back to client
  response.body.pipe(res);
});
```

**Request Flow**:
1. Transformers.js requests `/Xenova/model-name/resolve/main/file.json`
2. Backend proxies to `https://huggingface.co/Xenova/model-name/resolve/main/file.json`
3. Backend adds `Authorization` header
4. Response streamed back to client

### IndexedDB Schema Management
**Current Version**: 4

**Upgrade Strategy**:
```typescript
openDB<VectorDB>('ai-vector-db', 4, {
  upgrade(db, oldVersion, newVersion, transaction) {
    // Drop old store to ensure clean schema
    if (db.objectStoreNames.contains('documents')) {
      db.deleteObjectStore('documents');
    }
    
    // Recreate with current schema
    const store = db.createObjectStore('documents', { 
      keyPath: 'requestId' 
    });
    store.createIndex('by-timestamp', 'timestamp');
  }
});
```

**Trade-offs**:
- Data loss on version upgrade (acceptable for demo phase)
- Simple migration strategy
- Future: Implement data preservation logic

### Automated Processing Pipeline
**Flow** (triggered in `AppComponent.onFileSelected()`):
1. **Parse File**: Extract text via FileParsingService
2. **Load Models**: Initialize chat + embedding models (if needed)
3. **Extract Data**: Call LocalExtractionService with CV text
4. **Generate Doc Vector**: Embed full document text
5. **Generate Data Vector**: Embed extracted JSON string
6. **Store**: Save to IndexedDB via StorageService

**Progress Tracking**:
```typescript
steps: ProgressStep[] = [
  { name: 'Parsing File', status: 'pending' },
  { name: 'Loading Models', status: 'pending' },
  { name: 'Extracting Structured Data', status: 'pending' },
  { name: 'Generating Document Vector', status: 'pending' },
  { name: 'Generating Data Vector', status: 'pending' },
  { name: 'Storing in Database', status: 'pending' }
];
```

**Status Icons**:
- Pending: ○ (gray)
- Loading: ⏳ (animated)
- Completed: ✓ (green)
- Error: ✗ (red)

## UI/UX Standards
- **Premium Feel**: Clean, modern design with consistent spacing and colors
- **Responsive**: Max-width 800px centered container, flexbox/grid layouts
- **Feedback**: Visual indicators for all async operations (spinners, progress bars)
- **Color Coding**: 
  - PDF: Red (#dc3545)
  - DOCX: Blue (#007bff)
  - TXT: Gray (#6c757d)
  - MD: Purple (#6f42c1)
  - JSON: Green (#28a745)
- **Provider Tabs**: Browser (Beta) | Ollama (Local) | OpenAI (Cloud)
- **Model Grouping**: "Installed Models (Ready)" vs "Available to Download"

## Code Style & Best Practices
- **Angular**: Use Standalone Components with explicit imports
- **RxJS**: Observables for reactive state (BehaviorSubjects in services)
- **TypeScript**: Strict typing, avoid `any` where possible
- **Formatting**: 2 spaces indentation, semicolons
- **Error Handling**: Try/catch with user-friendly error messages
- **Comments**: Document complex logic (especially multi-layer progress tracking)
- **Destructive Actions**: Avoid `window.confirm()`. Use 2-step UI confirmation (e.g., "Delete" -> "Confirm?") for better reliability and UX.

## Common Tasks

### Adding New AI Provider
1. Create service (e.g., `AnthropicService`) with `generate()` and `getEmbeddings()` methods
2. Add provider to `ModelProvider` type in `ModelRegistryService`
3. Add model configs to `ModelRegistryService` static arrays
4. Update `EmbeddingService.getEmbedding()` with provider case
5. Update `LocalExtractionService.extractData()` with provider case
6. Add UI tab in `AppComponent` template
7. Add configuration inputs (API key, URL) with localStorage persistence

### Adding New File Format
1. Add extension to `FileParsingService.parseFile()` switch statement
2. Implement parser method (e.g., `private parseRtf()`)
3. Update `AppComponent.getFileColor()` for icon color
4. Add extension to file input `accept` attribute

### Modifying Extraction Schema
1. Update prompt in `LocalExtractionService.getSystemPrompt()`
2. Update display template in `AppComponent` (document detail section)
3. Consider IndexedDB schema versioning if structure changes significantly

## Debugging Tips
- **Ollama Issues**: Check `ollama serve` status, verify URL in settings, inspect network tab for API errors
- **Browser Model Issues**: Check WebGPU availability (`navigator.gpu`), inspect IndexedDB cache, clear cache if corrupted
- **Progress Bar Glitches**: Verify `digest` field is being passed and tracked in Map, check for null/undefined handling
- **IndexedDB Issues**: Use DevTools Application tab to inspect database, verify schema version, check for quota errors

## Testing Scenarios
1. **Provider Switching**: Switch between Browser/Ollama/OpenAI, verify model lists update correctly
2. **Model Downloads**: Download Ollama model, observe smooth 0-100% progress without jumps
3. **File Upload**: Test all supported formats (PDF, DOCX, TXT, MD, JSON)
4. **Error Recovery**: Stop Ollama mid-download, verify error status, restart and retry
5. **Export/Import**: Export database, clear IndexedDB, import, verify all documents restored
6. **Offline Mode**: Disconnect network, verify browser mode still works with cached models

- **Offline Mode**: Disconnect network, verify browser mode still works with cached models

### Angular Build with Backend Dependencies (sharp, onnxruntime-node)
**Problem**: Libraries like `@xenova/transformers` and `@mlc-ai/web-llm` often have optional dependencies on Node.js-only packages (`sharp`, `onnxruntime-node`). Angular's webpack-based build tries to bundle these, causing resolution errors or massive bundle sizes.
**Solution**: Explicitly mock these modules in `tsconfig.json` and exclude them in `package.json`.
1. **Mock File (`src/app/mocks/sharp.mock.ts`):** `export default {};`
2. **`tsconfig.json` Path Mappings**: Map `sharp`, `fs`, `path`, `os`, `onnxruntime-node` to the mock.
3. **`package.json` Browser Field**: Set `sharp`, `fs`, etc. to `false`.
4. **Build Budget**: Increase `maximumError` to 10MB in `angular.json`.

- **Offline Mode**: Disconnect network, verify browser mode still works with cached models

### Angular Build with Backend Dependencies (sharp, onnxruntime-node)
**Problem**: Libraries like `@xenova/transformers` and `@mlc-ai/web-llm` often have optional dependencies on Node.js-only packages (`sharp`, `onnxruntime-node`). Angular's webpack-based build tries to bundle these, causing resolution errors or massive bundle sizes.
**Solution**: Explicitly mock these modules in `tsconfig.json` and exclude them in `package.json`.
1. **Mock File (`src/app/mocks/sharp.mock.ts`):** `export default {};`
2. **`tsconfig.json` Path Mappings**: Map `sharp`, `fs`, `path`, `os`, `onnxruntime-node` to the mock.
3. **`package.json` Browser Field**: Set `sharp`, `fs`, etc. to `false`.
4. **Build Budget**: Increase `maximumError` to 10MB in `angular.json`.

## Security Considerations
- **API Keys**: Stored in localStorage (user responsibility)
- **Data Isolation**: IndexedDB sandboxed per origin
- **No Telemetry**: No external data transmission except user-configured APIs
- **HF Token**: Backend HF API key should be moved to environment variable (currently hardcoded)
