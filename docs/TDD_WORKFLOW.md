# Test-Driven Development (TDD) Workflow

This guide outlines the TDD workflow for the YouTube Video to Text Converter project.

## Quick Start

```bash
# Start TDD watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Open Vitest UI for interactive testing
pnpm test:ui
```

## TDD Cycle: Red → Green → Refactor

### 1. Red Phase (Write Failing Test)
Write a test that describes the desired behavior before implementing the feature.

```typescript
// Example: src/__tests__/services/text-processor.test.ts
describe('TextProcessor', () => {
  it('should clean and normalize extracted text', () => {
    const processor = new TextProcessor();
    const input = '  Hello\n\nWorld  \t';
    const result = processor.normalize(input);
    expect(result).toBe('Hello World');
  });
});
```

### 2. Green Phase (Make Test Pass)
Write the minimal code necessary to make the test pass.

```typescript
// src/services/text-processor.ts
export class TextProcessor {
  normalize(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
}
```

### 3. Refactor Phase (Improve Code)
Refactor the code while keeping tests green. Improve structure, remove duplication, enhance readability.

## Test Organization

```
src/
├── __tests__/
│   ├── unit/           # Pure unit tests
│   ├── integration/    # Component integration tests
│   └── fixtures/       # Test data and mocks
├── services/
│   └── *.ts           # Implementation files
└── utils/
    └── *.ts           # Utility functions
```

## Writing Effective Tests

### Test Structure (AAA Pattern)
```typescript
describe('Component/Feature', () => {
  // Arrange - Setup
  beforeEach(() => {
    // Setup test environment
  });

  it('should perform expected behavior', () => {
    // Arrange - Prepare test data
    const input = createTestData();
    
    // Act - Execute the function
    const result = functionUnderTest(input);
    
    // Assert - Verify the outcome
    expect(result).toMatchExpectedOutput();
  });

  afterEach(() => {
    // Cleanup
  });
});
```

### Testing Async Code
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Or with promises
it('should handle promises', () => {
  return promiseFunction().then(result => {
    expect(result).toBeDefined();
  });
});
```

### Testing Errors
```typescript
it('should throw error for invalid input', () => {
  expect(() => functionThatThrows()).toThrow(ValidationError);
  expect(() => functionThatThrows()).toThrow('Expected error message');
});
```

## Mocking Dependencies

### Mock External Services
```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('../services/youtube-downloader', () => ({
  YouTubeDownloader: vi.fn().mockImplementation(() => ({
    download: vi.fn().mockResolvedValue('/path/to/video')
  }))
}));

// Mock file system
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('file content'),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));
```

### Spy on Functions
```typescript
it('should call logger on error', () => {
  const loggerSpy = vi.spyOn(logger, 'error');
  
  functionThatLogs();
  
  expect(loggerSpy).toHaveBeenCalledWith('Expected error message');
});
```

## Coverage Guidelines

### Target Coverage Metrics
- **Statements**: 80% minimum
- **Branches**: 75% minimum
- **Functions**: 90% minimum
- **Lines**: 80% minimum

### Viewing Coverage
```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html
```

### Excluding Files from Coverage
Update `vitest.config.ts`:
```typescript
coverage: {
  exclude: [
    'node_modules/**',
    'dist/**',
    '**/*.config.ts',
    '**/*.d.ts',
    'src/cli.ts',
    '**/__tests__/**'
  ]
}
```

## Best Practices

### 1. Test Naming
- Use descriptive test names that explain the behavior
- Follow the pattern: "should [expected behavior] when [condition]"
- Group related tests using `describe` blocks

### 2. Test Independence
- Each test should be independent and not rely on other tests
- Use `beforeEach` and `afterEach` for setup and cleanup
- Avoid shared state between tests

### 3. Test Data
- Use test fixtures for complex data structures
- Create factory functions for generating test data
- Keep test data minimal but representative

### 4. Performance
- Mock heavy operations (file I/O, network calls)
- Use `test.concurrent` for parallel test execution
- Keep unit tests fast (< 100ms per test)

## Common Testing Patterns

### Testing Services
```typescript
describe('FrameExtractor', () => {
  let frameExtractor: FrameExtractor;
  let mockFs: any;

  beforeEach(() => {
    mockFs = {
      readdir: vi.fn().mockResolvedValue(['frame-1.png', 'frame-2.png']),
      mkdir: vi.fn().mockResolvedValue(undefined)
    };
    frameExtractor = new FrameExtractor('/tmp');
  });

  it('should extract frames at specified intervals', async () => {
    const frames = await frameExtractor.extractFrames('/video.mp4', 2);
    expect(frames).toHaveLength(2);
    expect(frames[0].timestamp).toBe(0);
    expect(frames[1].timestamp).toBe(2);
  });
});
```

### Testing Utilities
```typescript
describe('validators', () => {
  describe('validateYouTubeUrl', () => {
    it.each([
      ['https://www.youtube.com/watch?v=abc123', true],
      ['https://youtu.be/abc123', true],
      ['https://example.com', false],
      ['not-a-url', false]
    ])('should validate %s as %s', (url, expected) => {
      const result = isValidYouTubeUrl(url);
      expect(result).toBe(expected);
    });
  });
});
```

## Continuous Integration

Tests run automatically on:
- Pre-commit hooks (via husky)
- Pull requests (GitHub Actions)
- Main branch pushes

### Running Tests in CI Mode
```bash
# Run tests once with coverage
pnpm test:coverage

# Generate JUnit report for CI
pnpm test -- --reporter=junit
```

## Debugging Tests

### VS Code Debugging
1. Set breakpoints in test files
2. Use "Debug Test" from VS Code test explorer
3. Or press F5 with a test file open

### Vitest UI
```bash
# Open interactive test UI
pnpm test:ui
```

Features:
- Watch test execution in real-time
- Filter and run specific tests
- View code coverage inline
- Debug failed tests

## TDD Workflow Example

Here's a complete TDD example for adding a new feature:

1. **Write failing test**:
```typescript
// src/__tests__/services/subtitle-extractor.test.ts
describe('SubtitleExtractor', () => {
  it('should extract subtitles from video', async () => {
    const extractor = new SubtitleExtractor();
    const subtitles = await extractor.extract('/video.mp4');
    expect(subtitles).toContain('Expected subtitle text');
  });
});
```

2. **Run test** (it should fail):
```bash
pnpm test:watch
```

3. **Implement minimal code**:
```typescript
// src/services/subtitle-extractor.ts
export class SubtitleExtractor {
  async extract(videoPath: string): Promise<string> {
    // Minimal implementation
    return 'Expected subtitle text';
  }
}
```

4. **Verify test passes**

5. **Add more tests** for edge cases:
```typescript
it('should handle videos without subtitles', async () => {
  const extractor = new SubtitleExtractor();
  const subtitles = await extractor.extract('/no-subs.mp4');
  expect(subtitles).toBe('');
});

it('should throw error for invalid video path', async () => {
  const extractor = new SubtitleExtractor();
  await expect(extractor.extract('')).rejects.toThrow(ValidationError);
});
```

6. **Refactor** to handle all cases properly

7. **Repeat** the cycle

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [TDD by Example](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530) - Kent Beck

---

Remember: **Write tests first, implement second, refactor third!**