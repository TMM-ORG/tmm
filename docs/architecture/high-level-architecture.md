# **High-Level Architecture**

The system is a **serverless monolith**. A single Next.js API route will contain all the business logic, orchestrated as a linear workflow: API Request \-\> Reddit Fetch \-\> TTS Generation \-\> Video Assembly \-\> Supabase Storage. This design is highly cost-effective and avoids premature optimization.

Code snippet

graph TD  
    A\[User's Testers\] \--\> B{Vercel (Next.js API Route)};  
    B \--\> C\[Supabase (Auth)\];  
    B \--\> D\[Reddit API\];  
    B \--\> E\[TTS API\];  
    B \--\> F\[FFmpeg\];  
    F \--\> G\[Supabase (Storage)\];  
    G \--\> A;

---
