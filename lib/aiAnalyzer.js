import { GoogleGenerativeAI } from '@google/generative-ai'

class AIAnalyzer {
  constructor() {
    this.isAvailable = false
    this.model = null
    this.rateLimiter = {
      requests: 0,
      lastReset: Date.now(),
      maxRequestsPerMinute: parseInt(process.env.MAX_AI_REQUESTS_PER_MINUTE) || 15
    }

    this.initializeAI()
  }

  initializeAI() {
    if (!process.env.GOOGLE_API_KEY) {
      console.warn('⚠️ No Google API key found. AI analysis will be disabled.')
      return
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
      // Use gemini-2.5-flash as the primary model
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      console.log('🤖 AI Analyzer initialized with Gemini 2.5 Flash')
      this.isAvailable = true
    } catch (error) {
      console.error('❌ Failed to initialize AI Analyzer:', error.message)
      this.isAvailable = false
    }
  }

  async analyzeContent(content) {
    if (!this.isAvailable || !this.model) {
      console.warn('⚠️ AI analysis not available, using fallback analysis')
      return this.fallbackAnalysis(content)
    }

    if (!this.canMakeRequest()) {
      console.warn('⚠️ Rate limit reached, using fallback analysis')
      return this.fallbackAnalysis(content)
    }

    try {
      console.log(`🤖 Analyzing content: ${content.title}`)
      
      const prompt = this.buildAnalysisPrompt(content)
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const analysis = response.text()

      const parsedAnalysis = this.parseAIResponse(analysis)
      
      // Update rate limiter
      this.rateLimiter.requests++
      
      console.log(`✅ AI analysis completed for: ${content.title}`)
      return {
        success: true,
        analysis: parsedAnalysis
      }

    } catch (error) {
      console.error(`❌ AI analysis failed for ${content.title}:`, error.message)
      
      // Check if it's a quota/rate limit error
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
        console.warn('⚠️ API quota exceeded, switching to fallback analysis')
        this.isAvailable = false // Disable AI temporarily
        setTimeout(() => {
          this.isAvailable = true // Re-enable after some time
        }, 60000) // Wait 1 minute before trying again
      }
      
      // Update rate limiter even on failure
      this.rateLimiter.requests++
      
      return {
        success: false,
        error: error.message,
        analysis: this.fallbackAnalysis(content)
      }
    }
  }

  async analyzeEnhancedContent(enhancedContent) {
    if (!this.isAvailable || !this.model) {
      console.warn('⚠️ AI analysis not available, using enhanced fallback analysis')
      return {
        success: false,
        error: 'AI not available',
        analysis: this.enhancedFallbackAnalysis(enhancedContent)
      }
    }

    if (!this.canMakeRequest()) {
      console.warn('⚠️ Rate limit reached, using enhanced fallback analysis')
      return {
        success: false,
        error: 'Rate limit reached',
        analysis: this.enhancedFallbackAnalysis(enhancedContent)
      }
    }

    // Try with retry logic
    const maxRetries = 3
    let lastError = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 Analyzing enhanced content (attempt ${attempt}/${maxRetries}) with ${enhancedContent.comments?.length || 0} comments: ${enhancedContent.title}`)
        
        const prompt = this.buildEnhancedAnalysisPrompt(enhancedContent)
        const result = await this.model.generateContent(prompt)
        const response = await result.response
        const analysis = response.text()

        const parsedAnalysis = this.parseAIResponse(analysis)
        
        // Update rate limiter
        this.rateLimiter.requests++
        
        console.log(`✅ Enhanced AI analysis completed for: ${enhancedContent.title}`)
        return {
          success: true,
          analysis: parsedAnalysis
        }

      } catch (error) {
        lastError = error
        console.error(`❌ Enhanced AI analysis failed (attempt ${attempt}/${maxRetries}) for ${enhancedContent.title}:`, error.message)
        
        // Check if it's a quota/rate limit error
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Too Many Requests')) {
          console.warn(`⚠️ API quota exceeded on attempt ${attempt}, ${attempt < maxRetries ? 'retrying...' : 'using fallback'}`)
          
          if (attempt < maxRetries) {
            // Exponential backoff: wait 2^attempt seconds
            const waitTime = Math.pow(2, attempt) * 1000
            console.log(`⏳ Waiting ${waitTime/1000} seconds before retry...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          } else {
            // Final attempt failed, disable AI temporarily
            this.isAvailable = false
            setTimeout(() => {
              this.isAvailable = true
              console.log('✅ AI re-enabled after quota cooldown')
            }, 60000) // Wait 1 minute
          }
        } else {
          // Non-quota error, don't retry
          break
        }
      }
    }
    
    // Update rate limiter even on failure
    this.rateLimiter.requests++
    
    console.log('🔄 All AI attempts failed, using enhanced fallback analysis')
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      analysis: this.enhancedFallbackAnalysis(enhancedContent)
    }
  }

  buildAnalysisPrompt(content) {
    return `You are an expert content analyst. Analyze the following tech content and provide a comprehensive summary that captures ALL important points so the reader doesn't need to read the full article.

Title: ${content.title}
Full Content: ${content.content || content.summary}
URL: ${content.url}
Source: ${content.source}
Category: ${content.category}

Your task is to create a detailed summary that includes:
1. Main topic and purpose of the article
2. Key points, arguments, or findings
3. Important data, statistics, or examples mentioned
4. Technical details, methodologies, or approaches discussed
5. Conclusions, recommendations, or takeaways
6. Any notable quotes, insights, or expert opinions

Return a JSON response with the following structure:
{
  "postSummary": "A comprehensive 3-5 sentence summary covering the main topic, key points, important findings, and conclusions from the article. Include specific details, data, and insights mentioned in the content.",
  "communityGist": "What aspects of this content would generate discussion? What are the controversial points, practical applications, or thought-provoking elements that people would debate or share?",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "readingTime": number_in_minutes,
  "targetAudience": "description of who this content is for"
}

IMPORTANT: 
- Extract ALL important information from the content
- Include specific details, numbers, examples, and key insights
- Make the summary comprehensive enough that someone doesn't need to read the original
- Focus on actionable insights and practical takeaways
- Identify what makes this content valuable or unique

Return only valid JSON, no additional text.`
  }

  buildEnhancedAnalysisPrompt(enhancedContent) {
    const commentsSection = enhancedContent.comments && enhancedContent.comments.length > 0 
      ? `\nComments (${enhancedContent.comments.length} total):\n${enhancedContent.comments.map(comment => `- ${comment.author}: ${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}`).join('\n').substring(0, 3000)}`
      : '\nNo comments available.'

    return `You are an expert content analyst. Analyze the following tech content AND its community discussion to provide comprehensive insights.

Title: ${enhancedContent.title}
Full Content: ${enhancedContent.fullContent || enhancedContent.summary}
URL: ${enhancedContent.url}
Source: ${enhancedContent.source}
Category: ${enhancedContent.category}${commentsSection}

Your task is to create two distinct summaries:

1. **POST SUMMARY**: A comprehensive summary of the actual article/post content covering:
   - Main topic and key points
   - Important data, statistics, examples, and technical details
   - Conclusions, recommendations, and actionable takeaways
   - What makes this content valuable or unique

2. **COMMUNITY GIST**: An analysis of what people are discussing in the comments:
   - Main themes and concerns raised by commenters
   - Different perspectives and opinions expressed
   - Debates, questions, and practical experiences shared
   - Community sentiment and engagement patterns

Return a JSON response with the following structure:
{
  "postSummary": "A comprehensive 4-6 sentence summary of the article content with specific details, key insights, and actionable information",
  "communityGist": "A 3-4 sentence summary of what the community is discussing, their main concerns, opinions, and the overall sentiment of the discussion",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "readingTime": number_in_minutes,
  "targetAudience": "description of who this content is for"
}

IMPORTANT: 
- POST SUMMARY should focus ONLY on the article content itself
- COMMUNITY GIST should focus ONLY on the discussion and comments
- Include specific details, numbers, and examples from both content and comments
- Make summaries comprehensive enough that someone doesn't need to read the original
- If no comments are available, focus the community gist on likely discussion points

Return only valid JSON, no additional text.`
  }

  parseAIResponse(response) {
    try {
      // Extract JSON from response (remove any markdown formatting)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      // Validate and sanitize the response
      return {
        postSummary: parsed.postSummary || 'No summary available.',
        communityGist: parsed.communityGist || 'No community gist available.',
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 3) : [],
        readingTime: this.validateReadingTime(parsed.readingTime),
        targetAudience: parsed.targetAudience || 'General developers'
      }

    } catch (error) {
      console.error('❌ Failed to parse AI response:', error.message)
      return this.fallbackAnalysis()
    }
  }

  validateReadingTime(time) {
    const num = parseInt(time)
    return isNaN(num) || num < 1 ? 5 : Math.min(num, 60) // Cap at 60 minutes
  }

  fallbackAnalysis(content) {
    console.log(`🔄 Using fallback analysis for: ${content.title}`)
    
    const text = `${content.title} ${content.content || content.summary || ''}`
    const wordCount = text.split(/\s+/).length
    
    // Generate comprehensive post summary based on actual content
    let postSummary = 'This content discusses technology-related topics.'
    
    // Extract key information patterns from the content
    const lowerText = text.toLowerCase()
    
    // Check for specific content patterns and extract key points
    if (lowerText.includes('job') || lowerText.includes('career') || lowerText.includes('hiring')) {
      const experienceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?experience/gi)
      const skillsMatch = text.match(/(?:skills?|technologies?|expertise)[:\s]*([^.]+)/gi)
      const locationMatch = text.match(/(?:location|based|remote|wfh|work\s*from\s*home)/gi)
      
      let experience = experienceMatch ? experienceMatch[0] : ''
      let skills = skillsMatch ? skillsMatch[0].replace(/^skills?:\s*/i, '') : ''
      let location = locationMatch ? 'Remote/Work from Home available' : ''
      
      postSummary = `This is a job-seeking post from a developer with ${experience} experience. ${skills} ${location} The developer is actively looking for opportunities and open to networking and referrals.`
    } else if (lowerText.includes('tutorial') || lowerText.includes('how to') || lowerText.includes('guide')) {
      const stepsMatch = text.match(/(\d+)\s*(?:steps?|parts?|sections?)/gi)
      const toolsMatch = text.match(/(?:using|with|via)\s+([a-zA-Z0-9\s]+)/gi)
      
      let steps = stepsMatch ? `The tutorial covers ${stepsMatch[0]}` : 'The tutorial provides step-by-step instructions'
      let tools = toolsMatch ? ` using ${toolsMatch[0].replace(/^using\s+/i, '')}` : ''
      
      postSummary = `${steps}${tools}. It includes practical examples, code snippets, and best practices for implementation.`
    } else if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) {
      const modelMatch = text.match(/(?:model|algorithm|framework|tool)\s+([a-zA-Z0-9\s]+)/gi)
      const applicationMatch = text.match(/(?:application|use\s*case|implementation)\s+([^.]+)/gi)
      const performanceMatch = text.match(/(\d+(?:\.\d+)?%?)\s*(?:accuracy|performance|improvement)/gi)
      
      let models = modelMatch ? ` focusing on ${modelMatch[0]}` : ''
      let applications = applicationMatch ? ` with applications in ${applicationMatch[0]}` : ''
      let performance = performanceMatch ? ` achieving ${performanceMatch[0]} performance` : ''
      
      postSummary = `This article discusses AI/ML technologies${models}${applications}${performance}. It covers implementation strategies, challenges, and future implications for the industry.`
    } else if (lowerText.includes('startup') || lowerText.includes('business') || lowerText.includes('entrepreneur')) {
      const fundingMatch = text.match(/(\$\d+[KMB]?)\s*(?:funding|investment|revenue)/gi)
      const growthMatch = text.match(/(\d+(?:\.\d+)?%?)\s*(?:growth|increase|improvement)/gi)
      const strategyMatch = text.match(/(?:strategy|approach|methodology)\s+([^.]+)/gi)
      
      let funding = fundingMatch ? ` with ${fundingMatch[0]} in funding/revenue` : ''
      let growth = growthMatch ? ` showing ${growthMatch[0]} growth` : ''
      let strategy = strategyMatch ? ` using ${strategyMatch[0]} strategy` : ''
      
      postSummary = `This content covers startup and business topics${funding}${growth}${strategy}. It includes market analysis, growth strategies, and entrepreneurial insights.`
    } else if (lowerText.includes('news') || lowerText.includes('update') || lowerText.includes('announcement')) {
      const companyMatch = text.match(/(?:company|firm|startup)\s+([a-zA-Z0-9\s]+)/gi)
      const impactMatch = text.match(/(?:impact|effect|influence)\s+([^.]+)/gi)
      
      let company = companyMatch ? ` from ${companyMatch[0]}` : ''
      let impact = impactMatch ? ` with potential impact on ${impactMatch[0]}` : ''
      
      postSummary = `This is a news article or update${company}${impact}. It provides the latest developments, industry changes, and their implications for the tech community.`
    } else if (lowerText.includes('discussion') || lowerText.includes('question') || lowerText.includes('opinion')) {
      const topicMatch = text.match(/(?:discussing|questioning|opinion\s+on)\s+([^.]+)/gi)
      
      let topic = topicMatch ? ` focusing on ${topicMatch[0]}` : ''
      
      postSummary = `This is a discussion post or opinion piece${topic}. It presents different perspectives, community viewpoints, and encourages engagement on the topic.`
    }

    // Generate community gist based on actual content
    let communityGist = 'People are likely discussing the technical aspects and practical applications of this content.'
    
    if (lowerText.includes('job') || lowerText.includes('career') || lowerText.includes('hiring')) {
      communityGist = 'People are likely discussing job market trends, sharing career advice, offering networking opportunities, and providing referrals or job openings.'
    } else if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) {
      communityGist = 'People are likely debating AI implementation strategies, discussing ethical implications, sharing practical use cases, and exploring future industry impacts.'
    } else if (lowerText.includes('startup') || lowerText.includes('business') || lowerText.includes('entrepreneur')) {
      communityGist = 'People are likely discussing business strategies, sharing startup experiences, debating funding approaches, and exchanging entrepreneurial insights.'
    } else if (lowerText.includes('react') || lowerText.includes('angular') || lowerText.includes('frontend')) {
      communityGist = 'People are likely comparing frameworks, sharing coding best practices, discussing performance optimization, and debating architectural decisions.'
    } else if (lowerText.includes('programming') || lowerText.includes('coding') || lowerText.includes('development')) {
      communityGist = 'People are likely sharing coding techniques, discussing development methodologies, debating best practices, and exchanging technical problem-solving approaches.'
    }

    const readingTime = Math.max(1, Math.ceil(wordCount / 200))

    // Generate key topics based on actual content analysis
    const keyTopics = []
    if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) {
      keyTopics.push('AI/ML')
    }
    if (lowerText.includes('startup') || lowerText.includes('business') || lowerText.includes('entrepreneur')) {
      keyTopics.push('Startups/Business')
    }
    if (lowerText.includes('react') || lowerText.includes('angular') || lowerText.includes('frontend')) {
      keyTopics.push('Frontend Development')
    }
    if (lowerText.includes('programming') || lowerText.includes('coding') || lowerText.includes('development')) {
      keyTopics.push('Programming/Development')
    }
    if (lowerText.includes('job') || lowerText.includes('career') || lowerText.includes('hiring')) {
      keyTopics.push('Jobs/Careers')
    }
    if (lowerText.includes('web') || lowerText.includes('frontend') || lowerText.includes('backend')) {
      keyTopics.push('Web Development')
    }
    if (lowerText.includes('mobile') || lowerText.includes('app') || lowerText.includes('ios') || lowerText.includes('android')) {
      keyTopics.push('Mobile Development')
    }
    if (lowerText.includes('data') || lowerText.includes('database') || lowerText.includes('analytics')) {
      keyTopics.push('Data/Analytics')
    }
    if (lowerText.includes('cloud') || lowerText.includes('aws') || lowerText.includes('azure')) {
      keyTopics.push('Cloud Computing')
    }
    if (lowerText.includes('security') || lowerText.includes('cybersecurity') || lowerText.includes('privacy')) {
      keyTopics.push('Security/Privacy')
    }
    if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux')) {
      keyTopics.push('Design/UX')
    }
    
    // If no specific topics found, add general tech
    if (keyTopics.length === 0) {
      keyTopics.push('Technology')
    }

    return {
      postSummary,
      communityGist,
      keyTopics,
      readingTime,
      targetAudience: 'General developers and tech enthusiasts'
    }
  }

  enhancedFallbackAnalysis(enhancedContent) {
    console.log(`🔄 Using enhanced fallback analysis for: ${enhancedContent.title}`)
    
    const fullText = `${enhancedContent.title} ${enhancedContent.fullContent || enhancedContent.summary || ''}`
    const comments = enhancedContent.comments || []
    const wordCount = fullText.split(/\s+/).length
    
    // Generate comprehensive post summary based on full content
    let postSummary = this.generateDetailedPostSummary(fullText, enhancedContent)
    
    // Generate community gist based on actual comments or predicted discussion
    let communityGist = this.generateCommunityGist(comments, fullText, enhancedContent)
    
    const readingTime = Math.max(1, Math.ceil(wordCount / 200))
    
    // Generate key topics based on content and comments analysis
    const keyTopics = this.extractEnhancedKeyTopics(fullText, comments)
    
    return {
      postSummary,
      communityGist,
      keyTopics,
      readingTime,
      targetAudience: 'General developers and tech enthusiasts'
    }
  }

  generateDetailedPostSummary(text, content) {
    const lowerText = text.toLowerCase()
    
    // Extract specific details and metrics
    const numbersMatches = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:%|percent|million|billion|thousand|k|m|b|years?|months?|days?|hours?|minutes?|seconds?|dollars?|\$|€|£)/gi) || []
    const percentageMatches = text.match(/(\d+(?:\.\d+)?)\s*%/gi) || []
    const timeMatches = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|months?|weeks?|days?|hours?|minutes?|mins?|seconds?)/gi) || []
    const moneyMatches = text.match(/(?:\$|€|£)(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:million|billion|thousand|k|m|b)?/gi) || []
    
    let summary = ''
    
    if (lowerText.includes('job') || lowerText.includes('career') || lowerText.includes('hiring')) {
      const experienceMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi)
      const skillsMatch = text.match(/(?:skills?|technologies?|tech\s*stack|expertise|proficient\s*in)[:\s]*([^.!?]+)/gi)
      const salaryMatch = text.match(/(?:salary|pay|compensation|wage)[:\s]*([^.!?]+)/gi)
      
      summary = `This is a ${content.source.includes('Reddit') ? 'job-seeking post' : 'career-related article'} from a developer`
      if (experienceMatch) summary += ` with ${experienceMatch[0]}`
      if (skillsMatch) summary += ` specializing in ${skillsMatch[0].replace(/^skills?:\s*/i, '').substring(0, 100)}`
      if (salaryMatch) summary += `. Salary expectations: ${salaryMatch[0].substring(0, 50)}`
      summary += '. The post covers job search strategies, required skills, and career advancement opportunities in the tech industry.'
      
    } else if (lowerText.includes('tutorial') || lowerText.includes('guide') || lowerText.includes('how to')) {
      const stepsMatch = text.match(/(\d+)\s*(?:steps?|parts?|sections?|chapters?)/gi)
      const toolsMatch = text.match(/(?:using|with|via|through)\s+([A-Z][a-zA-Z0-9\s]+)/gi)
      const codeMatch = text.match(/(?:code|programming|coding|development|implementation)/gi)
      
      summary = `This is a comprehensive tutorial`
      if (stepsMatch) summary += ` covering ${stepsMatch[0]}`
      if (toolsMatch) summary += ` using ${toolsMatch.slice(0, 2).join(', ')}`
      if (codeMatch) summary += ` with practical code examples and implementation details`
      summary += '. It provides step-by-step instructions, best practices, and real-world applications for developers.'
      
    } else if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) {
      const modelMatch = text.match(/(?:model|algorithm|framework|platform)[:\s]*([A-Z][a-zA-Z0-9\s]+)/gi)
      const metricsMatch = text.match(/(?:accuracy|performance|efficiency|speed)[:\s]*([^.!?]+)/gi)
      
      summary = `This article explores AI/ML technologies and their applications in modern development.`
      if (modelMatch) summary += ` It focuses on ${modelMatch.slice(0, 2).join(', ')}`
      if (metricsMatch) summary += ` with performance metrics including ${metricsMatch[0].substring(0, 50)}`
      if (percentageMatches.length > 0) summary += ` achieving ${percentageMatches.slice(0, 2).join(', ')} improvement`
      summary += '. The content covers implementation strategies, challenges, and future implications for the industry.'
      
    } else if (lowerText.includes('startup') || lowerText.includes('business') || lowerText.includes('entrepreneur')) {
      const fundingMatch = text.match(/(?:funding|investment|revenue|raised)[:\s]*([^.!?]+)/gi)
      const growthMatch = text.match(/(?:growth|increase|scale|expansion)[:\s]*([^.!?]+)/gi)
      
      summary = `This content discusses startup and business strategies in the tech industry.`
      if (fundingMatch) summary += ` It covers funding aspects including ${fundingMatch[0].substring(0, 50)}`
      if (growthMatch) summary += ` and growth metrics such as ${growthMatch[0].substring(0, 50)}`
      if (moneyMatches.length > 0) summary += ` with financial figures of ${moneyMatches.slice(0, 2).join(', ')}`
      summary += '. The article provides insights into market trends, business models, and entrepreneurial challenges.'
      
    } else {
      // General tech content
      summary = `This article covers ${content.category.toLowerCase()} topics with detailed technical information.`
      if (numbersMatches.length > 0) summary += ` It includes key metrics: ${numbersMatches.slice(0, 3).join(', ')}`
      if (timeMatches.length > 0) summary += ` over timeframes of ${timeMatches.slice(0, 2).join(', ')}`
      summary += ` The content provides practical insights, industry trends, and actionable recommendations for ${content.targetAudience || 'tech professionals'}.`
    }
    
    return summary
  }

  generateCommunityGist(comments, text, content) {
    if (comments && comments.length > 0) {
      // Analyze actual comments
      const commentText = comments.map(c => c.body).join(' ').toLowerCase()
      const topComments = comments.filter(c => c.score > 0).slice(0, 10)
      
      let gist = `Based on ${comments.length} comments, the community is actively discussing `
      
      if (commentText.includes('experience') || commentText.includes('similar') || commentText.includes('same')) {
        gist += `shared experiences and similar situations. `
      }
      if (commentText.includes('question') || commentText.includes('how') || commentText.includes('help')) {
        gist += `practical questions and seeking help from others. `
      }
      if (commentText.includes('disagree') || commentText.includes('wrong') || commentText.includes('not sure')) {
        gist += `different perspectives and some disagreement on the topic. `
      }
      if (commentText.includes('thanks') || commentText.includes('helpful') || commentText.includes('great')) {
        gist += `appreciation for the content and finding it helpful. `
      }
      
      // Add specific themes from top comments
      if (topComments.length > 0) {
        const themes = this.extractCommentThemes(topComments)
        if (themes.length > 0) {
          gist += `Main discussion themes include: ${themes.slice(0, 3).join(', ')}.`
        }
      }
      
      return gist
    } else {
      // Predict likely discussion based on content
      const lowerText = text.toLowerCase()
      
      if (lowerText.includes('job') || lowerText.includes('career')) {
        return `People would likely discuss job market conditions, share networking tips, offer referrals, and debate salary expectations. The community typically provides career advice and shares personal job search experiences. Note: Reddit comments are currently unavailable due to API restrictions.`
      } else if (lowerText.includes('ai') || lowerText.includes('artificial intelligence')) {
        return `The community would likely debate AI ethics, discuss practical implementation challenges, share use cases, and express concerns about job displacement. Technical discussions about model performance and limitations are common. Note: Reddit comments are currently unavailable due to API restrictions.`
      } else if (lowerText.includes('startup') || lowerText.includes('business')) {
        return `People would discuss funding strategies, share entrepreneurial experiences, debate market validation approaches, and exchange advice on scaling challenges. The community often shares both success stories and failure lessons. Note: Reddit comments are currently unavailable due to API restrictions.`
      } else if (lowerText.includes('tutorial') || lowerText.includes('guide')) {
        return `The community would ask clarifying questions, share alternative approaches, report issues with implementation, and suggest improvements. Developers often share their own solutions and edge cases encountered. Note: Reddit comments are currently unavailable due to API restrictions.`
      } else {
        return `People would likely discuss practical applications, share similar experiences, ask technical questions, and debate different implementation approaches. The community typically provides additional resources and alternative perspectives. Note: Reddit comments are currently unavailable due to API restrictions.`
      }
    }
  }

  extractCommentThemes(comments) {
    const themes = []
    const combinedText = comments.map(c => c.body).join(' ').toLowerCase()
    
    if (combinedText.includes('price') || combinedText.includes('cost') || combinedText.includes('expensive')) {
      themes.push('pricing concerns')
    }
    if (combinedText.includes('alternative') || combinedText.includes('better') || combinedText.includes('instead')) {
      themes.push('alternative solutions')
    }
    if (combinedText.includes('experience') || combinedText.includes('tried') || combinedText.includes('used')) {
      themes.push('personal experiences')
    }
    if (combinedText.includes('problem') || combinedText.includes('issue') || combinedText.includes('bug')) {
      themes.push('technical issues')
    }
    if (combinedText.includes('recommend') || combinedText.includes('suggest') || combinedText.includes('advice')) {
      themes.push('recommendations')
    }
    
    return themes
  }

  extractEnhancedKeyTopics(text, comments) {
    const lowerText = text.toLowerCase()
    const commentText = comments ? comments.map(c => c.body).join(' ').toLowerCase() : ''
    const combinedText = `${lowerText} ${commentText}`
    
    const keyTopics = []
    
    // Enhanced topic detection with more specific categories
    if (combinedText.includes('react') || combinedText.includes('vue') || combinedText.includes('angular')) {
      keyTopics.push('Frontend Frameworks')
    }
    if (combinedText.includes('node') || combinedText.includes('backend') || combinedText.includes('server')) {
      keyTopics.push('Backend Development')
    }
    if (combinedText.includes('ai') || combinedText.includes('artificial intelligence') || combinedText.includes('machine learning')) {
      keyTopics.push('AI/ML')
    }
    if (combinedText.includes('startup') || combinedText.includes('business') || combinedText.includes('entrepreneur')) {
      keyTopics.push('Startups/Business')
    }
    if (combinedText.includes('job') || combinedText.includes('career') || combinedText.includes('hiring')) {
      keyTopics.push('Jobs/Careers')
    }
    if (combinedText.includes('security') || combinedText.includes('privacy') || combinedText.includes('cybersecurity')) {
      keyTopics.push('Security/Privacy')
    }
    if (combinedText.includes('cloud') || combinedText.includes('aws') || combinedText.includes('azure')) {
      keyTopics.push('Cloud Computing')
    }
    if (combinedText.includes('mobile') || combinedText.includes('ios') || combinedText.includes('android')) {
      keyTopics.push('Mobile Development')
    }
    if (combinedText.includes('data') || combinedText.includes('database') || combinedText.includes('analytics')) {
      keyTopics.push('Data/Analytics')
    }
    if (combinedText.includes('devops') || combinedText.includes('deployment') || combinedText.includes('ci/cd')) {
      keyTopics.push('DevOps')
    }
    
    // If no specific topics found, add general categories
    if (keyTopics.length === 0) {
      keyTopics.push('Technology')
    }
    
    return keyTopics.slice(0, 5) // Limit to 5 topics
  }

  canMakeRequest() {
    const now = Date.now()
    
    // Reset counter if a minute has passed
    if (now - this.rateLimiter.lastReset > 60000) {
      this.rateLimiter.requests = 0
      this.rateLimiter.lastReset = now
    }

    return this.rateLimiter.requests < this.rateLimiter.maxRequestsPerMinute
  }

  getStatus() {
    return {
      isAvailable: this.isAvailable,
      rateLimit: {
        current: this.rateLimiter.requests,
        max: this.rateLimiter.maxRequestsPerMinute,
        resetTime: new Date(this.rateLimiter.lastReset + 60000)
      }
    }
  }

  async batchAnalyze(contents, batchSize = 5) {
    if (!this.isAvailable) {
      console.warn('⚠️ AI analysis not available for batch processing')
      return contents.map(content => ({
        contentId: content._id,
        success: false,
        error: 'AI analysis not available',
        analysis: this.fallbackAnalysis(content)
      }))
    }

    const results = []
    
    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize)
      
      console.log(`🤖 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contents.length / batchSize)}`)
      
      const batchPromises = batch.map(async (content) => {
        try {
          const result = await this.analyzeContent(content)
          return {
            contentId: content._id,
            success: result.success,
            analysis: result.analysis,
            error: result.error || null
          }
        } catch (error) {
          return {
            contentId: content._id,
            success: false,
            error: error.message,
            analysis: this.fallbackAnalysis(content)
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to be respectful
      if (i + batchSize < contents.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    return results
  }
}

export default AIAnalyzer 