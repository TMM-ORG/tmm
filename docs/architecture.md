---

## **Viral Content Remixer Architecture Document**

## **Introduction**

This document outlines the architecture for a backend system to automatically generate videos. The design is a **monolithic service built within a Next.js application** and deployed on Vercel, using Supabase for all backend services. The architecture prioritizes simplicity and speed for the initial Proof of Concept. The project is being built from scratch.

---

## **High-Level Architecture**

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

## **Tech Stack**

| Category | Technology | Version | Rationale |
| :---- | :---- | :---- | :---- |
| **Framework** | Next.js (App Router) | 15+ | The user's preferred full-stack framework. |
| **Language** | TypeScript | 5.8+ | Provides essential type safety for a robust application. |
| **Backend Platform** | Supabase | latest | All-in-one backend with a managed Postgres DB, Auth, and Storage. |
| **Data Access** | Supabase Client | 3+ | The official, type-safe library for interacting with our Supabase backend. |
| **Authentication** | Supabase Auth | latest | Handles all user management and security securely out of the box. |
| **Video Processing** | FFmpeg (ffmpeg-static) | latest | Direct use of the FFmpeg binary for maximum performance and reliability. |
| **Deployment** | Vercel | N/A | The platform built by the creators of Next.js for seamless deployment. |
| **Testing** | Jest & Playwright | latest | Standard for unit/integration tests and end-to-end tests in Next.js. |

---

## **Data Models**

The data models will be implemented as tables in the Supabase Postgres database.

* **User Model:** Handled automatically by Supabase Auth.  
* **Video Model:** Will track each generation job and will contain fields like user\_id, status, source\_subreddit, and video\_url.

---

## **System Components & Project Structure**

The backend logic will be built as a series of services within a single Next.js application, triggered by an API route.

* **API Handler (/app/api/generate/route.ts):** The entry point that receives the request.  
* **Services (/services/\*):** Separate modules for orchestrating the workflow and interacting with Reddit, the TTS service, FFmpeg, and Supabase.
