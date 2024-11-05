import { OpenAI } from 'llamaindex';

class NvidiaNimLLM extends OpenAI {

    openai: any;

    constructor(init: Omit<Partial<OpenAI>, "session">) {

        super({
            maxTokens: 4096,
            topP: 0,
            temperature: 1,
            ...init,
            additionalSessionOptions: {
                baseURL: "https://integrate.api.nvidia.com/v1",
            }
        });
    }

    
}

export { NvidiaNimLLM };
