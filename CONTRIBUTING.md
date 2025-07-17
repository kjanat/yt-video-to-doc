# Contributing to YouTube Video to Text Converter

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x, 22.x, or 24.x
- pnpm 10.x or higher
- Git
- Tesseract OCR installed on your system

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/yt-video-to-txt.git
   cd yt-video-to-txt
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Workflow

### Available Scripts

```bash
pnpm dev          # Run the CLI in development mode
pnpm build        # Build the TypeScript code
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:ui      # Open Vitest UI
pnpm lint         # Check code style
pnpm lint:fix     # Fix code style issues
pnpm format       # Format code
pnpm typecheck    # Type check without building
```

### Code Style

We use Biome for code formatting and linting. The configuration ensures:
- Consistent code style
- No unused imports
- Proper TypeScript usage
- Clean and maintainable code

Pre-commit hooks will automatically:
- Format your code
- Run linting checks
- Validate commit messages

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or corrections
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

Examples:
```bash
feat(ocr): add support for multiple languages
fix(youtube): handle age-restricted videos
docs: update installation instructions
```

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for good test coverage
- Test files should be in `__tests__` directories

```bash
pnpm test              # Run all tests
pnpm test:coverage     # Generate coverage report
pnpm test specific.test.ts  # Run specific test file
```

### Debugging

VS Code debug configurations are provided:
- **Debug CLI**: Debug the CLI with a sample YouTube URL
- **Debug Tests**: Debug a specific test file
- **Debug Current TS File**: Debug the currently open TypeScript file

## 📝 Pull Request Process

1. Ensure your branch is up to date:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Run all checks:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

3. Push your changes:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a Pull Request with:
   - Clear title and description
   - Reference to any related issues
   - Screenshots/examples if applicable

### PR Requirements

- All CI checks must pass
- Code coverage should not decrease
- At least one approval from maintainers
- No merge conflicts

## 🔒 Security

- Never commit sensitive data
- Use environment variables for secrets
- Report security issues privately
- Follow OWASP best practices

## 📚 Project Structure

```
yt-video-to-txt/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── config/             # Configuration files
│   ├── core/               # Core business logic
│   ├── services/           # Service implementations
│   ├── utils/              # Utility functions
│   └── __tests__/          # Test files
├── dist/                   # Compiled output
├── temp/                   # Temporary files
├── output/                 # Generated documents
└── logs/                   # Application logs
```

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive criticism
- Help others learn and grow

## 📞 Getting Help

- Check existing issues and discussions
- Ask questions in discussions
- Join our community chat
- Read the documentation

## 🎉 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing!