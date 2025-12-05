---
description: End to End testing Workflow
---

1. Open the Frontend app in your preferred browser: Antigravity Extensions is installed in both Microsoft Edge and Google Chrome
2. Analyze the original change request, user story or feature request, and make a plan (and ask the user for plans approval) to act with the browser accordingly in order for yourself to test the new change. If needed look at the DOM, Browser Dev tool: Network, Storage and Logs, Or even do a Web Search to know more about this. if you are unsure about anything, ALWAYS ask the user. DON'T make any critical changes, that can break things up, without the user's consent.
3. Execute the Plan in such a way so that you can monitor and test the api requests and handle exceptions gracefully by looking at the browser dev tools network tab and analyzing the request and the corresponding response and console logs to identify the potential problem.