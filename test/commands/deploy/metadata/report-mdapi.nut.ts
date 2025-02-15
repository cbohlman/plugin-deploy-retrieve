/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { unlinkSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SourceTestkit } from '@salesforce/source-testkit';
import { assert, expect } from 'chai';
import { RequestStatus } from '@salesforce/source-deploy-retrieve';
import { DeployResultJson } from '../../../../src/utils/types';

describe('[project deploy report] NUTs with metadata-dir', () => {
  let testkit: SourceTestkit;
  const mdSourceDir = 'mdapiOut';
  const orgAlias = 'reportMdTestOrg2';

  before(async () => {
    testkit = await SourceTestkit.create({
      repository: 'https://github.com/salesforcecli/sample-project-multiple-packages.git',
      nut: __filename,
      scratchOrgs: [{ duration: 1, alias: orgAlias, config: join('config', 'project-scratch-def.json') }],
    });
    await testkit.convert({
      args: `--source-dir force-app --output-dir ${mdSourceDir}`,
      json: true,
      exitCode: 0,
    });
  });

  after(async () => {
    await testkit?.clean();
  });

  describe('--use-most-recent', () => {
    it('should report most recently started deployment', async () => {
      await testkit.execute<DeployResultJson>('project deploy start', {
        args: `--metadata-dir ${mdSourceDir} --async`,
        json: true,
        exitCode: 0,
      });

      const deploy = await testkit.execute<DeployResultJson>('project deploy report', {
        args: '--use-most-recent',
        json: true,
        exitCode: 0,
      });
      assert(deploy?.result);
      expect([RequestStatus.Pending, RequestStatus.Succeeded, RequestStatus.InProgress]).includes(deploy.result.status);
    });
  });

  describe('--job-id', () => {
    it('should report the provided job id', async () => {
      const first = await testkit.execute<DeployResultJson>('project deploy start', {
        args: `--metadata-dir ${mdSourceDir} --async`,
        json: true,
        exitCode: 0,
      });
      const deploy = await testkit.execute<DeployResultJson>('project deploy report', {
        args: `--job-id ${first?.result.id}`,
        json: true,
        exitCode: 0,
      });
      assert(deploy?.result);
      expect([RequestStatus.Pending, RequestStatus.Succeeded, RequestStatus.InProgress]).includes(deploy.result.status);
      expect(deploy.result.id).to.equal(first?.result.id);
    });

    it('should report from specified target-org and job-id without deploy cache', async () => {
      const first = await testkit.execute<DeployResultJson>('project deploy start', {
        args: `--metadata-dir ${mdSourceDir} --async --target-org ${orgAlias}`,
        json: true,
        exitCode: 0,
      });

      // delete the cache file so we can verify that reporting just with job-id and org works
      const deployCacheFilePath = resolve(testkit.projectDir, join('..', '.sf', 'deploy-cache.json'));
      unlinkSync(deployCacheFilePath);
      assert(!existsSync(deployCacheFilePath));

      const deploy = await testkit.execute<DeployResultJson>('project deploy report', {
        args: `--job-id ${first?.result.id} --target-org ${orgAlias} --wait 9`,
        json: true,
        exitCode: 0,
      });
      assert(deploy?.result);
      expect(deploy.result.success).to.equal(true);
      expect(deploy.result.status).to.equal(RequestStatus.Succeeded);
      expect(deploy.result.id).to.equal(first?.result.id);
      await testkit.expect.filesToBeDeployed(['force-app/**/*'], ['force-app/test/**/*']);
    });
  });
});
