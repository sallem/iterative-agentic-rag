import fetch from "cross-fetch";
import { BaseNode, NodeWithScore, BaseNodePostprocessor, MetadataMode, MessageContent } from "llamaindex";

interface NvidiaRerankerConfig {
    apiKey: string;
    model?: string;
}

interface NvidiaRerankerResponse {
    rankings: Array<{
        logit: number;
        index: number;
    }>;
}

export class NvidiaReranker implements BaseNodePostprocessor {
    private apiKey: string;
    private model: string;
    private invokeUrl: string;

    constructor(config: NvidiaRerankerConfig) {
        this.apiKey = config.apiKey;
        this.model = config.model || "nvidia/llama-3.2-nv-rerankqa-1b-v1";
        // Construct the URL using the model name
        const modelPath = this.model.replace(/\./g, '_').replace(/\//g, '/');
        this.invokeUrl = `https://ai.api.nvidia.com/v1/retrieval/${modelPath}/reranking`;
    }

    async postprocessNodes(nodes: NodeWithScore[], query?: MessageContent): Promise<NodeWithScore[]> {
        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
        };

        const payload = {
            model: this.model,
            query: {
                text: query?.toString() || ""
            },
            passages: nodes.map(node => ({
                text: node.node.getContent(MetadataMode.NONE)
            }))
        };

        try {
            const response = await fetch(this.invokeUrl, {
                method: "POST",
                body: JSON.stringify(payload),
                headers
            });

            if (!response.ok) {
                throw new Error(`Nvidia Reranker API error: ${response.statusText}`);
            }

            const result = await response.json() as NvidiaRerankerResponse;

            // console.log("Reranking result : ", result)

            // Convert the reranking scores to NodeWithScore objects
            return result.rankings.map((ranking: { index: number, logit: number }) => ({
                node: nodes[ranking.index].node,
                score: ranking.logit
            }))

        } catch (error) {
            if (process.env.DEBUG === 'true') console.error("Error in Nvidia reranking:", error, nodes, query);
            // Return original nodes with default scores if reranking fails
            return nodes.map(nodeWithScore => ({
                node: nodeWithScore.node,
                score: 1.0
            }));
        }
    }
} 