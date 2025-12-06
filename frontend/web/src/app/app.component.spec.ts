import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { StorageService } from './services/storage.service';
import { FileParsingService } from './services/file-parsing.service';
import { EmbeddingService } from './services/embedding.service';
import { LocalExtractionService } from './services/local-extraction.service';
import { OllamaService } from './services/ollama.service';
import { OpenAIService } from './services/openai.service';
import { ModelRegistryService } from './services/model-registry.service';

// Mocks
class MockStorageService { getAllDocuments = jasmine.createSpy( 'getAllDocuments' ).and.returnValue( Promise.resolve( [] ) ); }
class MockFileParsingService { }
class MockEmbeddingService { }
class MockLocalExtractionService { }
class MockOllamaService { }
class MockOpenAIService { }
class MockModelRegistryService {
    availableModels$ = { subscribe: () => { } };
    selectedProvider$ = { subscribe: () => { } };
    selectedEmbeddingModel$ = { subscribe: () => { } };
    selectedChatModel$ = { subscribe: () => { } };
    ollamaApiUrl$ = { subscribe: () => { } };
    openaiApiKey$ = { subscribe: () => { } };
    getBrowserChatModels = () => [];
    getBrowserEmbeddingModels = () => [];
    getOllamaChatModels = () => [];
    getOllamaEmbeddingModels = () => [];
    getOpenAIChatModels = () => [];
    getOpenAIEmbeddingModels = () => [];
}

describe( 'AppComponent', () => {
    let component: AppComponent;
    let fixture: ComponentFixture<AppComponent>;

    beforeEach( async () => {
        await TestBed.configureTestingModule( {
            imports: [ AppComponent, HttpClientTestingModule ],
            providers: [
                { provide: StorageService, useClass: MockStorageService },
                { provide: FileParsingService, useClass: MockFileParsingService },
                { provide: EmbeddingService, useClass: MockEmbeddingService },
                { provide: LocalExtractionService, useClass: MockLocalExtractionService },
                { provide: OllamaService, useClass: MockOllamaService },
                { provide: OpenAIService, useClass: MockOpenAIService },
                { provide: ModelRegistryService, useClass: MockModelRegistryService }
            ]
        } )
            .compileComponents();

        fixture = TestBed.createComponent( AppComponent );
        component = fixture.componentInstance;
        fixture.detectChanges();
    } );

    it( 'should create', () => {
        expect( component ).toBeTruthy();
    } );
} );
