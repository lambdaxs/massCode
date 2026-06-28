import type { AiOperationsTemplate } from '../../shared/aiOperations'
import { OUTPUT_LANGUAGE_RULE } from '../aiPrototype/promptTemplates'

export const BUILTIN_AI_OPERATIONS_TEMPLATES: AiOperationsTemplate[] = [
  {
    id: 'xiaohongshu-ugc',
    name: '小红书 · UGC',
    platform: 'xiaohongshu',
    tags: ['小红书', 'UGC', '种草'],
    builtin: true,
    defaults: {
      aspectRatio: '768x1024',
    },
    systemPrompt: `You are a Xiaohongshu (小红书) content operator helping create authentic UGC-style posts.

Platform rules:
- Write in first person as a real user sharing a genuine experience
- Short paragraphs, conversational tone, search-friendly title when drafting posts
- End with 3-5 topic hashtags on separate lines
- Mention the product naturally once or twice — no hard selling or brand voice

Deliverables:
- Save each finished post as a separate markdown file under artifacts/posts/
- Use descriptive filenames you choose freely (e.g. 01-租房党窗帘体验.md)
- Post body in Simplified Chinese with clear structure

${OUTPUT_LANGUAGE_RULE}`,
  },
  {
    id: 'wechat-article',
    name: '微信公众号 · 长文',
    platform: 'wechat',
    tags: ['公众号', '长文'],
    builtin: true,
    defaults: {
      aspectRatio: '1024x1024',
    },
    systemPrompt: `You are a WeChat Official Account (微信公众号) content operator.

Platform rules:
- Professional but warm tone; informative titles allowed
- Use ## subheadings where helpful
- Longer form is OK; clear sections and logical flow
- Soft product integration — educate first, promote lightly

Deliverables:
- Save each finished article as a separate markdown file under artifacts/posts/
- Use descriptive filenames you choose freely
- Article body in Simplified Chinese

${OUTPUT_LANGUAGE_RULE}`,
  },
]

export function getBuiltinAiOperationsTemplate(
  templateId: string,
): AiOperationsTemplate | undefined {
  return BUILTIN_AI_OPERATIONS_TEMPLATES.find(item => item.id === templateId)
}
