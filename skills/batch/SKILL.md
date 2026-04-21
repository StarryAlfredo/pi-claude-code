# Batch Skill

Orchestrate large, parallelizable changes across the codebase.

## Usage

```
/batch <instruction>
```

## Examples

```
/batch migrate from react to vue
/batch add type annotations to all untyped function parameters
/batch replace all uses of lodash with native equivalents
```

## How it works

1. Enters Plan Mode to research and decompose the work
2. Breaks the instruction into 5–30 independent units
3. Spawns one background Agent per unit (each in an isolated git worktree)
4. Each Agent implements, tests, and creates a PR
5. Tracks progress and reports final results

## Requirements

- Git repository (worktrees are used for isolation)
