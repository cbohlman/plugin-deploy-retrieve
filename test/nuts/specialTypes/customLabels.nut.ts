/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { SourceTestkit } from '@salesforce/source-testkit';

context('deploy metadata CustomLabels NUTs', () => {
  let testkit: SourceTestkit;

  before(async () => {
    testkit = await SourceTestkit.create({
      repository: 'https://github.com/salesforcecli/sample-project-multiple-packages.git',
      nut: __filename,
    });
  });

  after(async () => {
    try {
      await testkit?.clean();
    } catch (e) {
      // if the it fails to clean, don't throw so NUTs will pass
      // eslint-disable-next-line no-console
      console.log('Clean Failed: ', e);
    }
  });

  describe('CustomLabels', () => {
    // NOTE these are glob patterns so there's no need to use path.join here
    const forceAppLabels = 'force-app/main/default/labels/CustomLabels.labels-meta.xml';
    const myAppLabels = 'my-app/labels/CustomLabels.labels-meta.xml';

    describe('--source-dir', () => {
      it('should deploy all CustomLabels from a single package', async () => {
        await testkit.deploy({ args: `--source-dir ${path.join('force-app', 'main', 'default', 'labels')}` });
        await testkit.expect.filesToBeDeployed([forceAppLabels]);
      });

      it('should deploy all CustomLabels from multiple packages', async () => {
        const args = [
          `--source-dir ${path.join('force-app', 'main', 'default', 'labels')}`,
          `--source-dir ${path.join('my-app', 'labels')}`,
        ].join(' ');
        await testkit.deploy({ args });
        await testkit.expect.filesToBeDeployed([forceAppLabels, myAppLabels]);
      });
    });

    describe('--metadata', () => {
      it('should deploy all CustomLabels', async () => {
        await testkit.deploy({ args: '--metadata CustomLabels' });
        await testkit.expect.filesToBeDeployed([forceAppLabels]);
      });

      it('should deploy individual CustomLabel', async () => {
        await testkit.deploy({ args: '--metadata CustomLabel:force_app_Label_1' });
        await testkit.expect.filesToBeDeployed([forceAppLabels]);
      });

      it('should deploy multiple individual CustomLabel', async () => {
        await testkit.deploy({
          args: '--metadata CustomLabel:force_app_Label_1 --metadata CustomLabel:my_app_Label_1',
        });
        await testkit.expect.filesToBeDeployed([forceAppLabels, myAppLabels]);
      });
    });
  });
});
