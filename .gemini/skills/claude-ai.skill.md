---
name: claude-ai-integration
description:
  Best practices for integrating and interacting with Claude AI models.
  Focuses on prompt engineering, context management, and API usage.
license: MIT
metadata:
  author: vercel
  version: '1.0.0'
---

# Claude AI Integration

Guidelines for effectively utilizing and interacting with Claude AI in your applications.

## 1. Prompt Engineering (HIGH)

- **Be Specific**: Provide precise instructions, constraints, and context in every prompt.
- **Use XML-Style Tags**: Structure information using tags (e.g., `<context>`, `<rules>`, `<output_format>`) to help the model parse data accurately.
- **Few-Shot Examples**: Provide concrete examples of input/output pairs to define the desired tone and format.
- **System Prompts**: Always define a persona and clear guardrails in the system prompt.

---

## 2. Context Management

- **Token Efficiency**: Only include data that is strictly relevant to the current task.
- **Summarization**: Summarize lengthy histories or large documents to stay within the model's context window.
- **Structure**: Group related information together. Put instructions at the end for better performance.

---

## 3. Implementation Patterns

- **Streaming**: Use streaming responses (`ai` package) for a better user experience in interactive UIs.
- **Error Handling**: Implement robust retries and fallbacks for API timeouts, rate limits, and model-specific errors.
- **Security**: Never expose API keys or secrets in client-side code. Use Server Actions or route handlers for AI processing.
- **Tools (MCP)**: Leverage Model Context Protocol (MCP) to give the model access to real-time data or internal systems.
