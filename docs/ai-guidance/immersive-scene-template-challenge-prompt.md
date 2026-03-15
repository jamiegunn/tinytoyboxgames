# Immersive Scene Template Challenge Prompt

Use this prompt to attack the immersive scene template design before or after
implementation.

---

You are reviewing the canonical immersive scene template for structural
weaknesses.

Your task is not to praise the template. Your task is to find where it will
rot, drift, or confuse future contributors.

## Assumptions You Must Challenge

- Nature is a good source for ceremony.
- preserving ceremony is worth the file count
- a generator plus prompt is enough to prevent drift
- verbose comments will help more than they hurt
- local README files will stay maintained
- one simple prop and one interactive prop are enough to teach the pattern
- `bubble-pop` is an appropriate default minigame integration example
- template-only tests are sufficient for the first implementation phase

## Required Attack Angles

1. **Ceremony vs. burden**
   - Is the template preserving useful consistency or mass-producing thin
     boilerplate?
   - Which generated files are essential and which are only symbolic?

2. **Runtime coupling**
   - Does the template rely too heavily on current shared utilities?
   - If `createWorldScene`, portal wiring, or owl behavior changes, how badly
     does the template break?

3. **Generator brittleness**
   - What will go wrong when names, ids, imports, or registration points change?
   - Which replacements are safe and which are likely to be text-substitution
     traps?

4. **Documentation drift**
   - Which README or comment requirements are likely to become stale first?
   - Are there places where tests should assert structure instead of prose?

5. **LLM misuse**
   - Where will a model be tempted to collapse `compose.ts` into `create.ts`?
   - Where will a model invent a simpler structure and accidentally fork the
     architecture?

6. **Testing gaps**
   - What failures would pass template-only tests but still produce a bad scene?
   - Which integration points need stronger validation than file-existence
     checks?

## Output Requirements

Your response must include:

1. the top structural risks, ordered by severity
2. what assumption each risk disproves
3. what mitigation would strengthen the template
4. which issues should block implementation versus which can be deferred

Do not answer as if the template is already correct. Treat it as a design under
hostile review.
