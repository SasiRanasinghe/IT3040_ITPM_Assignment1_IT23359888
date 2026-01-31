import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

class CustomReporter implements Reporter {
    private outputFile = path.join(process.cwd(), 'test_results.csv');

    onBegin(config: any, suite: any) {
        const headers = 'TC ID,Test Case Name,Input,Expected Output,Actual Output,Status (PASS/FAIL),Remarks,What is covered by the test\n';
        fs.writeFileSync(this.outputFile, headers);
        console.log('CustomReporter: Initialized and wrote headers.');
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const status = result.status === 'passed' ? 'PASS' : 'FAIL';

        // Ultra-aggressive strip
        const stripAnsi = (str: string) => str
            .replace(/\u001b\[.*?m/g, '') // Standard ANSI
            .replace(/\[\d+m/g, '')        // Literal like [2m
            .replace(/\[\d+;\d+m/g, '')    // Literal like [22;31m
            .replace(/\[\d+;\d+;\d+m/g, '')
            .replace(/\[.*?m/g, '');       // ULTRA AGGRESSIVE: Remove anything looking like [code m

        let csvData = { id: '', input: '', expected: '', coverage: '', name: '' };
        let actualOutput = '';

        const dataAnnotation = test.annotations.find(a => a.type === 'csv_data');
        if (dataAnnotation) {
            try {
                csvData = JSON.parse(dataAnnotation.description || '{}');
            } catch (e) {
                console.error('Failed to parse csv_data annotation', e);
            }
        } else {
            csvData.id = test.title.split(':')[0];
            csvData.name = test.title;
        }

        // Always prioritize the captured annotation
        const outputAnnotation = test.annotations.find(a => a.type === 'actual_output');
        actualOutput = outputAnnotation ? outputAnnotation.description || '' : '';

        // Fallback: Try to parse from error if annotation missed (rare)
        if (!actualOutput && result.errors && result.errors.length > 0) {
            const rawError = result.errors[0].message || '';
            const cleanError = stripAnsi(rawError);

            const match = cleanError.match(/Received string:\s+"(.*?)"/);
            if (match) {
                actualOutput = match[1];
            } else {
                const valMatch = cleanError.match(/unexpected value "(.*?)"/);
                if (valMatch) actualOutput = valMatch[1];
            }
        }

        let remarks = 'Success';
        if (status !== 'PASS') {
            if (!actualOutput || actualOutput.trim() === '') {
                remarks = 'No output generated';
            } else if (csvData.expected && !actualOutput.includes(csvData.expected.trim())) {
                remarks = 'Output differs from expected';
            } else {
                const rawMsg = result.error?.message || 'Failed';
                const cleanMsg = stripAnsi(rawMsg);
                remarks = cleanMsg.replace(/\n/g, ' ').substring(0, 150);
            }
        }

        const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

        const line = `${escape(csvData.id)},${escape(csvData.name)},${escape(csvData.input)},${escape(csvData.expected)},${escape(actualOutput)},${status},${escape(remarks)},${escape(csvData.coverage)}\n`;

        fs.appendFileSync(this.outputFile, line);
    }

    onEnd(result: FullResult) {
        console.log(`Test Run Completed: ${result.status.toUpperCase()}`);
        console.log(`Results saved to: ${this.outputFile}`);
    }
}

export default CustomReporter;
