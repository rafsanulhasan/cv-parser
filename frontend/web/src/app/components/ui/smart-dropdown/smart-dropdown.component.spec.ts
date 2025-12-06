import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModelSelectComponent } from './model-select.component';

describe( 'ModelSelectComponent', () => {
    let component: ModelSelectComponent;
    let fixture: ComponentFixture<ModelSelectComponent>;

    beforeEach( async () => {
        await TestBed.configureTestingModule( {
            imports: [ ModelSelectComponent ]
        } )
            .compileComponents();

        fixture = TestBed.createComponent( ModelSelectComponent );
        component = fixture.componentInstance;
        fixture.detectChanges();
    } );

    it( 'should create', () => {
        expect( component ).toBeTruthy();
    } );
} );
