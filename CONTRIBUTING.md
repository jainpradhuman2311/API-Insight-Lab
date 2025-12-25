# Contributing to API Performance Tester

Thank you for your interest in contributing to the API Performance Tester module! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by the [Drupal Code of Conduct](https://www.drupal.org/dcoc).

## Getting Started

### Development Setup

1. **Clone the Repository**
   ```bash
   git clone [repository-url]
   cd api_perf_tester
   ```

2. **Install Dependencies**
   ```bash
   composer install
   cd react-ui
   npm install
   ```

3. **Build Frontend**
   ```bash
   npm run build
   ```

4. **Enable Module in Drupal**
   ```bash
   drush en api_perf_tester -y
   drush cr
   ```

### Development Workflow

1. Create a new branch for your feature/fix
2. Make your changes
3. Test your changes thoroughly
4. Commit with clear, descriptive messages
5. Submit a pull request

## Coding Standards

### PHP Code

Follow [Drupal Coding Standards](https://www.drupal.org/docs/develop/standards):

```bash
# Install PHP CodeSniffer
composer require --dev drupal/coder

# Check code
./vendor/bin/phpcs --standard=Drupal,DrupalPractice web/modules/custom/api_perf_tester

# Auto-fix issues
./vendor/bin/phpcbf --standard=Drupal web/modules/custom/api_perf_tester
```

### JavaScript/TypeScript Code

- Follow standard React and TypeScript best practices
- Use ESLint and Prettier for formatting
- Maintain consistent code style

```bash
cd react-ui
npm run lint
npm run format
```

### Documentation

- Add PHPDoc blocks to all classes and methods
- Add JSDoc comments to React components
- Update README.md for new features
- Include inline comments for complex logic

## Testing

### Backend Tests

```bash
# Run PHPUnit tests
./vendor/bin/phpunit web/modules/custom/api_perf_tester
```

### Frontend Tests

```bash
cd react-ui
npm run test
```

### Manual Testing

Before submitting:
1. Test all affected features
2. Test with different user permissions
3. Check browser console for errors
4. Verify mobile responsiveness
5. Test in both light and dark modes

## Submitting Contributions

### Pull Request Process

1. **Update Documentation**
   - Update README.md if needed
   - Add entry to CHANGELOG.md
   - Update code comments

2. **Create Pull Request**
   - Provide clear description
   - Reference any related issues
   - Include screenshots for UI changes
   - List breaking changes if any

3. **Code Review**
   - Address review comments
   - Keep commits focused and atomic
   - Rebase if needed

4. **After Merge**
   - Delete your feature branch
   - Pull latest changes

### Commit Message Guidelines

Use clear, descriptive commit messages:

```
Issue #123: Add JSONPath assertion type

- Implemented JSONPath parsing
- Added UI for JSONPath assertions
- Updated documentation
- Added tests
```

## Feature Requests

- Check existing issues first
- Provide clear use case
- Include mockups if applicable
- Discuss implementation approach

## Bug Reports

When reporting bugs, include:

1. **Environment**
   - Drupal version
   - PHP version
   - Browser/OS
   - Module version

2. **Steps to Reproduce**
   - Clear step-by-step instructions
   - Expected vs. actual behavior

3. **Additional Context**
   - Screenshots
   - Error messages
   - Browser console logs
   - PHP error logs

## Areas for Contribution

### High Priority
- Unit test coverage
- Performance optimizations
- Accessibility improvements
- Security audits
- Documentation enhancements

### Medium Priority
- New assertion types
- Additional authentication methods
- Export/import functionality
- UI/UX improvements

### Good First Issues
- Documentation improvements
- Code cleanup
- Adding type hints
- Fixing coding standard violations

## Development Guidelines

### PHP Backend

1. **Use Dependency Injection**
   ```php
   public function __construct(ClientFactory $http_client_factory) {
     $this->httpClientFactory = $http_client_factory;
   }
   ```

2. **Follow Entity API Patterns**
   ```php
   $entity = ApiTestConfig::create(['name' => 'Test']);
   $entity->save();
   ```

3. **Use Drupal Services**
   ```php
   $config = \Drupal::config('api_perf_tester.settings');
   ```

### React Frontend

1. **Use Functional Components and Hooks**
   ```tsx
   const MyComponent = () => {
     const [state, setState] = useState(initialState);
     return <div>...</div>;
   };
   ```

2. **Type Everything**
   ```tsx
   interface Props {
     url: string;
     onSubmit: (data: TestData) => void;
   }
   ```

3. **Extract Reusable Logic**
   ```tsx
   const useApiTest = () => {
     // Custom hook logic
   };
   ```

## Release Process

1. Update version in `.info.yml`
2. Update CHANGELOG.md
3. Tag release
4. Create release notes
5. Announce on Drupal.org

## Questions?

- Open an issue for questions
- Join discussions in issue queue
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under GPL-2.0-or-later.

---

Thank you for contributing to API Performance Tester! 🚀
