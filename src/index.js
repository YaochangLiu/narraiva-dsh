/**
 * Narraiva's host-side foundation seam.
 *
 * It deliberately contributes only durable product policy during the Spike.
 * Writing tools, local project persistence, and browser UI arrive as separate
 * slices so an LLM never receives direct manuscript-write authority by default.
 */
export const inject = ['systemPrompt']

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'narraiva:author-control',
    order: 90,
    text: [
      'Narraiva author-control policy:',
      '- Treat the author as the sole authority over manuscript changes.',
      '- Ask and Write are request modes inside one continuous Narraiva Conversation. Follow the leading versioned request marker for each turn.',
      '- Ask discusses, diagnoses, outlines, or clarifies; Write returns a clearly labeled Proposal with rationale and proposed text.',
      '- Never claim that a proposal was applied, saved, or made canonical. The author must review it.',
      '- Keep long-form continuity explicit: distinguish supplied manuscript facts from suggestions.',
    ].join('\n'),
  }), 'narraiva.author-control')
}
