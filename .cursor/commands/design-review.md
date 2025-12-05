---
description: System design review — find the three things that matter most
---

Review this code from a system design perspective:

{{selection}}

## Your Task

Don't give me a checklist. Give me insight.

**Apply the 80/20 principle:** Focus on the 20% of changes that would deliver 80% of the improvement. I want high-leverage findings, not comprehensive coverage.

1. **Understand the context first.** Look at how this code fits into the broader codebase:
   - What does it depend on? What depends on it?
   - What problem is it solving?
   - **What similar patterns or systems exist elsewhere in the codebase?** Look for code solving similar problems—are there inconsistencies, duplication, or opportunities to unify?

2. **Look for reuse opportunities.** Scan the codebase for:
   - UI components that share similar structure or behavior and could be abstracted
   - Logic that's duplicated across files and could be consolidated
   - Patterns that should be standardized vs. one-offs that are appropriately specialized

3. **Find the top 3 leverage points.** What are the three design decisions here that have the biggest impact—positive or negative—on the system? These might be:

   - An abstraction that's at the wrong level
   - A coupling that will cause pain later
   - A missing boundary that blurs responsibilities
   - A component or utility that should exist but doesn't
   - Duplicated logic that's diverging or could diverge
   - A pattern that should (or shouldn't) be replicated elsewhere

4. **For each, explain the tradeoff.** Every design choice trades something. What is this code optimizing for? What is it sacrificing? Is that the right tradeoff for this system?

5. **For each, give a specific recommendation.** Be concrete—show me the shape of the change, not just "consider refactoring." If suggesting an abstraction, sketch what it looks like.

## Output Format

For each of the 3 leverage points:

### [1/2/3]. [Short name for the issue or strength]

**What:** Describe the design decision and its impact.

**Tradeoff:** What's being gained vs. sacrificed.

**Recommendation:** Specific action to take (or why to keep it as-is). Include code sketch if proposing a new abstraction.

**Effort/Impact:** [Low/Medium/High] effort for [Low/Medium/High] impact.

## What I Don't Want

- More than 3 items (force yourself to prioritize)
- Low-leverage suggestions (high effort, low impact)
- Style nitpicks
- Suggestions that add complexity without clear payoff
- Generic advice that could apply to any code
- Abstractions for the sake of abstraction—only if there's real duplication or clear future reuse

Be honest. If the design is sound, say so and explain what makes it work.

