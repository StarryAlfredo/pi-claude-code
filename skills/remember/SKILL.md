# Remember Skill

Save important facts to memory files for future sessions.

## Usage

```
/remember <fact>
```

## Examples

```
/remember This project uses pnpm, not npm
/remember The auth module is in src/auth/
/remember Never modify the .env.production file
```

## How it works

1. Appends the fact to the project's `PI.md` memory file
2. Facts are automatically loaded in future sessions via the memory system
