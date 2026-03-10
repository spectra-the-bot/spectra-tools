# Agent Self-Check Workflow

Recommended rendering loop for AI agents using the graphic-designer CLI in a self-correcting iteration cycle.

## Self-Check Workflow

```
1. Generate DesignSpec from user requirements
2. `design render --spec spec.json --iteration 1 --max-iterations 3`
3. If reference image provided:
   a. `design compare --target reference.png --rendered output.png`
   b. If verdict = "match" or "close" (similarity ≥ 0.80): proceed to QA
   c. If verdict = "mismatch":
      - Parse per-region differences
      - Adjust spec to address top 3 highest-delta regions
      - Re-render with --iteration N+1
      - Repeat until match/close OR iteration limit reached
4. `design qa --in output.png --spec spec.json [--reference reference.png]`
5. If QA passes: present to user
6. If QA fails: fix issues and re-render (counts toward iteration limit)
7. After max iterations without convergence, escalate:
   "I've tried [N] iterations and can't converge. Best similarity: [score].
    Remaining issues: [list from compare regions + QA issues]"
```

## Decision Matrix

| Similarity | QA Pass | Action                                            |
| ---------- | ------- | ------------------------------------------------- |
| ≥ 0.95     | Yes     | Present to user ✅                                |
| ≥ 0.80     | Yes     | Present with note: "Close but not pixel-perfect"  |
| ≥ 0.80     | No      | Fix QA issues, re-render                          |
| < 0.80     | Any     | Analyze regions, adjust spec, re-render           |
| Any        | Any     | At max iterations: escalate to user with details  |

## Common Spatial Corrections

- **Region too high/low** → adjust Y position
- **Region shifted left/right** → adjust X position
- **Elements overlapping** → increase spacing or adjust layout
- **Curves/connections wrong** → adjust tension, routing, or anchor hints
