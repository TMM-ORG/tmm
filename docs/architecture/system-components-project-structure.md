# **System Components & Project Structure**

The backend logic will be built as a series of services within a single Next.js application, triggered by an API route.

* **API Handler (/app/api/generate/route.ts):** The entry point that receives the request.  
* **Services (/services/\*):** Separate modules for orchestrating the workflow and interacting with Reddit, the TTS service, FFmpeg, and Supabase.
