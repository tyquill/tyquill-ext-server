import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { ContentFormat } from '../../repurpose/entities';

/**
 * 멀티포맷 리퍼포징을 위한 플랫폼별 프롬프트 템플릿 서비스
 */
@Injectable()
export class RepurposePromptTemplatesService {
  private readonly blogTemplate: PromptTemplate;
  private readonly twitterTemplate: PromptTemplate;
  private readonly linkedinTemplate: PromptTemplate;
  private readonly instagramTemplate: PromptTemplate;
  private readonly youtubeTemplate: PromptTemplate;
  private readonly tiktokTemplate: PromptTemplate;
  private readonly emailTemplate: PromptTemplate;
  private readonly podcastTemplate: PromptTemplate;

  constructor() {
    // Blog 포맷 템플릿
    this.blogTemplate = PromptTemplate.fromTemplate(`
You are a professional blog writer. Transform the given article into an engaging blog post.

<rules>
- Write in markdown format with proper heading hierarchy (# to ###)
- Use a conversational yet informative tone
- Include an attention-grabbing introduction
- Structure content with clear sections and subsections
- Add actionable takeaways or key points
- Use bullet points for readability
- Include relevant examples or case studies
- Aim for 1500-2500 words
- Use --- for horizontal rules, not ***
- Bold important concepts and key phrases
- End with a clear conclusion or call-to-action
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Target Audience: {targetAudience}
Key Message: {keyMessage}
</context>

<response format>
Write the complete blog post in markdown format. Do not include meta tags or SEO fields.
</response format>`);

    // Twitter 포맷 템플릿
    this.twitterTemplate = PromptTemplate.fromTemplate(`
You are a skilled Twitter content creator. Transform the given article into an engaging Twitter thread.

<rules>
- First tweet must be a hook that captures attention (max 280 characters)
- Each tweet must be self-contained but flow naturally to the next
- Maximum 280 characters per tweet (including spaces)
- Use 🧵 emoji for thread indicators where appropriate
- Include 2-3 relevant hashtags in the last tweet only
- Use emojis strategically to add personality (but don't overdo it)
- Make complex ideas digestible and tweet-sized
- Create 5-10 tweets depending on content depth
- Number tweets (1/n format) in the first tweet
- End with a call-to-action or thought-provoking question
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "tweets": [
    "Tweet 1 content (max 280 chars)",
    "Tweet 2 content (max 280 chars)",
    ...
  ],
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}}
</response format>`);

    // LinkedIn 포맷 템플릿
    this.linkedinTemplate = PromptTemplate.fromTemplate(`
You are a professional LinkedIn content strategist. Transform the given article into a compelling LinkedIn post.

<rules>
- Start with a strong hook (first 2-3 lines are crucial)
- Use a professional yet personable tone
- Maximum 3000 characters (LinkedIn limit)
- Structure with short paragraphs (2-3 sentences each)
- Use line breaks for readability
- Include 3-5 relevant hashtags at the end
- Add a professional call-to-action
- Focus on insights, lessons, or professional value
- Use emojis sparingly and professionally
- Can include bullet points for key takeaways
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Professional Context: {professionalContext}
Key Message: {keyMessage}
</context>

<response format>
Write the complete LinkedIn post as plain text with line breaks. Include hashtags at the end.
</response format>`);

    // Instagram 포맷 템플릿
    this.instagramTemplate = PromptTemplate.fromTemplate(`
You are an engaging Instagram content creator. Transform the given article into an Instagram caption.

<rules>
- Start with an attention-grabbing first line
- Use a casual, relatable tone
- Maximum 2200 characters (Instagram limit)
- Use emojis naturally throughout the text
- Structure with short paragraphs and line breaks
- Include storytelling elements when possible
- Add 15-30 relevant hashtags at the end
- Use the caption to complement visual content
- Include a clear call-to-action
- Make it visually scannable
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Visual Context: {visualContext}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "caption": "Instagram caption text with emojis",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "suggestedVisuals": "Brief description of recommended image/video type"
}}
</response format>`);

    // YouTube 포맷 템플릿
    this.youtubeTemplate = PromptTemplate.fromTemplate(`
You are a professional YouTube script writer. Transform the given article into an engaging video script.

<rules>
- Start with a hook (first 15 seconds)
- Include a brief intro/channel greeting
- Write in a conversational, spoken-word style
- Structure with clear sections and timestamps
- Include visual cues [like this] for the editor
- Add retention hooks throughout
- Include pattern interrupts every 2-3 minutes
- Write transitions between sections
- End with a strong call-to-action and outro
- Aim for 8-15 minute script (approximately 1500-2500 words)
- Include suggested B-roll or visual elements
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Channel Style: {channelStyle}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "script": "Full video script in spoken-word format",
  "timestamps": [
    {{ "time": "0:00", "title": "Intro & Hook" }},
    {{ "time": "0:45", "title": "Main Point 1" }},
    ...
  ],
  "visualCues": ["Cue 1", "Cue 2", ...]
}}
</response format>`);

    // TikTok 포맷 템플릿
    this.tiktokTemplate = PromptTemplate.fromTemplate(`
You are a viral TikTok content creator. Transform the given article into a punchy TikTok script.

<rules>
- Hook within first 3 seconds is CRITICAL
- Maximum 60-90 seconds of content
- Use short, punchy sentences
- Write in a casual, energetic tone
- Include visual cues [like this] for transitions
- Build curiosity and maintain fast pacing
- Use popular phrases or trends where appropriate
- Include text overlay suggestions
- Add a clear call-to-action at the end
- Aim for 150-250 words total
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "script": "TikTok script with [visual cues]",
  "textOverlays": ["Text 1", "Text 2", ...],
  "hashtags": ["hashtag1", "hashtag2", ...],
  "soundSuggestion": "Suggested trending sound or music type"
}}
</response format>`);

    // Email 포맷 템플릿
    this.emailTemplate = PromptTemplate.fromTemplate(`
You are a professional email newsletter writer. Transform the given article into an engaging email newsletter.

<rules>
- Write a compelling subject line (max 50 characters)
- Start with a personalized greeting
- Use a conversational, direct tone
- Structure with clear sections and headers
- Keep paragraphs short (2-4 sentences)
- Include 1-2 primary call-to-action buttons
- Use bullet points for scannability
- Add a PS section for extra engagement
- Include social sharing options suggestion
- Aim for 500-1000 words (3-5 minute read)
- Write in HTML-friendly markdown
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Audience Segment: {audienceSegment}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "subjectLine": "Email subject line (max 50 chars)",
  "preheader": "Preview text (max 100 chars)",
  "body": "Email body in markdown format",
  "cta": [
    {{ "text": "Primary CTA", "type": "primary" }},
    {{ "text": "Secondary CTA", "type": "secondary" }}
  ]
}}
</response format>`);

    // Podcast 포맷 템플릿
    this.podcastTemplate = PromptTemplate.fromTemplate(`
You are a professional podcast script writer. Transform the given article into a natural, conversational podcast script.

<rules>
- Write in a warm, conversational tone
- Use natural speech patterns and contractions
- Include pauses [pause] and emphasis *emphasis* markers
- Structure with clear segments and transitions
- Add personal anecdotes or relatable examples
- Include questions to engage listeners
- Write in first-person perspective
- Add "umm" or "you know" sparingly for naturalness
- Include intro and outro music cues
- Aim for 10-20 minutes (approximately 1800-3000 words)
- Add production notes [like this] for the editor
</rules>

<context>
Original Article Title: {title}
Original Article Content: {content}
Podcast Style: {podcastStyle}
Host Personality: {hostPersonality}
Key Message: {keyMessage}
</context>

<response format>
Return a JSON object with this structure:
{{
  "script": "Full podcast script with [production notes] and *emphasis*",
  "segments": [
    {{ "timestamp": "0:00", "title": "Intro" }},
    {{ "timestamp": "2:30", "title": "Main Topic" }},
    ...
  ],
  "episodeTitle": "Suggested episode title",
  "episodeDescription": "Brief description for podcast apps (max 200 chars)"
}}
</response format>`);
  }

  /**
   * 포맷에 맞는 프롬프트 템플릿 반환
   */
  getTemplateByFormat(format: ContentFormat): PromptTemplate {
    switch (format) {
      case ContentFormat.BLOG:
        return this.blogTemplate;
      case ContentFormat.TWITTER:
        return this.twitterTemplate;
      case ContentFormat.LINKEDIN:
        return this.linkedinTemplate;
      case ContentFormat.INSTAGRAM:
        return this.instagramTemplate;
      case ContentFormat.YOUTUBE:
        return this.youtubeTemplate;
      case ContentFormat.TIKTOK:
        return this.tiktokTemplate;
      case ContentFormat.EMAIL:
        return this.emailTemplate;
      case ContentFormat.PODCAST:
        return this.podcastTemplate;
      default:
        throw new Error(`Unsupported content format: ${format}`);
    }
  }

  /**
   * 여러 포맷의 템플릿을 한번에 가져오기
   */
  getTemplatesByFormats(formats: ContentFormat[]): Map<ContentFormat, PromptTemplate> {
    const templates = new Map<ContentFormat, PromptTemplate>();
    formats.forEach(format => {
      templates.set(format, this.getTemplateByFormat(format));
    });
    return templates;
  }

  /**
   * 모든 포맷의 템플릿 가져오기
   */
  getAllTemplates(): Map<ContentFormat, PromptTemplate> {
    return new Map([
      [ContentFormat.BLOG, this.blogTemplate],
      [ContentFormat.TWITTER, this.twitterTemplate],
      [ContentFormat.LINKEDIN, this.linkedinTemplate],
      [ContentFormat.INSTAGRAM, this.instagramTemplate],
      [ContentFormat.YOUTUBE, this.youtubeTemplate],
      [ContentFormat.TIKTOK, this.tiktokTemplate],
      [ContentFormat.EMAIL, this.emailTemplate],
      [ContentFormat.PODCAST, this.podcastTemplate],
    ]);
  }
}
