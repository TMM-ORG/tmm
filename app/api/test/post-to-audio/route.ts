import { NextRequest, NextResponse } from 'next/server';
import { redditClient } from '@/services/reddit/client';
import { postAnalyzer } from '@/services/reddit/analyzer';
import { getElevenLabs } from '@/services/tts/elevenlabs';
import { supabaseStorage } from '@/services/storage/supabase';
import { llmTextCleaner } from '@/services/tts/llm-cleaner';

/**
 * Test endpoint for Story 1.2 - Post Selection, TTS, and Storage
 * Tests the complete workflow with real API calls:
 * 1. Fetch Reddit posts
 * 2. Select best post using algorithm
 * 3. Generate TTS audio
 * 4. Upload to Supabase
 *
 * GET /api/test/post-to-audio?subreddit=AskReddit
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Get subreddit from query params (default: AskReddit)
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit') || 'AskReddit';

    console.log(`[Test] Starting post-to-audio workflow for r/${subreddit}`);

    // 2. Fetch real Reddit posts
    console.log('[Test] Step 1: Fetching Reddit posts...');
    const posts = await redditClient.fetchTopPosts(subreddit, 10);
    console.log(`[Test] Fetched ${posts.length} posts`);

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found', code: 'NO_POSTS' },
        { status: 404 }
      );
    }

    // 3. Select best post using algorithm
    console.log('[Test] Step 2: Selecting best post...');
    const postScore = postAnalyzer.selectBestPost(posts);

    if (!postScore) {
      return NextResponse.json(
        { error: 'No suitable post found', code: 'NO_SUITABLE_POST' },
        { status: 404 }
      );
    }

    const selectedPost = postScore.post;
    console.log(`[Test] Selected post: "${selectedPost.title}" (algorithm score: ${postScore.totalScore.toFixed(2)})`);

    // 3.5. Clean text using LLM (optional, falls back to basic if API not configured)
    console.log('[Test] Step 2.5: Cleaning text with LLM...');
    let cleanedTextResult;
    let fullText;

    if (llmTextCleaner.isConfigured()) {
      try {
        cleanedTextResult = await llmTextCleaner.cleanForTTS(selectedPost);
        fullText = cleanedTextResult.cleaned;
        console.log(`[Test] LLM cleaned text: ${cleanedTextResult.wordCount} words`);
        console.log(`[Test] Changes made: ${cleanedTextResult.changes.join(', ')}`);
      } catch (error) {
        console.warn('[Test] LLM cleaning failed, using raw text:', error);
        fullText = `${selectedPost.title}. ${selectedPost.selftext || ''}`.trim();
      }
    } else {
      console.log('[Test] Groq API not configured, using raw text');
      fullText = `${selectedPost.title}. ${selectedPost.selftext || ''}`.trim();
    }

    // 4. Generate TTS audio
    console.log('[Test] Step 3: Generating TTS audio...');
    const elevenLabs = getElevenLabs();
    const audioBuffer = await elevenLabs.generateSpeech(fullText);
    console.log(`[Test] Generated audio: ${audioBuffer.length} bytes (${fullText.length} characters)`);

    // 5. Upload to Supabase Storage
    console.log('[Test] Step 4: Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const uploadResult = await supabaseStorage.uploadAudioFile(
      audioBuffer,
      `test-${selectedPost.id}-${timestamp}.mp3`,
      'audio/mpeg'
    );
    console.log(`[Test] Uploaded to: ${uploadResult.publicUrl}`);

    // 6. Save to database tables
    console.log('[Test] Step 5: Saving to database tables...');

    // Save selected post
    const savedPost = await supabaseStorage.saveSelectedPost(selectedPost, postScore);
    console.log(`[Test] Saved post to database with ID: ${savedPost.id}`);

    // Save audio file metadata
    const audioMetadata = await supabaseStorage.saveAudioFile({
      fileUrl: uploadResult.publicUrl,
      durationSeconds: Math.ceil(fullText.split(/\s+/).length / 150 * 60), // Estimate: 150 words/min
      fileSizeBytes: audioBuffer.length,
      format: 'mp3',
      ttsProvider: 'elevenlabs',
      voiceUsed: 'rachel'
    });
    console.log(`[Test] Saved audio metadata with ID: ${audioMetadata.id}`);

    // Link audio to post
    await supabaseStorage.linkAudioToPost(savedPost.id, audioMetadata.id);
    console.log(`[Test] Linked audio to post`);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 7. Return success response
    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      workflow: {
        step1_fetch: {
          subreddit,
          postsFound: posts.length
        },
        step2_select: {
          selectedPostId: selectedPost.id,
          selectedPostTitle: selectedPost.title,
          selectedPostScore: selectedPost.score,
          selectedPostComments: selectedPost.num_comments,
          algorithmScore: postScore.totalScore,
          engagementScore: postScore.engagementScore,
          textLength: postScore.textLength
        },
        step2_5_llm_cleanup: cleanedTextResult ? {
          originalLength: cleanedTextResult.original.length,
          cleanedLength: cleanedTextResult.cleaned.length,
          wordCount: cleanedTextResult.wordCount,
          changes: cleanedTextResult.changes
        } : {
          used: false,
          reason: llmTextCleaner.isConfigured() ? 'LLM cleaning failed' : 'Groq API not configured'
        },
        step3_tts: {
          audioSize: audioBuffer.length,
          audioFormat: 'mp3',
          textLength: fullText.length
        },
        step4_upload: {
          audioUrl: uploadResult.publicUrl,
          fileName: `test-${selectedPost.id}-${timestamp}.mp3`,
          fileSize: uploadResult.fileSize
        },
        step5_database: {
          savedPostId: savedPost.id,
          audioFileId: audioMetadata.id,
          linked: true
        }
      },
      allPosts: posts.map(post => ({
        id: post.id,
        title: post.title,
        score: post.score,
        comments: post.num_comments
      }))
    });

  } catch (error) {
    console.error('[Test] Workflow failed:', error);

    return NextResponse.json(
      {
        error: 'Test workflow failed',
        code: 'WORKFLOW_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
