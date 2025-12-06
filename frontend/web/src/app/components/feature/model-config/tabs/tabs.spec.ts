import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserConfigComponent } from './browser-config.component';
import { OllamaConfigComponent } from './ollama-config.component';
import { OpenAiConfigComponent } from './openai-config.component';

describe( 'ModelConfig Tabs', () => {
    describe( 'BrowserConfigComponent', () => {
        let component: BrowserConfigComponent;
        let fixture: ComponentFixture<BrowserConfigComponent>;

        beforeEach( async () => {
            await TestBed.configureTestingModule( { imports: [ BrowserConfigComponent ] } ).compileComponents();
            fixture = TestBed.createComponent( BrowserConfigComponent );
            component = fixture.componentInstance;
            fixture.detectChanges();
        } );

        it( 'should create', () => { expect( component ).toBeTruthy(); } );
    } );

    describe( 'OllamaConfigComponent', () => {
        let component: OllamaConfigComponent;
        let fixture: ComponentFixture<OllamaConfigComponent>;

        beforeEach( async () => {
            await TestBed.configureTestingModule( { imports: [ OllamaConfigComponent ] } ).compileComponents();
            fixture = TestBed.createComponent( OllamaConfigComponent );
            component = fixture.componentInstance;
            fixture.detectChanges();
        } );

        it( 'should create', () => { expect( component ).toBeTruthy(); } );
    } );

    describe( 'OpenAiConfigComponent', () => {
        let component: OpenAiConfigComponent;
        let fixture: ComponentFixture<OpenAiConfigComponent>;

        beforeEach( async () => {
            await TestBed.configureTestingModule( { imports: [ OpenAiConfigComponent ] } ).compileComponents();
            fixture = TestBed.createComponent( OpenAiConfigComponent );
            component = fixture.componentInstance;
            fixture.detectChanges();
        } );

        it( 'should create', () => { expect( component ).toBeTruthy(); } );
    } );
} );
