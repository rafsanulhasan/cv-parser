# Antigravity Session Context

## Session History
**User Goal**: Build a CV Parser with automated AI processing.
**Current State**: Fully functional MVP.

## Completed Tasks
1.  **Scaffolding**: Created Angular app and Node backend.
2.  **AI Setup**:
    -   Frontend: `Transformers.js` (Embeddings).
    -   Backend: OpenAI `gpt-4o-mini` (Extraction).
3.  **Features**:
    -   **File Support**: PDF, DOCX, TXT, MD, JSON.
    -   **Automation**: One-click process from upload to storage.
    -   **Storage**: IndexedDB with vector support.
    -   **UI**: Accordion list, Progress bar (expandable/hideable), SVG Icons (dynamic labels).
    -   **Data**: Import/Export JSON.

## Active Files
-   **Frontend**: `e:/Projects/Structurizr/cv-parser/`
    -   `src/app/app.component.ts`: Main logic.
    -   `src/app/services/`: `embedding.service.ts`, `storage.service.ts`, `file-parsing.service.ts`.
-   **Backend**: `e:/Projects/Structurizr/cv-parser-backend/`
    -   `server.js`: Proxy & Uploads.
    -   `mcp-server.js`: AI Extraction.

## Known Decisions / Constraints
-   **Proxy**: We proxy HF models to avoid CORS.
-   **OpenAI**: Switched to OpenAI for extraction because HF Inference API was returning 410 errors.
-   **Styling**: Using inline styles for speed; consider moving to SCSS if project grows.
-   **Icons**: Custom SVGs with text labels were requested by user.

## Next Potential Steps
-   Implement Vector Search (Semantic Search).
-   Add RAG Chat interface.
-   Refactor inline styles to CSS classes.
