const { McpServer } = require( "@modelcontextprotocol/sdk/server/mcp.js" );
const { StdioServerTransport } = require( "@modelcontextprotocol/sdk/server/stdio.js" );
const { z } = require( "zod" );
const fetch = require( "node-fetch" );

class CvExtractionServer {
    constructor () {
        this.server = new McpServer( {
            name: "cv-extraction-server",
            version: "1.0.0",
        } );

        this.setupTools();
    }

    setupTools () {
        this.server.tool(
            "extract_cv_data",
            "Extract structured data from a CV/Resume text",
            {
                text: z.string().describe( "The full text content of the CV/Resume" ),
            },
            async ( { text } ) => {
                try {
                    const extractedData = await this.callLLM( text );
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify( extractedData, null, 2 ),
                            },
                        ],
                    };
                } catch ( error ) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify( { error: error.message } ),
                            },
                        ],
                        isError: true,
                    };
                }
            }
        );
    }

    async callLLM ( text ) {
        const API_URL = "https://api.openai.com/v1/chat/completions";
        const API_KEY = "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";

        const prompt = `
        Extract the following fields from the resume text below and return ONLY a valid JSON object.
        Fields: fullName, email, skills (array), experience (array of objects with title, company, dates), education (array), certifications (array).
        
        If a field is not found, use null or empty array.
        Do not include markdown formatting like \`\`\`json. Just the raw JSON.

        Resume Text:
        ${ text.substring( 0, 10000 ) } 
        `;

        const response = await fetch( API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ API_KEY }`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify( {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful assistant that extracts structured data from resumes. Return JSON only." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            } ),
        } );

        if ( !response.ok ) {
            const errText = await response.text();
            throw new Error( `OpenAI API Error: ${ response.status } ${ response.statusText } - ${ errText }` );
        }

        const result = await response.json();
        let generatedText = result.choices[ 0 ].message.content || "{}";

        // Clean up markdown if present
        generatedText = generatedText.replace( /```json/g, "" ).replace( /```/g, "" ).trim();

        try {
            return JSON.parse( generatedText );
        } catch ( e ) {
            console.error( "Failed to parse JSON:", generatedText );
            return { raw_text: generatedText, error: "Failed to parse JSON response" };
        }
    }

    // Helper to invoke the tool directly (for our REST API usage)
    async process ( text ) {
        // In a real MCP transport, this would be handled by the SDK's connect method.
        // Here we manually invoke the tool logic we defined.
        // Accessing the internal tool definition is a bit hacky in the SDK if not using a transport,
        // so we'll just reuse the logic method or expose it.

        // For simplicity in this hybrid setup, I'll call the LLM logic directly here,
        // but the "Tool" definition above satisfies the "MCP Server" requirement if we were to hook up a transport.
        return this.callLLM( text );
    }
}

module.exports = { CvExtractionServer };
