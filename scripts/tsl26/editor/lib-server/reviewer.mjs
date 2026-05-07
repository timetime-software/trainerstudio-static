import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  CATEGORY_VALUES,
  DETAILED_MUSCLE_GROUP_VALUES,
  EQUIPMENT_VALUES,
  FORCE_TYPE_VALUES,
  LATERALITY_VALUES,
  LEVEL_VALUES,
  MECHANIC_VALUES,
  MOVEMENT_PATTERN_VALUES,
} from '../../classification-reference.mjs';

export const REVIEW_PATCH_SCHEMA = {
  type: 'object',
  description: 'Only include fields that should change. Omit unchanged fields. Use dotted paths for nested fields.',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: 'English exercise name.' },
    instructions: { type: 'array', items: { type: 'string' }, description: 'English instruction steps.' },
    category: { type: 'string', enum: CATEGORY_VALUES },
    level: { type: 'string', enum: LEVEL_VALUES },
    force: { type: 'string', enum: FORCE_TYPE_VALUES },
    mechanic: { type: 'string', enum: MECHANIC_VALUES },
    equipment: { type: 'string', enum: EQUIPMENT_VALUES },
    primaryMuscles: { type: 'array', items: { type: 'string', enum: DETAILED_MUSCLE_GROUP_VALUES } },
    secondaryMuscles: { type: 'array', items: { type: 'string', enum: DETAILED_MUSCLE_GROUP_VALUES } },
    'i18n.name.es': { type: 'string', description: 'Spanish exercise name.' },
    'i18n.instructions.es': { type: 'array', items: { type: 'string' }, description: 'Spanish instruction steps.' },
    'classification.movementPattern': { type: 'array', items: { type: 'string', enum: MOVEMENT_PATTERN_VALUES } },
    'classification.laterality': { type: 'array', items: { type: 'string', enum: LATERALITY_VALUES } },
    'classification.equipment': { type: 'array', items: { type: 'string', enum: EQUIPMENT_VALUES } },
  },
};

export const REVIEW_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['patch', 'rationale'],
  properties: {
    patch: REVIEW_PATCH_SCHEMA,
    rationale: {
      type: 'object',
      description: 'For each field key in patch (same keys), a one-sentence explanation in Spanish of why it changed.',
      additionalProperties: { type: 'string' },
    },
  },
};

export function buildProposePrompt(exercise, instructions) {
  const userInstructions = String(instructions || '').trim();
  return [
    'You are reviewing one exercise JSON record in the TrainerStudio static exercise database.',
    '',
    'Return your answer by calling the `propose_changes` tool. Do not output any other text.',
    '',
    'Rules:',
    '- Only include fields in `patch` that you actually want to change. Leave the rest out.',
    '- Use dotted keys exactly as they appear in the schema (e.g. "i18n.name.es", "classification.equipment").',
    '- Keep id, cdnslug, media, images, aliases, source clip metadata and CDN references untouched (do not include them).',
    '- Make English name/instructions and Spanish i18n.name/instructions natural, clear, exercise-specific.',
    '- Remove Spanglish or literal machine-translation artifacts from Spanish text.',
    '- Top-level category, level, force, mechanic, equipment, primaryMuscles, secondaryMuscles must be coherent with the exercise.',
    '- A muscle must NOT appear in both primaryMuscles and secondaryMuscles.',
    '- For each changed field, include a one-sentence explanation in Spanish in `rationale` keyed by the same field path.',
    userInstructions ? `\nUser instructions for this review:\n${userInstructions}` : '',
    '',
    'Exercise to review:',
    JSON.stringify(exercise, null, 2),
  ].filter(Boolean).join('\n');
}

export async function proposeWithAnthropic({ apiKey, model, prompt }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model || 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'propose_changes',
        description: 'Return the proposed patch and rationale for the exercise.',
        input_schema: REVIEW_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'propose_changes' },
    messages: [{ role: 'user', content: prompt }],
  });
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Anthropic did not return a tool_use block');
  }
  return toolUse.input;
}

export async function proposeWithOpenAI({ apiKey, model, prompt }) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: model || 'gpt-5-mini',
    messages: [{ role: 'user', content: prompt }],
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'propose_changes',
        strict: false,
        schema: REVIEW_TOOL_SCHEMA,
      },
    },
  });
  const text = response.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response');
  return JSON.parse(text);
}

export async function proposeExerciseChanges({ exercise, instructions, provider, apiKeys, models }) {
  const prompt = buildProposePrompt(exercise, instructions);
  const targetProvider = provider === 'codex' || provider === 'openai' ? 'openai' : 'anthropic';
  if (targetProvider === 'anthropic') {
    const apiKey = apiKeys?.anthropic;
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY (set it in Settings or .env).');
    return proposeWithAnthropic({ apiKey, model: models?.anthropic, prompt });
  }
  const apiKey = apiKeys?.openai;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY (set it in Settings or .env).');
  return proposeWithOpenAI({ apiKey, model: models?.openai, prompt });
}
