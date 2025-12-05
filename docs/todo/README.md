# Feature Planning

This folder contains plans for features to be implemented to reach Figma feature parity.

## Priority Legend

- 🔴 **Critical** - Core functionality, blocking other work or major UX issues
- 🟠 **High** - Important features users expect
- 🟡 **Medium** - Nice to have, polish features
- 🔵 **Low** - Future enhancements

## Status

Move completed plans to `../done/` folder.

## Current Backlog

### Phase 1: Core Foundation (Critical)
| # | Feature | Priority | Difficulty | Est. Time |
|---|---------|----------|------------|-----------|
| ~~01~~ | ~~[Alt-drag duplicate bug](../done/01-alt-drag-duplicate-bug.md)~~ | ✅ | Easy | 30 min |
| ~~02~~ | ~~[Layers panel: all objects](../done/02-layers-panel-all-objects.md)~~ | ✅ | Easy | 45 min |
| ~~03~~ | ~~[Context menu](../done/03-context-menu.md)~~ | ✅ | Medium | 2 hrs |
| 04 | [Image crop mode](./04-image-crop-mode.md) | 🔴 | Medium | 2 hrs |

### Phase 2: Fill System (High)
| # | Feature | Priority | Difficulty | Est. Time |
|---|---------|----------|------------|-----------|
| 05 | [Stackable fills](./05-fill-system-stackable.md) | 🟠 | Hard | 4-6 hrs |

### Phase 3: Object Properties (High)
| # | Feature | Priority | Difficulty | Est. Time |
|---|---------|----------|------------|-----------|
| 06 | [Text properties](./06-text-properties.md) | 🟠 | Medium | 2-3 hrs |
| 07 | [Rotation](./07-rotation.md) | 🟠 | Hard | 4-6 hrs |

### Phase 4: Layers & Layout (Medium)
| # | Feature | Priority | Difficulty | Est. Time |
|---|---------|----------|------------|-----------|
| 08 | [Layers panel: advanced](./08-layers-panel-advanced.md) | 🟡 | Medium | 3-4 hrs |
| 09 | [Distribute spacing](./09-distribute-spacing.md) | 🟡 | Easy | 1 hr |
| 10 | [Auto-layout padding](./10-autolayout-padding.md) | 🟡 | Easy | 1 hr |

## Future Backlog (Not Yet Planned)

### Objects & Manipulation
- [ ] Flip horizontal/vertical
- [ ] Constraints (pinning)
- [ ] Min/max dimensions
- [ ] Boolean operations (union, subtract, etc.)

### Effects
- [ ] Multiple shadows
- [ ] Background blur
- [ ] Layer blur

### Stroke System
- [ ] Unified stroke (replace border/outline)
- [ ] Stroke position (inside/center/outside)
- [ ] Stroke cap/join
- [ ] Dashed stroke config

### Canvas
- [ ] Rulers
- [ ] Layout grids
- [ ] Zoom to fit/selection

### Components
- [ ] Create component
- [ ] Component instances
- [ ] Overrides

### Export
- [ ] Export as PNG/SVG/PDF
- [ ] Export settings per object

### Shaders (Project Goal)
- [ ] Shader object type
- [ ] TSL/GLSL input
- [ ] Shader library
- [ ] Input parameters

## How to Use

1. Pick a task from the backlog
2. Read the plan document
3. Implement following the plan
4. Test using the checklist in the plan
5. Move the plan to `../done/` when complete

## Estimating

Estimates assume familiarity with the codebase. Add buffer for:
- First-time contributors: +50%
- Complex interactions with existing code: +25%
- Thorough testing: +25%

