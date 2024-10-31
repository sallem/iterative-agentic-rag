# TODO

- [X] Write LlamaIndex Agent class with Iterative Agentic RAG
- [ ] Add reranker to filter data in `findData` step
  - [X] Add Reranker class (NVidia is not yet supported on LlamaIndex TS)
- [ ] Create NVIDIA version, configure Nvidia services (LLMs, Reranker)
  - [ ] Utiliser OpenAI et ajouter baseUrl dans additionalSessionOptions: { baseUrl: '...' } l'url de NVIDIA
- [ ] Use Nvidia embeddings
  - [X] Create embeddings class
- [ ] Add GuardRails for answer verification
- [ ] Improve documentation of the source code / logger improvements

- [ ] Add real world application example

- [ ] Make multimodal data extraction
- [ ] Auto scraping with Nemo Curator
- [ ] Evaluation of the RAG with different models/API/embedings using Google RAG benchmark
- [ ] Code improvements : 
  - [ ] Use AgentContext in AgentRunner instead of Store object
