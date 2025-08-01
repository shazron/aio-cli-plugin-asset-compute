/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

const getCloudFile = require("../../src/lib/cloudfiles");

const { testCommand, assertExitCode, assertOccurrences, assertMissingOrEmptyDirectory } = require("./testutil");
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const glob = require("glob");
const rimraf = require("rimraf");
const nock = require("nock");

function buildPath(action) {
    return path.join("build", "test-results", `test-${action}`);
}

function assertTestResults(action) {
    const dir = buildPath(action);
    assert(fs.existsSync(path.join(dir, "test.log")));
    assert(fs.existsSync(path.join(dir, "test-results.xml")));
    assert(fs.existsSync(path.join(dir, "test-timing-results.csv")));
}

// TODO test ctrl+c (might need a child process)
// TODO test argument -u
describe("test-worker command in new aio structure", function() {
    testCommand("test-projects/aio-v8-single-worker", "asset-compute:test-worker")
        .it("runs tests in a project with new aio structure", function(ctx) {
            assertExitCode(undefined);
            assert(ctx.stdout.includes(" - simple"));
            assert(ctx.stdout.includes(" - corrupt"));
            assert(ctx.stdout.includes("✔  Succeeded."));
            assert(ctx.stdout.includes("✔︎ All tests were successful."));
            assert(ctx.stdout.includes("- Tests run      : 2"));
            assert(ctx.stdout.includes("- Failures       : 0"));
            assert(ctx.stdout.includes("- Errors         : 0"));
            assert(ctx.stdout.includes("- Expected errors: 1"));

            assert(!fs.existsSync(".nui"));
            assert(!fs.existsSync(path.join("actions", "worker", "build")));
            assertMissingOrEmptyDirectory("build", "test-worker");
            assertTestResults("worker");
        });
    testCommand("test-projects/aio-v8-multiple-workers", "asset-compute:test-worker")
        .it("runs tests for all workers", function(ctx) {
            assertExitCode(undefined);
            assert(ctx.stdout.includes(" - test-worker-1"));
            assert(ctx.stdout.includes(" - test-worker"));
            assertOccurrences(ctx.stdout, "✔  Succeeded.", 2);
            assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 2);
            assertOccurrences(ctx.stdout, "- Tests run      : 1", 2);
            assertOccurrences(ctx.stdout, "- Failures       : 0", 2);
            assertOccurrences(ctx.stdout, "- Errors         : 0", 2);

            assert(!fs.existsSync(".nui"));
            assert(!fs.existsSync(path.join("actions", "worker", "build")));
            assertMissingOrEmptyDirectory("build", "test-worker");
            assertTestResults("worker");
        });
    testCommand("test-projects/aio-v8-multiple-workers", "asset-compute:test-worker", ["-a", "worker-1"])
        .it("runs tests for the selected worker if -a is set", function(ctx) {
            assertExitCode(undefined);
            assert(ctx.stdout.includes(" - test-worker-1"));
            assertOccurrences(ctx.stdout, "✔  Succeeded.", 1);
            assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 1);
            assertOccurrences(ctx.stdout, "- Tests run      : 1", 1);
            assertOccurrences(ctx.stdout, "- Failures       : 0", 1);
            assertOccurrences(ctx.stdout, "- Errors         : 0", 1);

            assert(!fs.existsSync(".nui"));
            assert(!fs.existsSync(path.join("actions", "worker-1", "build")));
            assertMissingOrEmptyDirectory("build", "test-worker");
            assertTestResults("worker-1");
        });

    testCommand("test-projects/aio-v8-single-worker-bad-config", "asset-compute:test-worker")
        .it("fails to build actions if worker has a bad config", function(ctx) {
            assertExitCode(3);
            assert(ctx.stderr.includes("Error: Failed to build action"));
            assertMissingOrEmptyDirectory("build", "test-worker");
        });
});

describe("test-worker command", function() {
    describe("success", function() {

        testCommand("test-projects/multiple-workers", "asset-compute:test-worker")
            .it("runs tests for all workers", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes("Actions:\n- workerA\n- workerB"));
                assert(ctx.stdout.includes(" - testA"));
                assert(ctx.stdout.includes(" - testB"));
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 2);
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 2);
                assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 2);
                assertOccurrences(ctx.stdout, "- Tests run      : 1", 2);
                assertOccurrences(ctx.stdout, "- Failures       : 0", 2);
                assertOccurrences(ctx.stdout, "- Errors         : 0", 2);

                // legacy build folder, ensure it does not come back
                assert(!fs.existsSync(".nui"));
                // build directory must be in root
                assert(!fs.existsSync(path.join("actions", "workerA", "build")));
                assert(!fs.existsSync(path.join("actions", "workerB", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("workerA");
                assertTestResults("workerB");
            });

        testCommand("test-projects/multiple-workers", "asset-compute:test-worker", ["-a", "workerA"])
            .it("runs tests for the selected worker if -a is set", function(ctx) {
                assertExitCode(undefined);
                // assert(!ctx.stdout.includes("workerB"));
                assert(ctx.stdout.includes(" - testA"));
                // assert(!ctx.stdout.includes(" - testB"));
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 1);
                assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 1);
                assertOccurrences(ctx.stdout, "- Tests run      : 1", 1);
                assertOccurrences(ctx.stdout, "- Failures       : 0", 1);
                assertOccurrences(ctx.stdout, "- Errors         : 0", 1);

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "workerA", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("workerA");
            });

        testCommand("test-projects/single-worker", "asset-compute:test-worker")
            .it("runs tests for a single worker at the root", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/test-expected-error", "asset-compute:test-worker")
            .it("runs tests with an expected error", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - testcase"));
                assert(ctx.stdout.includes("✔  Succeeded (expected error)."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assert(ctx.stdout.includes("- Expected errors: 1"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/mockserver", "asset-compute:test-worker")
            .it("runs successful tests with a mocked domain", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - mock"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/cloudfiles", "asset-compute:test-worker")
            .prepare(() => {
                process.env.AWS_ACCESS_KEY_ID = "key";
                process.env.AWS_SECRET_ACCESS_KEY = "secret";
                // ensure the cloudfiles cache is deleted
                rimraf.sync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket"));
                nock("https://s3.amazonaws.com").get("/asset-compute-cli-test-bucket/source").reply(200, "correct file");
                nock("https://s3.amazonaws.com").get("/asset-compute-cli-test-bucket/rendition").reply(200, "correct file");
            })
            .it("runs successful tests with cloud files", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - cloudfile"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(fs.existsSync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket", "rendition")));
                assert(fs.existsSync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket", "source")));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/no-tests", "asset-compute:test-worker")
            .it("succeeds with non-zero exit code if there are no tests", function() {
                assertExitCode(undefined);
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertMissingOrEmptyDirectory("build", "test-results");
            });

        testCommand("test-projects/with space", "asset-compute:test-worker")
            .it("runs tests in a project with a space in the path", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 2"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        // nodejs:12 test removed - Node.js 12 is end-of-life and incompatible with modern dependencies
        testCommand("test-projects/node14", "asset-compute:test-worker")
            .it("runs tests in a project using kind nodejs:14", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/test-hidden-file", "asset-compute:test-worker")
            .it("runs tests for a single worker with a hidden file in the test cases", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/deadlines", "asset-compute:test-worker")
            .it("gives each test/activation different deadline and activation id", function(ctx) {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - one"));
                assert(ctx.stdout.includes(" - two"));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 2"));
                assert(ctx.stdout.includes("- Failures       : 2"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertTestResults("worker");

                const activationOne = require(path.resolve(glob.sync("build/test-worker/**/failed/one/rendition0.json")[0]));
                console.log("activation one:", JSON.stringify(activationOne));
                const activationTwo = require(path.resolve(glob.sync("build/test-worker/**/failed/two/rendition0.json")[0]));
                console.log("activation two:", JSON.stringify(activationTwo));

                assert.notStrictEqual(activationOne.__OW_DEADLINE, activationTwo.__OW_DEADLINE, "activation timeout/deadlines are the same for multiple test cases");
                assert.notStrictEqual(activationOne.__OW_ACTIVATION_ID, activationTwo.__OW_ACTIVATION_ID, "activation ids are the same for multiple test cases");
            });

        testCommand("test-projects/debug-log", "asset-compute:test-worker")
            .prepare(() => {
                process.env.WORKER_DEBUG = "myworker";
            })
            .it("passes WORKER_DEBUG env var through as DEBUG", function() {
                assertTestResults("worker");
                const testLog = fs.readFileSync(path.join(buildPath("worker"), "test.log"));
                assert(testLog.includes(">>>> debug log is here <<<<"));
            });
    });

    describe("failure", function() {

        testCommand("test-projects/test-failure-rendition", "asset-compute:test-worker")
            .it("fails with exit code 1 if test fails due to a different rendition result", function(ctx) {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: Rendition 'rendition0.jpg' not as expected."));
                assert(ctx.stdout.includes("Check build/test-results/test-worker/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assert(glob.sync("build/test-worker/**/failed/fails/rendition0.jpg").length, 1);
                assertTestResults("worker");
            });

        testCommand("test-projects/test-failure-missing-rendition", "asset-compute:test-worker")
            .it("fails with exit code 1 if test fails due to a missing rendition", function(ctx) {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: No rendition generated. Check build/test-results/test-worker/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/invocation-error", "asset-compute:test-worker")
            .it("fails with exit code 2 if the worker invocation errors", function() {
                assertExitCode(2);
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/build-error", "asset-compute:test-worker")
            .it("fails with exit code 3 if the worker does not build (has no manifest)", function(ctx) {
                assertExitCode(3);
                assert(ctx.stderr.match(/error.*manifest.yml/i));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertMissingOrEmptyDirectory("build", "test-results");
            });

        testCommand("test-projects/test-name-mismatch", "asset-compute:test-worker")
            .it("fails with exit code 3 if the test folder does not match an action name", function(ctx) {
                assertExitCode(3);
                assert(ctx.stderr.match(/error.*incorrect/i));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertMissingOrEmptyDirectory("build", "test-results");
            });

        testCommand("test-projects/multiple-workers", "asset-compute:test-worker", ["-a", "doesNotExist"])
            .it("fails with exit code 3 if the action specified with -a does not exist", function(ctx) {
                assertExitCode(3);
                assert(ctx.stderr.match(/error.*doesNotExist/i));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertMissingOrEmptyDirectory("build", "test-results");
            });

        testCommand("test-projects/unsupportedkind", "asset-compute:test-worker")
            .it("fails with exit code 3 if the worker has an unexpected kind (runtime)", function(ctx) {
                assertExitCode(3);
                assert(ctx.stderr.includes("Unsupported kind: does-not-exist"));
                assertMissingOrEmptyDirectory("build", "test-worker");
            });
    });
});
