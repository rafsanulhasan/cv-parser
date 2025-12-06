import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

// Configure PDF.js worker
// We are serving this file locally from assets (configured in angular.json)
pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs';

@Injectable( {
    providedIn: 'root'
} )
export class FileParsingService {

    constructor () { }

    async parseFile ( file: File ): Promise<string> {
        const extension = file.name.split( '.' ).pop()?.toLowerCase();

        switch ( extension ) {
            case 'pdf':
                return this.parsePdf( file );
            case 'docx':
            case 'doc':
                return this.parseDocx( file );
            case 'txt':
            case 'md':
            case 'json':
                return this.readTextFile( file );
            default:
                throw new Error( `Unsupported file type: .${ extension }` );
        }
    }

    private async parsePdf ( file: File ): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument( { data: arrayBuffer } );
        const pdf = await loadingTask.promise;

        let fullText = '';
        for ( let i = 1; i <= pdf.numPages; i++ ) {
            const page = await pdf.getPage( i );
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map( ( item: any ) => item.str )
                .join( ' ' );
            fullText += pageText + '\n';
        }

        return fullText;
    }

    private async parseDocx ( file: File ): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText( { arrayBuffer: arrayBuffer } );
        return result.value;
    }

    private readTextFile ( file: File ): Promise<string> {
        return new Promise( ( resolve, reject ) => {
            const reader = new FileReader();
            reader.onload = ( e: any ) => resolve( e.target.result );
            reader.onerror = ( e ) => reject( e );
            reader.readAsText( file );
        } );
    }
}
