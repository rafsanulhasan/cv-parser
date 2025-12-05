---
description: Steps for perrforming API testing
---

1. Create a script (JS or Python) and run it, make API calls
2. Verify the API calls whether intiated request and actual response are actually in the acceptance criteria.
3. ALWAYS Make sure what you were intended to do matches the actual outcome.
4. Handle exceptions or errors gracefully.
5. If ANY EXTERNAL API call is needed, ALWAYS ask the user whetehr it is required to implement retry, and exponential backoff for better reliability.