# GEMINI.md - CV Parser

> **📖 Full Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system design.
> **🎯 This Document:** Critical gotchas, debugging tips, and known issues.

## Project Overview

Multi-provider CV analysis tool. Angular 17 frontend, Node.js backend, three AI modes: Browser (WebLLM/Transformers.js), Ollama (Local), OpenAI (Cloud).

## Critical "Gotchas"

### 0. OpenAI Model Metadata Integration (NEW - Dec 2025)

**Problem**: Hardcoded model metadata (context length, output tokens, knowledge cutoff) becomes stale as OpenAI updates models.

**Solution**: Backend scheduled job + API endpoints for dynamic metadata fetching.

**Implementation**:

1. **Backend (`backend/`):**
   - `models-metadata.json` - JSON storage for model specs
   - `utils/model-metadata-fetcher.js` - Metadata update logic
   - `GET /api/model-metadata` - Fast cached data endpoint
   - `POST /api/model-metadata/refresh` - Manual trigger with rate limiting (5min)
   - `node-cron` scheduler - Daily 3 AM refresh

2. **Frontend (`frontend/web/src/app/services/`):**
   - `ModelRegistryService.fetchOpenAIMetadata()` - GET from backend
   - `ModelRegistryService.refreshOpenAIMetadata()` - POST refresh
   - `cachedOpenAIMetadata` - Local cache for fast lookups

3. **Critical Fix - Metadata Application:**
   ```typescript
   // In ModelRegistryService.refreshModels() OpenAI case
   const getMetadataFor = (modelId: string) => {
     // Exact match first
     if (this.cachedOpenAIMetadata?.models?.[modelId]) {
       return this.cachedOpenAIMetadata.models[modelId];
     }
     
     // Fuzzy match (handles "gpt-4o-2024-05-13" -> "gpt-4o")
     for (const [key, value] of Object.entries(this.cachedOpenAIMetadata.models)) {
       if (modelId.includes(key) || key.includes(modelId)) {
         return value;
       }
     }
     
    // Fallback
     return { contextLength: 'Unknown', outputTokens: 'Unknown', ... };
   };
   
   models = openAIModels.map(m => ({
     ...m,
     ...getMetadataFor(m.id)  // Inject metadata here!
   }));
   ```

4. **Modal UI:**
   - Refresh button (🔄) with loading state (⏳)
   - "Last Updated" timestamp from backend
   - Error handling for rate limits

**Debugging**:
```bash
# Test backend API
curl http://localhost:3000/api/model-metadata
curl -X POST http://localhost:3000/api/model-metadata/refresh

# Check JSON file
cat backend/models-metadata.json
```

**Common Error**: Modal shows "Unknown" for all fields
- **Cause**: `refreshModels()` maps OpenAI models but doesn't apply cached metadata
- **Fix**: Use `getMetadataFor()` helper to inject `contextLength`, `outputTokens`, `knowledgeCutoff`

### 1. Ollama Multi-Layer Downloads

**Problem**: Models download in layers (blobs). Each layer reports progress from 0-100%. Naively using `completed/total` causes progress bar to jump back to 0% for each new layer.

**Solution**: Track progress per `digest` (layer identifier), aggregate across all layers.

**Reference Implementation** (`AppComponent.downloadEmbeddingModel()` and `AppComponent.downloadChatModel()`):

```typescript
const digestProgress = new Map<string, number>();

await this.ollamaService.pullModel(modelId, 
  (status, completed, total, digest) => {
    if (digest) {
      // Store progress for this specific layer
      digestProgress.set(digest, completed);
    }
    
    // Sum progress across all layers
    const totalDownloaded = Array.from(digestProgress.values())
      .reduce((sum, val) => sum + val, 0);
    
    // Total = current total * number of layers seen
    const totalSize = total * digestProgress.size;
    
    // Calculate percentage, cap at 100
    const percent = totalSize > 0 
      ? Math.min(100, Math.round((totalDownloaded / totalSize) * 100))
      : 0;
    
    this.embeddingPullProgress.percent = percent;
    this.embeddingPullProgress.status = status || 'Downloading...';
    
    // Handle special statuses
    if (status === 'verifying' || status === 'writing manifest') {
      this.embeddingPullProgress.percent = 100;
    }
  }
);
```

**Critical Requirements**:

- `OllamaService.pullModel()` MUST pass `digest` to callback
- Maintain Map<string, number> for layer tracking
- Handle status states: "pulling", "verifying", "writing manifest", "success"
- Force 100% when verifying/writing manifest (total may be undefined)

### 2. WebLLM Engine State Management

**Problem**: GPU state persists between model loads. Direct engine recreation can fail or leak GPU memory.

**Solution**: Try reload first, recreate only on failure, add delay after unload.

**Pattern** (`LocalExtractionService.initialize()`):

```typescript
if (this.engine) {
  try {
    // Fast path: reload existing engine
    this.engine.setInitProgressCallback(initProgressCallback);
    await this.engine.reload(modelId);
    return;
  } catch (reloadErr) {
    // Reload failed, clean up properly
    try { await this.engine.unload(); } catch (e) { }
    this.engine = null;
    // Give GPU time to reset
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Create new engine
this.engine = await CreateMLCEngine(modelId, { initProgressCallback });
```

**Best Practices**:

- Always try `reload()` before creating new engine
- Catch reload errors separately from creation errors
- Add 500ms delay after `unload()` before creating new engine
- Nullify engine reference after unload
- Wire progress callbacks for UI feedback

### 3. IndexedDB Schema Upgrades

**Problem**: Schema changes require careful migration. Version bumps trigger upgrade callback.

**Current Approach** (`StorageService`):

```typescript
openDB<VectorDB>('ai-vector-db', 4, {
  upgrade(db, oldVersion, newVersion, transaction) {
    // Nuclear option: drop and recreate
    if (db.objectStoreNames.contains('documents')) {
      db.deleteObjectStore('documents');
    }
    
    const store = db.createObjectStore('documents', { 
      keyPath: 'requestId' 
    });
    store.createIndex('by-timestamp', 'timestamp');
  }
});
```

**Trade-offs**:

- **Pro**: Simple, ensures schema consistency
- **Con**: Data loss on every version upgrade
- **Status**: Acceptable for demo/dev phase
- **Future**: Implement data migration logic before production

**Schema** (version 4):

```typescript
{
  requestId: string;        // UUID v4
  doc_location: string;     // Original filename
  doc_vector: number[];     // Full document embedding
  user_data: any;           // Extracted JSON
  user_data_vector: number[]; // JSON embedding
  fileType: string;         // 'pdf', 'docx', 'txt', 'md', 'json'
  timestamp: number;        // Unix timestamp
}
```

### 4. Transformers.js CORS & Authentication

**Problem**: Direct Hugging Face requests fail due to CORS policy and missing authentication.

**Solution**: Backend proxy adds auth header and enables CORS.

**Frontend Config** (`embedding.service.ts`):

```typescript
import { env } from '@xenova/transformers';
env.allowLocalModels = false;
env.remoteHost = 'http://localhost:3000/models/';
```

**Backend Proxy** (`server.js`):

```javascript
app.get('/models/*', async (req, res) => {
  const modelPath = req.params[0];
  const hfUrl = `https://huggingface.co/${modelPath}`;
  
  const response = await fetch(hfUrl, {
    headers: {
      'Authorization': `Bearer ${HF_API_KEY}`
    }
  });
  
  // Forward headers and stream response
  response.body.pipe(res);
});
```

**Request Flow**:

1. Transformers.js: `/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json`
2. Backend proxies to: `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json`
3. Backend adds: `Authorization: Bearer <token>`
4. Response streamed back to client

### 5. Provider State Synchronization

**Problem**: Model selections must sync across services and persist across sessions.

**Solution**: `ModelRegistryService` as single source of truth with localStorage persistence.

**Keys Persisted**:

- `selectedProvider` → 'browser' | 'ollama' | 'openai'
- `selectedEmbeddingModel` → Model ID string
- `selectedChatModel` → Model ID string
- `openaiApiKey` → API key (if configured)
- `ollamaApiUrl` → Custom URL (if configured)
- `ollamaApiKey` → API key (if configured)

**Pattern**:

```typescript
// Service accesses via internal subject
const provider = this.modelRegistry['selectedProviderSubject'].value;

// Component subscribes to observable
this.modelRegistry.selectedProvider$.subscribe(provider => {
  this.selectedProvider = provider;
});
```

### 6. Progress Callback Performance

**Problem**: High-frequency callbacks (100ms intervals) can freeze UI during large model downloads.

**Solution**: Debounce updates, batch DOM changes, cap percentages.

**Pattern**:

```typescript
// Cap percentage to avoid >100% display
const percent = Math.min(100, Math.round((completed / total) * 100));

// Batch updates in single object
this.embeddingPullProgress = { percent, status, completed, total };

// Angular change detection handles batching automatically
```

### 7. File Type Detection & Icon Rendering

**Problem**: Must detect file type from extension and render color-coded icons dynamically.

**Solution**: SVG template with `[attr.fill]` binding and color map function.

**Implementation** (`AppComponent`):

```typescript
getFileColor(fileType: string): string {
  const colors: { [key: string]: string } = {
    'pdf': '#dc3545',   // Red
    'docx': '#007bff',  // Blue
    'txt': '#6c757d',   // Gray
    'md': '#6f42c1',    // Purple
    'json': '#28a745'   // Green
  };
  return colors[fileType] || '#6c757d'; // Default gray
}
```

**Template**:

```html
<rect x="4" y="18" width="24" height="10" rx="2" 
      [attr.fill]="getFileColor(doc.fileType)"/>
<text x="16" y="25" fill="white" font-family="sans-serif" 
      font-size="8" font-weight="bold" text-anchor="middle">
  {{ doc.fileType | uppercase }}
</text>
```

### 8. Async Pipeline Error Recovery

**Problem**: If any step fails, should show error but not block subsequent attempts.

**Solution**: Step-level error tracking with independent status.

**Pattern** (`AppComponent.onFileSelected()`):

```typescript
try {
  this.updateStepStatus('Parsing File', 'loading');
  const text = await this.fileParsingService.parseFile(file);
  this.updateStepStatus('Parsing File', 'completed');
} catch (err) {
  this.updateStepStatus('Parsing File', 'error');
  console.error('Parsing failed:', err);
  // Don't throw, let user retry
  return;
}
```

**Status Icons**:

- ○ Pending (gray)
- ⏳ Loading (animated)
- ✓ Completed (green)
- ✗ Error (red)

### 9. Model Library Dynamic Updates

**Problem**: Ollama model library changes as user installs/removes models.

**Solution**: Refresh button fetches latest, merges with static recommendations.

**Logic** (`ModelRegistryService.updateOllamaModels()`):

1. Fetch installed models via `/api/tags`
2. Fetch recommended models via backend proxy
3. Merge: Installed models marked `isInstalled: true`
4. Uninstalled recommendations marked `isInstalled: false`
5. Group in UI: "Installed Models (Ready)" vs "Available to Download"

**UI Pattern**:

```html
<optgroup label="Installed Models (Ready)">
  <option *ngFor="let model of getInstalledModels(models)" [value]="model.id">
    {{ model.name }} ({{ model.size }})
  </option>
</optgroup>
<optgroup label="Available to Download">
  <option *ngFor="let model of getCloudModels(models)" [value]="model.id">
    {{ model.name }}
  </option>
</optgroup>
```

### 10. Export/Import Data Integrity

**Problem**: Must preserve all fields including vectors when exporting/importing.

**Solution**: Full document serialization via `JSON.stringify()`, batch import with transaction.

**Export** (`AppComponent.exportData()`):

```typescript
const dataStr = JSON.stringify(this.documents, null, 2);
const blob = new Blob([dataStr], { type: 'application/json' });
// Trigger download
```

**Import** (`AppComponent.importData()`):

```typescript
const data = JSON.parse(reader.result as string);
await this.storageService.importDocuments(data);
this.documents = await this.storageService.getAllDocuments();
```

**Transaction Safety** (`StorageService.importDocuments()`):

```typescript
const tx = db.transaction('documents', 'readwrite');
const store = tx.objectStore('documents');

for (const doc of documents) {
  await store.put(doc); // Upsert
}

await tx.done; // Commit transaction
```

## Debugging Tips

### Browser DevTools

- **Application → IndexedDB**: Inspect `ai-vector-db`, verify schema version and data
- **Network**: Monitor Ollama API calls, check for 404/500 errors
- **Console**: Filter by service name (e.g., "OllamaService") to trace execution
- **Performance**: Profile model loading, identify bottlenecks

### Ollama Debugging

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# List installed models
curl http://localhost:11434/api/tags | jq '.models[].name'

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama3:8b",
  "prompt": "Hello",
  "stream": false
}'
```

### Common Error Messages

1. **"Failed to fetch Ollama models"** → Start `ollama serve`
2. **"Model not initialized"** → Check provider selection, verify model loaded
3. **"WebGPU not available"** → Browser incompatibility (need Chrome 113+)
4. **"Failed to parse JSON response"** → LLM returned non-JSON, check prompt
5. **"Quota exceeded"** → IndexedDB storage limit, clear old documents

## Recent Fixes

- ✅ Fixed "Download" button visibility (removed duplicate HTML elements)
- ✅ Fixed Progress Bar glitching (implemented multi-layer digest tracking)
- ✅ Fixed IndexedDB schema mismatch (bumped version to 4, added fileType field)
- ✅ Fixed provider switching not updating model lists
- ✅ Fixed WebLLM engine not releasing GPU properly (added reload pattern)

### 11. Avoid Native Confirm Dialogs
**Problem**: `window.confirm()` can be unreliable, blocked by browsers/environments, or fail silently (especially in embedded views or specific browser modes).
**Solution**: Use in-UI 2-step confirmation (e.g., button text changes to "Confirm?").
**Pattern**:
```typescript
if (!this.confirming) {
  this.confirming = true;
  setTimeout(() => this.confirming = false, 3000); // Reset
  return;
}
// Proceed with action
```

## UI Testing Process

### Automated Testing Setup

1. **Check Running Processes**: Verify if any process is running on backend (port 3000) and frontend (port 4200) ports. If running, kill them.

   ```powershell
   # Check for processes on ports
   Get-NetTCPConnection -LocalPort 3000,4200 -ErrorAction SilentlyContinue
   
   # Kill processes if found
   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
   Get-Process -Id (Get-NetTCPConnection -LocalPort 4200).OwningProcess | Stop-Process -Force
   ```

2. **Build and Run**: Start both frontend and backend servers

   ```powershell
   # Terminal 1: Backend
   cd backend
   npm start
   
   # Terminal 2: Frontend
   cd frontend/web
   npm start
   ```

3. **Browser Management**: Check and manage Chrome browser state
   - **If Chrome is already opened:**
     - Check the currently selected tab
     - If it's our frontend (http://localhost:4200), refresh it
     - If not, check all tabs for the app URL
     - If found in another tab, select and refresh it
     - If not found in any tab, open a new tab with the app URL
   - **If Chrome is not opened:**
     - Open Chrome and navigate to http://localhost:4200

4. **Execute Test Cases**: Follow user instructions for specific use case testing (see scenarios below)

### Manual Testing Scenarios

See "Common Error Messages" and "Recent Fixes" sections for validation checkpoints.

## Known Limitations

- **Single File Upload**: Must process files sequentially (no batch upload yet)
- **No Search UI**: Vector storage ready, but semantic search interface not implemented
- **Memory Usage**: Large models (4GB+) may cause issues on low-memory devices
- **Browser Compatibility**: WebGPU required for browser mode (Chrome/Edge 113+ only)
- **Data Migration**: Schema upgrades currently drop all data (temporary limitation)
