import { getWikiPages } from './initWikipedia';
import { embedFiles } from './embedFiles';

async function initialize() {
    console.log('Starting initialization process...');
    
    console.log('\n1. Fetching Wikipedia pages...');
    await getWikiPages();
    
    console.log('\n2. Embedding files...');
    await embedFiles();
    
    console.log('\nInitialization complete!');
}

// Execute if this file is run directly
if (require.main === module) {
    initialize()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Initialization failed:', error);
            process.exit(1);
        });
}

export { initialize };
