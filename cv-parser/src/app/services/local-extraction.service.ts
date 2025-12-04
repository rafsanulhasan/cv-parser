import { Injectable } from '@angular/core';
import { CreateMLCEngine, MLCEngine, InitProgressCallback } from '@mlc-ai/web-llm';
import { ModelRegistryService } from './model-registry.service';
import { OllamaService } from './ollama.service';
import { OpenAIService } from './openai.service';

@Injectable( {
    providedIn: 'root'
} )
export class LocalExtractionService {
    private engine: MLCEngine | null = null;
    private currentModelId: string | null = null;
    public isLoading = false;
    public progress = '';

    constructor (
        private modelRegistry: ModelRegistryService,
        private ollamaService: OllamaService,
        private openAIService: OpenAIService
    ) { }

    async initialize ( modelId: string, progressCallback?: ( text: string ) => void ) {
        // Only initialize WebLLM engine if we are in browser mode
        // But since this service is now a facade, we might not need to initialize WebLLM 
        // if the user selected Ollama. However, the current flow calls initialize() regardless.
        // We should check the provider.

        // Accessing internal subject for sync value (or add a getter to registry)
        const provider = this.modelRegistry[ 'selectedProviderSubject' ].value;

        if ( provider !== 'browser' ) {
            return; // No initialization needed for API-based providers
        }

        this.isLoading = true;
        this.currentModelId = modelId;

        const initProgressCallback: InitProgressCallback = ( report ) => {
            const text = report.text;
            this.progress = text;
            if ( progressCallback ) progressCallback( text );
            console.log( 'Init model:', text );
        };

        try {
            if ( this.engine ) {
                console.log( 'Reloading existing engine with model:', modelId );
                try {
                    this.engine.setInitProgressCallback( initProgressCallback );
                    await this.engine.reload( modelId );
                    console.log( 'Engine ready (reloaded) for model:', modelId );
                    return;
                } catch ( reloadErr ) {
                    console.warn( 'Reload failed, attempting to recreate engine:', reloadErr );
                    try { await this.engine.unload(); } catch ( e ) { }
                    this.engine = null;
                    // Fall through to create new engine
                }
            }

            if ( !this.engine ) {
                console.log( 'Creating new engine for model:', modelId );
                // Add a small delay to allow GPU to reset if we just crashed
                await new Promise( resolve => setTimeout( resolve, 500 ) );
                this.engine = await CreateMLCEngine( modelId, { initProgressCallback } );
                console.log( 'Engine ready (new) for model:', modelId );
            }
        } catch ( err ) {
            console.error( 'Failed to load model:', err );
            if ( this.engine ) {
                try { await this.engine.unload(); } catch ( e ) { }
                this.engine = null;
            }
            this.currentModelId = null;
            throw err;
        } finally {
            this.isLoading = false;
        }
    }

    async extractData ( text: string, retryCount = 0 ): Promise<any> {
        const provider = this.modelRegistry[ 'selectedProviderSubject' ].value;
        const modelId = this.modelRegistry[ 'selectedChatModelSubject' ].value;

        if ( provider === 'ollama' ) {
            return this.ollamaService.generate( modelId, this.getSystemPrompt(), `Here is the CV text:\n\n${ text }` );
        }

        if ( provider === 'openai' ) {
            const key = this.modelRegistry.getOpenAIKey();
            return this.openAIService.generate( key, modelId, this.getSystemPrompt(), `Here is the CV text:\n\n${ text }` );
        }

        // Browser (WebLLM) Fallback
        if ( !this.engine ) {
            throw new Error( 'Model not initialized. Call initialize() first.' );
        }

        const systemPrompt = this.getSystemPrompt();
        const userPrompt = `Here is the CV text:\n\n${ text }`;

        try {
            const response = await this.engine.chat.completions.create( {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            } );

            const content = response.choices[ 0 ].message.content || '{}';
            console.log( 'Raw extraction result:', content );

            try {
                return JSON.parse( content );
            } catch ( e ) {
                const jsonMatch = content.match( /\{[\s\S]*\}/ );
                if ( jsonMatch ) {
                    return JSON.parse( jsonMatch[ 0 ] );
                }
                throw new Error( 'Could not parse JSON from model output' );
            }

        } catch ( err: any ) {
            console.error( 'Extraction error details:', err );

            if ( retryCount < 1 && this.currentModelId ) {
                console.log( 'Extraction failed. Attempting to reload engine and retry...' );
                this.engine = null;
                await new Promise( resolve => setTimeout( resolve, 1000 ) );
                await this.initialize( this.currentModelId );
                return this.extractData( text, retryCount + 1 );
            }

            throw err;
        }
    }

    private getSystemPrompt (): string {
        return `You are a precise data extraction AI.
    Extract the following information from the CV/Resume text provided by the user:
    - fullName (string)
    - email (string)
    - skills (array of strings)
    - experience (array of objects with title, company, dates)

    Return ONLY valid JSON matching this structure. Do not add markdown formatting or explanations.`;
    }
}
