import { Injectable } from '@angular/core';

export interface OpenAIModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
}

@Injectable( {
    providedIn: 'root'
} )
export class OpenAIService {
    private apiUrl = 'https://api.openai.com/v1';

    constructor () { }

    private getHeaders ( apiKey: string ) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ apiKey }`
        };
    }

    async validateKey ( apiKey: string ): Promise<boolean> {
        try {
            const response = await fetch( `${ this.apiUrl }/models`, {
                headers: this.getHeaders( apiKey )
            } );
            return response.ok;
        } catch ( e ) {
            return false;
        }
    }

    async getModels ( apiKey: string ): Promise<OpenAIModel[]> {
        try {
            const response = await fetch( `${ this.apiUrl }/models`, {
                headers: this.getHeaders( apiKey )
            } );

            if ( !response.ok ) throw new Error( 'Failed to fetch OpenAI models' );

            const data = await response.json();
            // Filter for chat models usually relevant for this task
            return ( data.data || [] ).filter( ( m: any ) => m.id.includes( 'gpt' ) );
        } catch ( e ) {
            console.error( 'Error fetching OpenAI models:', e );
            return [];
        }
    }

    async generate ( apiKey: string, model: string, systemPrompt: string, userPrompt: string ): Promise<any> {
        const response = await fetch( `${ this.apiUrl }/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders( apiKey ),
            body: JSON.stringify( {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            } )
        } );

        if ( !response.ok ) {
            const err = await response.json();
            throw new Error( `OpenAI generation failed: ${ err.error?.message || response.statusText }` );
        }

        const data = await response.json();
        try {
            return JSON.parse( data.choices[ 0 ].message.content );
        } catch ( e ) {
            throw new Error( 'Could not parse JSON from OpenAI output' );
        }
    }
}
