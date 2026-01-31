import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Simple CSV parser
const csvFilePath = path.join(__dirname, '../IT23359888_TestCases.csv');

function readCsv(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = [];

    // Manual CSV parsing state machine to handle quoted newlines
    let currentField = '';
    let inQuotes = false;
    let currentRow = [];

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (char === '"') {
            // Toggle quotes input
            if (inQuotes && content[i + 1] === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            // End of line (handle \r\n or \n)
            if (char === '\r' && content[i + 1] === '\n') i++;

            currentRow.push(currentField.trim());

            // Process the row
            if (currentRow.length > 5 && currentRow[0] !== 'TC ID') { // Skip header and empty lines
                data.push({
                    id: currentRow[0],
                    scenario: currentRow[1],
                    input: currentRow[3],
                    expected: currentRow[4],
                    type: currentRow[8]
                });
            }

            // Reset for next row
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }

    // Handle last row if no newline at end
    if (currentRow.length > 0 || currentField.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 5 && currentRow[0] !== 'TC ID') {
            data.push({
                id: currentRow[0],
                scenario: currentRow[1],
                input: currentRow[3],
                expected: currentRow[4],
                type: currentRow[8]
            });
        }
    }

    return data;
}

const testCases = readCsv(csvFilePath);

test.describe('SwiftTranslator Automation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    for (const tc of testCases) {
        // Skip if input is empty
        if (!tc.input) continue;

        // Skip the unique UI test (handled manually)
        if (tc.id.startsWith('Pos_UI') || tc.id === 'Neg_UI_0001') continue;

        test(`${tc.id}: ${tc.scenario}`, async ({ page }) => {
            // Add metadata to test info for the reporter
            test.info().annotations.push({
                type: 'csv_data',
                description: JSON.stringify({
                    id: tc.id,
                    input: tc.input,
                    expected: tc.expected,
                    coverage: tc.type,
                    name: tc.scenario
                })
            });

            // Selectors identified by browser verification
            const inputArea = page.locator('textarea').first();
            // Output is a DIV, not a textarea
            const outputArea = page.locator('div.bg-slate-50.whitespace-pre-wrap').first();

            // Clear before typing
            await inputArea.fill('');
            await inputArea.fill(tc.input);

            // Capture actual output regardless of pass/fail
            try {
                // Use auto-retrying assertion
                await expect(outputArea).toContainText(tc.expected.trim(), { timeout: 15000 });
            } catch (error) {
                throw error;
            } finally {
                // Always try to capture what's on screen
                try {
                    let actualText = await outputArea.innerText();

                    // Second chance: if empty, wait a bit and try again
                    if (!actualText || actualText.trim() === '') {
                        await page.waitForTimeout(2000);
                        actualText = await outputArea.innerText();
                    }

                    test.info().annotations.push({
                        type: 'actual_output',
                        description: actualText
                    });
                } catch (e) {
                    test.info().annotations.push({
                        type: 'actual_output',
                        description: '' // Capture failed (likely element missing)
                    });
                }
            }
        });
    }

    // Specific UI Test: Real-time update
    test('Pos_UI_01: Real-time Update', async ({ page }) => {
        const inputArea = page.locator('textarea').first();
        const outputArea = page.locator('div.bg-slate-50.whitespace-pre-wrap').first();

        // Type full word 'mata'
        await inputArea.pressSequentially('mata', { delay: 100 });

        // Check full word result only
        await expect(outputArea).toHaveText('මට', { timeout: 15000 });
    });

    // Specific UI Test: Clear Button
    test('Pos_UI_0002: Input field clear functionality', async ({ page }) => {
        const inputArea = page.locator('textarea').first();
        const outputArea = page.locator('div.bg-slate-50.whitespace-pre-wrap').first();
        // Updated selector based on browser inspection
        const clearButton = page.locator('button[aria-label="Clear"]');

        // 1. Enter text
        await inputArea.fill('suba rathriyak');

        // 2. Click clear button
        await clearButton.click();

        // 3. Verify input and output are empty
        await expect(inputArea).toHaveValue('', { timeout: 15000 });
        await expect(outputArea).toHaveText('', { timeout: 15000 });
    });

    // Specific UI Test: Real-time update on delete (Neg_UI_0001)
    test('Neg_UI_0001: Output does not update correctly after deleting part of the input', async ({ page }) => {
        const inputArea = page.locator('textarea').first();
        const outputArea = page.locator('div.bg-slate-50.whitespace-pre-wrap').first();

        const fullInput = 'mama gedhara yanavaa saha passe kaema kanavaa';
        // Approximate expected output for the full sentence - for context mainly, the test checks the update
        // "මම ගෙදර යනවා සහ පස්සෙ කෑම කනවා"

        const partToDelete = ' saha passe kaema kanavaa';
        const expectedFinalInput = 'mama gedhara yanavaa';
        const expectedFinalOutput = 'මම ගෙදර යනවා';

        // 1. Type the full sentence
        await inputArea.pressSequentially(fullInput, { delay: 50 });

        // Wait for translation to stabilize (assuming it works initially)
        await page.waitForTimeout(2000);

        // ASSERT: Ensure full translation is present first
        await expect(outputArea).toContainText('පස්සෙ', { timeout: 10000 });

        // 2. Delete part of the input using Backspace
        for (let i = 0; i < partToDelete.length; i++) {
            await inputArea.press('Backspace');
            await page.waitForTimeout(50); // Small delay to simulate human speed
        }

        // 3. Verify the output matches the remaining input
        // The bug report says it fails here (remains old text)
        await expect(outputArea).toHaveText(expectedFinalOutput, { timeout: 10000 });
    });

});
