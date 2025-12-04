---
description: System design review — find the one thing that matters most
---

Review this code from a system design perspective:

{{selection}}

## Your Task

Don't give me a checklist. Give me insight.

1. **Understand the context first.** Look at how this code fits into the broader codebase. What does it depend on? What depends on it? What problem is it solving?

2. **Find the leverage point.** What's the ONE design decision here that has the biggest impact—positive or negative—on the system? This might be:

   - An abstraction that's at the wrong level
   - A coupling that will cause pain later
   - A missing boundary that blurs responsibilities
   - A pattern that should (or shouldn't) be replicated elsewhere

3. **Explain the tradeoff.** Every design choice trades something. What is this code optimizing for? What is it sacrificing? Is that the right tradeoff for this system?

4. **Give me ONE recommendation.** If I could only change one thing, what should it be and why? Be specific—show me the shape of the change, not just "consider refactoring."

## What I Don't Want

- A list of 10 small issues
- Style nitpicks
- Suggestions that add complexity without clear payoff
- Generic advice that could apply to any code

Be honest. If the design is sound, say so and explain what makes it work.
