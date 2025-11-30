# Project and Code Guidelines

* I value code that is intentional, inspectable, and rollback-safe.
* Keep it DRY.

## My coding philosophy is as follows:

* First it has to work, then it has to make sense, then we can look for ways to make it better.

### To explain what I mean by this

#### 1. First it has to work:
- This should be self-evident.
- Attempting to understand or improve something that doesn’t work in the first place is an exercise in futility.
- Before documenting or adding features to software, make sure it functions as intended in its current state.

#### 2. Then it has to make sense.
- This is the part where the code gets refactored for clarity, so it can be maintained and built on going forward.
- Comments and documentation are also part of this process.
- Both machines and humans interact with code, and it should be clearly readable by both.

#### 3. Then we can look for ways to make it better.
- This can mean:
  - making it faster
  - adding new features
  - refactoring for more modular functions, or
  - any number of other things depending on the needs of the project.
- This is what everyone wants to jump right into.
- But if the code 
  - has bugs at the basic level, or
  - its architecture is murky,

  introducing further complexity will only compound existing problems and create technical debt going forward.
Always have a solid foundation and a floor plan before making additions.

## General Principles

-   **Consistency**: Always match the style of the surrounding codebase.
-   **Readability**: Prioritize clean, readable code with descriptive variable and function names.
-   **Security**: Always follow good security practices.

## Parentheses Spacing

- Always include a single space **inside** parentheses.
- Do **not** add spaces **outside** parentheses.

✅ Correct:
- `functionName( params )`
- `if( condition )`

❌ Incorrect:
- `functionName(params)`
- `if ( condition )`

## Organization

- Functions should be placed in the order they are called, when possible
- Functions that work together should be placed together

## Commenting

- Nearly every function should at least have a commented description
- If the purpose of a function or its parameters are not immediately clear, the function should have a doc block
- Comments that explain a single line should go after the code and begin with a lowercase letter
- Comments that explain multiple lines of code should go above the code and begin with an uppercase letter
- Comments that explain multiple lines should generally have an empty line above them