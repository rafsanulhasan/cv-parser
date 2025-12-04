# CV Parser Project Context for GitHub Copilot

## Project Overview
**Name:** CV Parser
**Type:** Browser-based AI Vector Store & Document Processor
**Goal:** Parse CVs/Resumes, extract structured data using LLMs, generate embeddings locally, and store everything in IndexedDB for fast retrieval.

## Technology Stack
- **Frontend:** Angular (Standalone Components)
- **Backend:** Node.js + Express
- **AI/ML:** 
  - **Embeddings:** `Xenova/all-MiniLM-L6-v2` (via `@xenova/transformers` in-browser)
  - **Extraction:** OpenAI `gpt-4o-mini` (via Backend MCP)
- **Storage:** IndexedDB (via `idb`)
- **File Parsing:** `pdfjs-dist` (PDF), `mammoth` (DOCX)

## Architecture
1.  **Frontend (`cv-parser`)**:
    -   **`AppComponent`**: Orchestrates the automated workflow (Upload -> Parse -> Extract -> Vectorize -> Store). Handles UI state (progress bar, icons).
    -   **`EmbeddingService`**: Loads the embedding model (proxied via backend) and generates vectors.
    -   **`StorageService`**: Manages IndexedDB operations (CRUD for documents).
    -   **`FileParsingService`**: Extracts raw text from PDF, DOCX, TXT, MD, JSON.
2.  **Backend (`cv-parser-backend`)**:
    -   **`server.js`**: Express server.
        -   `/upload`: Saves files to disk.
        -   `/extract`: Calls MCP server to extract CV data.
        -   `/models/*`: Proxies Hugging Face requests to bypass CORS/Auth.
    -   **`mcp-server.js`**: Implements Model Context Protocol for the extraction tool.

## Key Features & Code Patterns
-   **Automated Pipeline**: Triggered in `onFileSelected`. Uses `async/await`.
-   **UI Components**:
    -   **Progress Bar**: Expandable `<details>` element with step tracking (`steps` array).
    -   **Icons**: Dynamic SVGs in template based on `fileType`.
    -   **Accordion**: Displays stored documents.
-   **Data Schema (IndexedDB)**:
    ```typescript
    interface Document {
      requestId: string; // UUID
      doc_location: string; // Filename
      doc_vector: number[]; // Embedding
      user_data: any; // Extracted JSON
      user_data_vector: number[]; // Embedding of JSON
      fileType: string; // 'pdf', 'docx', etc.
      timestamp: number;
    }
    ```

## Common Tasks
-   **Adding new file types**: Update `FileParsingService` and `getFileColor` in `AppComponent`.
-   **Modifying Extraction**: Update prompt in `mcp-server.js` (Backend).
-   **UI Tweaks**: `AppComponent` template uses inline styles (current pattern).
