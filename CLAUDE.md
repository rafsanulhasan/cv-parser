# CLAUDE.md - CV Parser

> **📖 Complete Documentation:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for full technical specifications.

## Project Context
CV Parser: Multi-provider CV analysis app using Angular 17, Node.js, and three AI backends (Browser/Ollama/OpenAI).

## Tech Stack
- **Frontend**: Angular 17 (Standalone Components, RxJS Observables)
- **Backend**: Node.js / Express (Model proxy, file upload, MCP integration)
- **AI Providers**:
  - **Browser**: WebLLM (Chat), Transformers.js (Embeddings)
  - **Ollama**: Local REST API for Chat & Embeddings
  - **OpenAI**: Cloud API for Chat
- **Storage**: IndexedDB (via `idb` v8.0.0) - `ai-vector-db` database
- **File Parsing**: pdfjs-dist (PDF), mammoth (DOCX), FileReader (TXT/MD/JSON)

## Architecture Overview

### Frontend Services
1. **ModelRegistryService**: Centralized model catalog and state management with localStorage persistence
2. **OllamaService**: Ollama API integration (tags, pull, generate, embeddings)
3. **OpenAIService**: OpenAI API integration (chat completion)
4. **EmbeddingService**: Multi-provider facade for embedding generation
5. **LocalExtractionService**: Multi-provider facade for chat/extraction
6. **StorageService**: IndexedDB CRUD operations for documents with vectors
7. **FileParsingService**: PDF/DOCX/text file parsing

### Backend Endpoints
- **GET /models/\***: Hugging Face proxy for Transformers.js (adds auth, enables CORS)
- **POST /upload**: Multer-based file upload to `uploads/` directory
- **POST /extract**: MCP-based structured data extraction via OpenAI

## Development Commands
- **Frontend**: `cd frontend/web && npm start` → http://localhost:4200
- **Backend**: `cd backend && npm start` → http://localhost:3000
- **Ollama**: `ollama serve` (required for Ollama mode)

## Coding Guidelines

### Angular Best Practices
- **Components**: Use Standalone Components with explicit imports (CommonModule, FormsModule)
- **State Management**: RxJS BehaviorSubjects in services for reactive state
- **Lifecycle**: OnInit for component initialization
- **Templates**: Inline templates with structural directives (*ngIf, *ngFor)
- **Styling**: Inline styles (current pattern) with vanilla CSS

### Multi-Provider Pattern
Services act as facades that delegate to the correct provider:

```typescript
async getEmbedding(text: string): Promise<number[]> {
  const provider = this.modelRegistry['selectedProviderSubject'].value;
  
  if (provider === 'ollama') {
    return this.ollamaService.getEmbeddings(modelId, text);
  }
  
  // Browser fallback
  if (!this.pipe) await this.initModel(modelId);
  const output = await this.pipe(text, { pooling: 'mean', normalize: true });

for await (const _ of ollamaService.pullModel(modelId, 
  (completed, total, digest, status) => {
    if (digest) {
      digestProgress.set(digest, completed);
    }
    
    const totalDownloaded = Array.from(digestProgress.values())
      .reduce((a, b) => a + b, 0);
    const totalSize = total * digestProgress.size;
    const percent = Math.min(100, Math.round((totalDownloaded / totalSize) * 100));
  }
)) {}
```

**Critical**: See `AppComponent.pullOllamaModel()` for reference implementation.

**API Configuration**:
- Default URL: `http://localhost:11434/api`
- Optional API key for secured instances
- Configurable via settings panel

### WebLLM Integration

**Engine Lifecycle**:
1. Try `engine.reload(newModelId)` for fast model switching
2. On failure, unload and recreate with 500ms delay
3. Wire progress callbacks to UI

**Example**:
```typescript
if (this.engine) {
  try {
    await this.engine.reload(modelId);
    return;
  } catch (reloadErr) {
    try { await this.engine.unload(); } catch (e) { }
    this.engine = null;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
this.engine = await CreateMLCEngine(modelId, { initProgressCallback });
```

### IndexedDB Storage

**Schema** (version 4):
```typescript
interface Document {
  requestId: string;        // UUID v4
  doc_location: string;     // Original filename
  doc_vector: number[];     // Full document embedding
  user_data: any;           // Extracted JSON
  user_data_vector: number[]; // JSON embedding
  fileType: string;         // 'pdf' | 'docx' | 'txt' | 'md' | 'json'
  timestamp: number;        // Date.now()
}
```

**Usage**:
```typescript
// Store
await storageService.storeDocument(requestId, filename, docVector, userData, dataVector, fileType);

// Retrieve all
const docs = await storageService.getAllDocuments();

// Delete
await storageService.deleteDocument(requestId);

// Batch import
await storageService.importDocuments(documentsArray);
```

### Styling Guidelines
- **Colors**:
  - Primary: #007bff (Blue)
  - Success: #28a745 (Green)
  - Danger: #dc3545 (Red)
  - Secondary: #6c757d (Gray)
  - Info: #17a2b8 (Cyan)
- **File Type Colors**:
  - PDF: #dc3545 (Red)
  - DOCX: #007bff (Blue)
  - TXT: #6c757d (Gray)
  - MD: #6f42c1 (Purple)
  - JSON: #28a745 (Green)
- **Layout**: Max-width 800px, centered container, 20px padding
- **Border Radius**: 4-8px for cards/inputs
- **Transitions**: 0.3s ease for smooth animations
- **Confirmations**: Avoid `window.confirm()`. Use 2-step UI buttons (Delete -> Confirm?).

## Error Handling

### Graceful Degradation
- Show clear error messages at step level (✗ icon)
- Provide actionable guidance (e.g., "Ensure Ollama is running")
- Don't block subsequent operations on single step failure
- Log errors to console for debugging

### Provider-Specific Errors
- **Ollama**: Connection refused → Check if `ollama serve` is running
- **Browser**: WebGPU unavailable → Show browser compatibility message
- **OpenAI**: API key invalid → Prompt user to verify key in settings

## Testing & Debugging

### Console Logging
- Model loading progress
- API request/response cycles
- IndexedDB operations
- Provider switching events
- Progress bar calculations (especially digest tracking)

### Browser DevTools
- **Application Tab**: Inspect IndexedDB schema and data
- **Network Tab**: Monitor API calls (Ollama, OpenAI, HF proxy)
- **Console Tab**: Check for WebLLM/Transformers.js logs
- **Performance Tab**: Profile model loading and inference

### Common Issues
1. **Progress bar jumps**: Verify digest tracking is implemented correctly
2. **Model won't load**: Clear IndexedDB cache, check network
3. **Extraction fails**: Verify LLM prompt, check JSON parsing
4. **Ollama timeout**: Increase request timeout, check model size

## Key Files Reference

### Frontend
- `app.component.ts`: Main orchestrator (delegates UI to child components)
- `components/ui/`: `ModelSelect`, `FileUploader`, `DocumentList`
- `components/feature/`: `ModelConfig` (Browser/Ollama/OpenInteractive settings)
- `model-registry.service.ts`: Provider state, model catalogs, localStorage persistence (385 lines)
- `ollama.service.ts`: Ollama API integration, multi-layer pull (307 lines)
- `embedding.service.ts`: Multi-provider embedding facade
- `local-extraction.service.ts`: Multi-provider chat facade (151 lines)
- `storage.service.ts`: IndexedDB operations
- `file-parsing.service.ts`: File format parsers

### Backend
- `server.js`: Express app with proxy, upload, extract endpoints (159 lines)
- `mcp-server.js`: Model Context Protocol for CV extraction (113 lines)

## Future Enhancements
- **Semantic Search**: Implement vector similarity search UI
- **Batch Upload**: Process multiple files at once
- **Job Matching**: Compare CVs against job descriptions
- **Export Formats**: PDF, DOCX export of candidate summaries
- **Advanced Filters**: Experience years, skills, location
### 13. Unified Model Selection Architecture

**Problem**: Users found it confusing to switch tabs to select models.

**Solution**: A single "Smart Dropdown" at the top level (`ModelConfigComponent`) that controls the provider and specific model.

**Key Logic**: `AppComponent.onChatModelChange` finds the model in the unified list, determines the provider, switches the provider if necessary, and sets the model.

**Implementation Logic** (`AppComponent.onChatModelChange`):
```typescript
onChatModelChange(modelId: string) {
  // 1. Find the provider associated with this model ID from the unified list
  let provider: ModelProvider | undefined;
  for (const group of this.unifiedChatModels) {
    const model = group.options.find(m => m.id === modelId);
    if (model) {
      provider = model.provider;
      break;
    }
  }

  // 2. Switch provider context if it changed
  if (provider && provider !== this.selectedProvider) {
    this.modelRegistry.setProvider(provider);
  }
  
  // 3. Set the specific model
  this.modelRegistry.setChatModel(modelId);
}
```

**Pattern**:
- **UI**: Top-level dropdown driven by `unifiedChatModels`.
- **Service**: `ModelRegistryService.getUnifiedChatModels()` aggregates models from all providers into grouped categories.
- **State**: `selectedProvider` and `selectedChatModel` are synced. Switching key in dropdown triggers both updates.

### OpenAI BYOM (Bring Your Own Model) Modal

When no OpenAI API key is configured:

1. **Dropdown shows message**: "No OpenAI API key configured."
2. **BYOM button**: Opens `OpenAIKeyModalComponent` for key configuration
3. **Modal features**:
   - Password input with show/hide toggle
   - Link to OpenAI Platform
   - "Save & Connect" button
4. **On save**: Key stored via `ModelRegistryService.setOpenAIKey()`, models refetched

**Files**:
- `components/ui/openai-key-modal/` - Modal component (TS, HTML, CSS)
- `SmartDropdownComponent` - Emits `openBYOM` event
- `AppComponent` - Handles `isOpenAIKeyModalOpen` state

### Metadata Badge Display

Model metadata shown as badges in dropdown:
- **Context length**: e.g., "128k ctx"
- **Output tokens**: e.g., "16k out"
- **Details**: e.g., "High Intelligence"

**Filtering**: Hide badges with "Unknown" or "N/A" values:
```html
<span *ngIf="model.contextLength && model.contextLength !== 'Unknown' && model.contextLength !== 'N/A'" 
      class="item-badge">{{ formatNumber(model.contextLength) }} ctx</span>
```

