# CODEVISION X — Compiler Design Laboratory

A bright, responsive, browser-based educational compiler project. It uses its own JavaScript lexer, recursive-descent parser, semantic checker, intermediate-code generator, optimizer, virtual-instruction generator, and bounded interpreter. No server or external compiler is required.

## Run it
1. Extract `CODEVISION_X.zip`.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox).
3. Pick a starter template or write CV-Lang source.
4. Click **Compile program**. Select phase cards to inspect artifacts.

You can also serve the folder with any static server, e.g. `python -m http.server 8000`, then visit `http://localhost:8000`.

## Implemented
- Lexer: identifiers, keywords, numbers, strings, operators, punctuation, line/column positions, line/block comments.
- Recursive-descent parser and AST for declarations, assignments, print, blocks, if/else, while, unary/binary expressions.
- Semantic checks: undeclared identifiers, duplicate declarations, basic type consistency, boolean conditions.
- Symbol table, three-address code, constant folding and basic algebraic simplification.
- Educational stack-machine instruction generation.
- Bounded interpreter with output console and infinite-loop step guard.
- Line-specific diagnostics, example programs, phase inspector, pipeline explainer, learning studio, responsive UI.

## CV-Lang subset
```text
let price = 10;
let total = price * 3 + 2;
print(total);
if (total > 20) { print("high"); } else { print("low"); }
while (price > 0) { price = price - 1; }
```
Comments: `// line` and `/* block */`. Types are inferred from literal expressions.

## Scope and limitations
This is a learning compiler for a deliberately small language, not a production C/C++/Java compiler. It does not implement functions, arrays, pointers, classes, imports, native executable output, lexical scoping in nested blocks, register allocation, SSA, dead-code elimination, or full data-flow analysis. The generated VM instructions are illustrative; execution is performed by the separate safe interpreter, not by executing generated machine code. Semantic analysis reports errors and prevents execution when errors are detected.
