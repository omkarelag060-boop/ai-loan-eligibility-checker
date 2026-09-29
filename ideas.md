# AI Loan Eligibility Checker — Design Brief

## Theme: Midnight Fintech Glass

A calm, trust-first fintech workspace for Indian borrowers: dark enough to feel focused, luminous enough to make every important number legible. The experience is a guided eligibility conversation rather than a dry form.

### Design movement

Editorial fintech dashboard meets premium glassmorphism. The visual language uses layered translucent surfaces, quiet depth, and high-contrast numeric readouts instead of loud banking clichés.

### Core principles

1. **Make money feel understandable** — explain every score and metric in plain English.
2. **Make confidence visible** — use progressive disclosure, clear states, and trustworthy microcopy.
3. **Keep the surface calm** — one cyan action color, one violet secondary color, controlled motion.
4. **Respect sensitive data** — keep consent, privacy, and estimates visible without interrupting flow.

### Color philosophy

The base is a midnight navy gradient (`#0A0E1A` to `#111827`). Cyan (`#22D3EE`) is the trust/action signal, violet (`#8B5CF6`) is used for analytical secondary accents, emerald (`#10B981`) marks healthy outcomes, amber (`#F59E0B`) signals attention, and red (`#EF4444`) signals action needed. Borders remain translucent so the cards feel layered rather than boxed in.

### Layout paradigm

A long-form single-page story: sticky navigation, hero with a floating eligibility preview, feature navigation cards, then progressively deeper modules. Wide screens use asymmetric two-column workspaces; mobile collapses to a clear vertical task flow with persistent anchors.

### Signature elements

- A compact loan-document brand mark with a cyan check and violet fold.
- Glass cards with a subtle top-edge highlight.
- JetBrains Mono for rupee amounts, percentages, and scores.
- Circular score gauges and semicircular credit meters that make progress feel tangible.
- A “Latest snapshot” preview card that makes the product feel alive before the user enters data.

### Interaction philosophy

Every control responds immediately and respectfully. Inline validation sits beside the field that needs attention. Calculators update as the user moves. Chat responses feel typed but never hide the loading state. Success is communicated through a live toast and a visible record in Recent Checks.

### Animation

Slow ambient orbs, 450ms reveal transitions, gentle gauge fills, number counters, and progress bars. `prefers-reduced-motion` disables movement and uses instant state changes without removing information.

### Typography system

Inter is the default reading face; Poppins appears in display moments; JetBrains Mono is reserved for numeric outputs. Headings are compact and sentence-case. Body text is short, reassuring, and specific.

### Brand essence and voice

**Essence:** clarity before commitment. **Voice:** practical, warm, precise, and never over-promising. Use “estimated”, “based on the details you entered”, and “not financial advice” consistently.

### Wordmark/logo

The wordmark is **LoanCheck / AI Loan Eligibility Checker**. The icon is a flat, full-bleed square with a midnight background, an outlined document silhouette, and a checkmark cut through the lower-right corner. It avoids shadows, gradients, and tiny detail so it remains readable at favicon size.

### Signature brand color

Cyan `#22D3EE`, paired with midnight navy for the product identity.
