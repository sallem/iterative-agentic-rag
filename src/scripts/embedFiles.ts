import fs from 'fs';
import { Document, QdrantVectorStore } from "llamaindex";
import { OllamaEmbedding, SentenceSplitter, Metadata } from "llamaindex";
import { Settings } from "llamaindex";
import { NvidiaEmbedding } from '../embeddings/NvidiaEmbedding';
import { CONFIG } from '../config';
import { splitTextSafely } from '../tools/utils';

async function embedFiles() {

    // Settings.embedModel = new NvidiaEmbedding({ model: CONFIG.embeddings.model, apiKey: CONFIG.llm.nvidiaNimApiKey ?? "" });
    Settings.embedModel = new OllamaEmbedding({ model: CONFIG.embeddings.model });

    const vectorStore = new QdrantVectorStore({
        url: CONFIG.vectorStore.qdrantUrl,
        collectionName: "FILES",
    });

    const files = await fs.promises.readdir('./input_wikipedia');
    for (let file of files) {
        try {
            console.log("Processing file:", file);

            if (file.endsWith('.txt')) {
                const content = fs.readFileSync(`./input_wikipedia/${file}`, 'utf8');

                // Check if file is already processed
                const filter = {
                    must: [{
                        key: "file",
                        match: { value: file }
                    }]
                };

                try {
                    const already = await vectorStore.client().scroll("FILES", { filter });
                    if (already.points.length > 0) {
                        console.log(`File ${file} already processed, skipping`);
                        continue;
                    }
                } catch (error) {
                    console.error(`Error checking if file ${file} is already processed:`, error);
                }

                // Use our custom text splitter
                const nodes = await splitTextSafely(content, 2000, 100);
                console.log(`Split ${file} into ${nodes.length} chunks`);

                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    if (!node.trim()) continue;

                    console.log(`Embedding chunk ${i + 1}/${nodes.length} of ${file}`);

                    try {
                        const embedding = await Settings.embedModel.getTextEmbedding(node);
                        await vectorStore.add([new Document<Metadata>({
                            // id_: `${file}_${i}`,
                            text: node,
                            embedding: embedding,
                            metadata: {
                                file: file,
                                chunk: i
                            }
                        })]);
                    } catch (embedError) {
                        console.error(`Error embedding chunk ${i} of ${file}:`, embedError);
                        continue;
                    }

                    // Add a small delay between chunks
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
}

// Execute if this file is run directly
if (require.main === module) {
    embedFiles()
        .then(() => console.log('File embedding completed'))
        .catch(error => console.error('Error:', error));
}

export { embedFiles };
