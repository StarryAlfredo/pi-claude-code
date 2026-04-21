# Debug Skill

Interactive debugging assistance with breakpoints and inspection.

## Usage

```
/debug <description of the issue>
```

## Examples

```
/debug Login fails with 403 on production
/debug The worker process exits with code 137
```

## How it works

1. Reads error messages and stack traces
2. Identifies relevant source files
3. Suggests debugging strategies
4. Can add console.log / breakpoint statements
