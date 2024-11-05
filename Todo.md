# TODO

- [X] Add reranker to filter data in `findData` step
  - [X] Add Reranker class (NVidia is not yet supported on LlamaIndex TS)
- [X] Create NVIDIA version, configure Nvidia services (LLMs, Reranker)
  - [X] Utiliser OpenAI et ajouter baseUrl dans additionalSessionOptions: { baseUrl: '...' } l'url de NVIDIA
- [X] Use Nvidia embeddings
  - [X] Create embeddings class
- [X] Read matching X chunks instead of reading the file
- [X] Find multiple steps' data in one step
- [ ] Add real world application example : A story writer combining multiple wikipedia pages
- [ ] Improve documentation of the source code / logger improvements

-> Submit project to NVIDIA 🎉

Further improvements :
- [ ] Add GuardRails for answer verification
- [ ] Make multimodal data extraction
- [ ] Auto scraping with Nemo Curator
- [ ] Evaluation of the RAG with different models/API/embedings using Google RAG benchmark
- [ ] Code improvements : 
  - [ ] Use AgentContext in AgentRunner instead of Store object
