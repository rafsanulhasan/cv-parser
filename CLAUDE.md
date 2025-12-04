# CV Parser - System Architecture & Requirements (for Claude)

## Executive Summary
The **CV Parser** is a hybrid web application designed to process sensitive document data securely. It leverages client-side processing for embeddings (privacy-preserving) and a controlled backend proxy for LLM-based extraction.

## System Components

### 1. Frontend Application (Angular)
*   **Responsibility**: User interaction, file parsing, vectorization, local storage.
*   **Key Design Decisions**:
    *   **In-Browser Embeddings**: Uses `Transformers.js` to run `all-MiniLM-L6-v2` locally. This reduces server load and keeps vector generation private.
    *   **IndexedDB Storage**: Stores documents and vectors client-side to enable offline capabilities and reduce database costs.
    *   **Standalone Components**: Modern Angular approach, reducing boilerplate.

### 2. Backend Gateway (Node.js/Express)
*   **Responsibility**: API Proxy, File Storage, Intelligence Layer.
*   **Key Design Decisions**:
    *   **Hugging Face Proxy**: The frontend cannot directly access HF API due to CORS and API key exposure risks. The backend proxies these requests (`/models/*`).
    *   **MCP Integration**: Implements the **Model Context Protocol (MCP)**. The `extract_cv_data` tool is exposed via an MCP server, which the Express route `/extract` calls. This standardizes the AI interaction.
    *   **File Persistence**: Uploaded files are saved to `uploads/` for audit/retrieval purposes.

## Data Flow: The "Automated Workflow"
1.  **Upload**: User selects file -> POST `/upload` (Backend saves file).
2.  **Parse**: Frontend `FileParsingService` extracts text (PDF/DOCX/TXT).
3.  **Extract**: Frontend sends text -> POST `/extract` -> Backend MCP (OpenAI) -> Returns structured JSON.
4.  **Vectorize**: Frontend `EmbeddingService` generates vectors for both raw text and extracted JSON.
5.  **Store**: Frontend `StorageService` saves all artifacts to IndexedDB.

## UI/UX Requirements
*   **Visual Feedback**: Detailed progress bar with "Hide" capability.
*   **Iconography**: Professional SVG icons with color-coded format labels (PDF=Red, DOCX=Blue, etc.).
*   **Data Management**: Import/Export (JSON) and Delete capabilities are mandatory.

## Future Considerations
*   **RAG**: The stored vectors are ready for Retrieval-Augmented Generation.
*   **Search**: Vector similarity search can be implemented in `StorageService`.
