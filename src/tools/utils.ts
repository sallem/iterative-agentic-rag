

export async function splitTextSafely(content: string, chunkSize: number = 1000, overlap: number = 100): Promise<string[]> {
    // First split by paragraphs to avoid recursion issues
    const paragraphs = content.split(/\n\s*\n/);
    const chunks: string[] = [];

    for (const paragraph of paragraphs) {
        if (paragraph.length <= chunkSize) {
            if (paragraph.trim()) {
                chunks.push(paragraph.trim());
            }
            continue;
        }

        // Split long paragraphs into sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize) {
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
    }

    // Add overlap
    if (overlap > 0) {
        const chunksWithOverlap: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i];

            // Add text from next chunk as overlap
            if (i < chunks.length - 1) {
                const nextChunkWords = chunks[i + 1].split(' ');
                const overlapWords = nextChunkWords.slice(0, Math.floor(overlap / 10)); // Approximate words for overlap
                chunk += ' ' + overlapWords.join(' ');
            }

            chunksWithOverlap.push(chunk);
        }
        return chunksWithOverlap;
    }

    return chunks;
}
