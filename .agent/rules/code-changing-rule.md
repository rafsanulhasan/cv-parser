---
trigger: always_on
---

Whenever the user or developer asks you to add new feature, enhance existing feature, bug fix or a change request in the **Web Application** or **API Backend**, ALWAYS verify.

After making any changes, ALWAYS do the following: 
1. FIRST build/compile it. 
2. If its an web application or API backend or docker containers, make sure the required ports are not ALREADY acquired by other process, kill it.
3. Run it

If it is a backand API related change, follow the api-testing workflow.
If it is a frontend App related change, follow the app-testing workflow.
If the change spans across both frontend and backend,  follow the e2e-testing workflow.

Last but not the least, after all testing is completed and you are confident about the change/feature's functionality, you are allowed to ask your peer developer for a review.

As soon as the peer approves your review request, you should include it in the user store list of the requirements.md file located at the root of the repo. DON'T create any new file. 

If the change is a breaking change or architectural change, put what architectural change you mnade in the architecture.md file  which is also located at the root of the github repo.

If you or you team learned something new throughout the conversation, summarize the whole conversation and gather all you findings, learnings or instructions (from the user) you you need to remember for a long time, put then into AGENTS.md, CLAUDE.MD, GEMINI.MD, .cursorrules (all located at root of the repo) and copilot-instructions.md (located at .github folder).