/* eslint-disable @typescript-eslint/no-var-requires */
const { DefaultReporter, SummaryReporter } = require('@jest/reporters')

/**
 * A Jest reporter that only prints output for failing test suites.
 * Passing suites are silently skipped.
 */
class FailuresOnlyReporter extends DefaultReporter {
  onTestResult(test, testResult, aggregatedResult) {
    // Only print details when the suite has failures
    if (
      testResult.numFailingTests > 0 ||
      testResult.testExecError ||
      testResult.failureMessage
    ) {
      super.onTestResult(test, testResult, aggregatedResult)
    } else {
      // Still accumulate results for the final summary without printing
      this._addAggregatedResult(aggregatedResult, testResult)
    }
  }

  _addAggregatedResult(aggregatedResult, testResult) {
    aggregatedResult.numTotalTests +=
      testResult.numPassingTests +
      testResult.numFailingTests +
      testResult.numPendingTests +
      testResult.numTodoTests
    aggregatedResult.numPassedTests += testResult.numPassingTests
    aggregatedResult.numFailedTests += testResult.numFailingTests
    aggregatedResult.numPendingTests += testResult.numPendingTests
    aggregatedResult.numTodoTests += testResult.numTodoTests
    aggregatedResult.numTotalTestSuites++
    if (testResult.numFailingTests > 0 || testResult.testExecError) {
      aggregatedResult.numFailedTestSuites++
    } else if (
      testResult.numPendingTests ===
        testResult.numPassingTests +
          testResult.numPendingTests +
          testResult.numTodoTests &&
      testResult.numPassingTests === 0
    ) {
      aggregatedResult.numPendingTestSuites++
    } else {
      aggregatedResult.numPassedTestSuites++
    }
    aggregatedResult.testResults.push(testResult)
  }
}

module.exports = FailuresOnlyReporter
