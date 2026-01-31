# SwiftTranslator Automation

This project automates the testing of [SwiftTranslator](https://www.swifttranslator.com/) using **Playwright**.

## Prerequisites
- Node.js (v14+)
- NPM

## Installation
1. Navigate to the project folder.
2. Run `npm install` to install dependencies.
3. Run `npx playwright install` to install browser binaries.

## Usage
- **Run all tests**:
  ```bash
  npx playwright test
  ```

- **View Report**:
  ```bash
  npx playwright show-report
  ```

- **Run in UI Mode**:
  ```bash
  npx playwright test --ui
  ```

## Test Coverage
The project covers:
- **24+ Positive Scenarios** (Sentence structures, Tenses, Grammar, etc.)
- **10 Negative Scenarios** (Robustness, Error Handling)
- **1 UI Scenario** (Real-time updates)

Test cases are defined in `IT23359888_TestCases.csv`.
