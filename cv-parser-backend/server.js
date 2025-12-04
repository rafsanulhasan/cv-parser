const express = require( 'express' );
const cors = require( 'cors' );
const fetch = require( 'node-fetch' );

const app = express();
const PORT = 3000;

// Enable CORS for frontend
app.use( cors() );

// Proxy endpoint for models
// Transformers.js requests look like: /Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json
app.get( '/models/*', async ( req, res ) => {
    const modelPath = req.params[ 0 ];
    const hfUrl = `https://huggingface.co/${ modelPath }`;

    console.log( `Proxying request for: ${ modelPath }` );

    try {
        const response = await fetch( hfUrl, {
            headers: {
                // Using provided API key
                'Authorization': `Bearer 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`
            }
        } );

        if ( !response.ok ) {
            console.error( `Failed to fetch ${ hfUrl }: ${ response.status } ${ response.statusText }` );
            return res.status( response.status ).send( response.statusText );
        }

        // Forward specific headers
        const headersToForward = [ 'content-type', 'content-length', 'last-modified', 'etag' ];
        response.headers.forEach( ( value, key ) => {
            if ( headersToForward.includes( key.toLowerCase() ) ) {
                res.setHeader( key, value );
            }
        } );

        // Pipe the response body to the client
        response.body.pipe( res );

    } catch ( error ) {
        console.error( 'Proxy error:', error );
        res.status( 500 ).send( 'Proxy error' );
    }
} );

const multer = require( 'multer' );
const path = require( 'path' );
const fs = require( 'fs' );

// Configure Multer for file uploads
const storage = multer.diskStorage( {
    destination: function ( req, file, cb ) {
        const uploadDir = 'uploads/';
        if ( !fs.existsSync( uploadDir ) ) {
            fs.mkdirSync( uploadDir );
        }
        cb( null, uploadDir );
    },
    filename: function ( req, file, cb ) {
        // Keep original filename but prepend timestamp to avoid collisions
        cb( null, Date.now() + '-' + file.originalname );
    }
} );
const upload = multer( { storage: storage } );

// Upload endpoint
app.post( '/upload', upload.single( 'file' ), ( req, res ) => {
    if ( !req.file ) {
        return res.status( 400 ).send( 'No file uploaded.' );
    }
    res.json( {
        filename: req.file.filename,
        path: req.file.path,
        originalname: req.file.originalname
    } );
} );

const { CvExtractionServer } = require( './mcp-server' );
const mcpServer = new CvExtractionServer();

// Enable JSON body parsing
app.use( express.json( { limit: '10mb' } ) );

// Extraction endpoint
app.post( '/extract', async ( req, res ) => {
    const { text } = req.body;
    if ( !text ) {
        return res.status( 400 ).send( 'Missing text' );
    }

    console.log( 'Extracting data from text...' );
    try {
        const result = await mcpServer.process( text );
        res.json( result );
    } catch ( error ) {
        console.error( 'Extraction error:', error );
        res.status( 500 ).json( { error: error.message } );
    }
} );

// Endpoint to scrape Ollama library
app.get( '/ollama/library', async ( req, res ) => {
    const type = req.query.type || 'chat'; // 'chat' or 'embedding'
    // User requested q=embedding for better results
    const queryParam = type === 'embedding' ? 'q=embedding' : 'c=chat';
    const url = `https://ollama.com/search?${ queryParam }`;

    console.log( `Fetching Ollama library: ${ url }` );

    try {
        const response = await fetch( url );
        if ( !response.ok ) {
            throw new Error( `Failed to fetch ${ url }: ${ response.statusText }` );
        }

        const html = await response.text();

        // Simple regex to extract model names from href="/library/..."
        // This assumes the search page links to model pages like /library/modelname
        const modelRegex = /href="\/library\/([^"?]+)"/g;
        const models = new Set();
        let match;

        while ( ( match = modelRegex.exec( html ) ) !== null ) {
            models.add( match[ 1 ] );
        }

        const modelList = Array.from( models ).map( name => ( {
            id: name,
            name: name, // We could try to extract a prettier name, but ID is fine for now
            type: type,
            provider: 'ollama',
            details: 'Recommended Model',
            cached: false,
            isInstalled: false
        } ) );

        res.json( modelList );

    } catch ( error ) {
        console.error( 'Scraping error:', error );
        res.status( 500 ).json( { error: error.message } );
    }
} );

app.listen( PORT, () => {
    console.log( `Backend proxy server running at http://localhost:${ PORT }` );
} );
