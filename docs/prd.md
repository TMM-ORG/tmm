---

# **Viral Content Remixer Product Requirements Document (PRD)**


# **Goals and Background Context**

## **Goals**

The primary goal of this initial version is to serve as a **Proof of Concept (POC)**. The objectives are to:

* **Prove Technical Feasibility:** Confirm the agent can reliably generate a complete video from a Reddit post.  
* **Validate Output Quality:** Ensure the generated videos are of a "postable" quality as determined by initial testers.  
* **Gather Qualitative Feedback:** Collect detailed feedback to inform the development of a public-facing SaaS product.

## **Background Context**

Content creators spend hours manually finding trending stories on platforms like Reddit and then use multiple tools to create short-form "story time" videos. This process is slow, inefficient, and limits their ability to capitalize on fast-moving trends.

This project aims to solve that problem by creating an automated agent that turns a user-provided subreddit into a ready-to-post video, transforming a multi-hour process into a single, automated action.

---

# **Requirements**

## **Functional Requirements (FR)**

* **FR1:** The system must accept a subreddit name as user input.  
* **FR2:** The system must connect to the Reddit API and fetch the current top 10 "hot" posts from the specified subreddit.  
* **FR3:** The system must contain logic to analyze the 10 posts and select the single best candidate for video creation.  
* **FR4:** The system must extract the title and body text from the selected Reddit post.  
* **FR5:** The system must integrate with a premium TTS API to generate a high-quality audio voiceover.  
* **FR6:** The system must select a video file from a pre-populated library of generic background footage.  
* **FR7:** The system must use a video processing library to combine the audio voiceover with the background video.  
* **FR8:** The system must provide a way for the user to trigger this process and download the final video file.

## **Non-Functional Requirements (NFR)**

* **NFR1:** The end-to-end video generation process for a 60-second video should complete in under 2 minutes.  
* **NFR2:** The system's successful video generation rate must be \>95% during testing.  
* **NFR3:** The output video resolution must be at least 720p.  
* **NFR4:** The system must gracefully handle potential errors.

---

## **User Interface Design Goals**

*While the initial POC is backend-only, this section outlines goals for the future SaaS product.*

* **Overall UX Vision:** A minimalist, friction-free user experience.  
* **Core Screens:** The future application will consist of a main input screen, a processing/results screen, and a user dashboard.

---

## **Technical Assumptions**

The definitive technical stack is outlined in the Architecture Document. The architecture is centered on a **Next.js** application deployed on **Vercel**, using **Supabase** for all backend services including the database, authentication, and file storage.

---

# **Epic and Story Structure**

## **Epic 1: Core Video Generation Engine (POC)**

**Goal:** To build the foundational backend service that implements the complete workflow, from taking a subreddit as input to providing a downloadable video file.

## **Story 1.1: Project Setup & Reddit Integration**

* **As a** developer, **I want** to set up the Next.js project and connect to the Reddit API, **so that** I can fetch the top 10 posts from any given subreddit.

## **Story 1.2: Post Selection & TTS Integration**

* **As a** developer, **I want** to create a service that analyzes the 10 fetched posts, selects the best one, and sends its text to a TTS API, **so that** I can generate the audio voiceover for the video.

## **Story 1.3: Video Assembly & API Endpoint**

* **As a** developer, **I want** to create a service that combines the generated audio with a background video and exposes this workflow via an API endpoint, **so that** testers can trigger the video creation process and download the result.
