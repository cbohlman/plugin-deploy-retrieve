/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { assert, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { StatusResult } from '@salesforce/plugin-source/lib/formatters/source/statusFormatter';
import { ComponentStatus } from '@salesforce/source-deploy-retrieve';
import { PreviewResult } from '../../../src/utils/previewOutput';
import { DeployResultJson } from '../../../src/utils/types';

let session: TestSession;
let cssPathAbsolute: string;
let cssPathRelative: string;

const filterIgnored = (r: StatusResult): boolean => r.ignored !== true;

describe('lwc', () => {
  before(async () => {
    session = await TestSession.create({
      project: {
        gitClone: 'https://github.com/trailheadapps/ebikes-lwc',
      },
      devhubAuthStrategy: 'AUTO',
      scratchOrgs: [
        {
          executable: 'sf',
          duration: 1,
          setDefault: true,
          config: path.join('config', 'project-scratch-def.json'),
        },
      ],
    });

    cssPathRelative = path.join('force-app', 'main', 'default', 'lwc', 'heroDetails', 'heroDetails.css');
    cssPathAbsolute = path.join(session.project.dir, cssPathRelative);
  });

  after(async () => {
    await session?.zip(undefined, 'artifacts');
    await session?.clean();
  });

  it('pushes the repo to get source tracking started', () => {
    const resp = execCmd<DeployResultJson>('deploy metadata --json');
    expect(resp.jsonOutput?.status, JSON.stringify(resp)).equals(0);
  });

  it('sfdx sees lwc css changes in local status', async () => {
    await fs.promises.writeFile(
      cssPathAbsolute,
      (await fs.promises.readFile(cssPathAbsolute, 'utf-8')).replace('absolute', 'relative')
    );
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result;
    expect(result?.find((r) => r.filePath === cssPathRelative)).to.have.property('actualState', 'Changed');
  });

  it('sf sees lwc css changes in local status', () => {
    const result = execCmd<PreviewResult>('deploy metadata preview --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    // subcomponent (css file deletion) deleted turns into a Deploy of the parent component without the deleted file
    // this is a slightly different behavior than sfdx, but makes more sense
    expect(result.toDeploy, JSON.stringify(result)).to.have.lengthOf(1);
    expect(result.toDeploy.find((r) => r.fullName === 'heroDetails', JSON.stringify(result))).to.have.property(
      'operation',
      'deploy'
    );
  });

  it('pushes lwc css change', () => {
    const result = execCmd<DeployResultJson>('deploy metadata --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result.files;
    // we get a result for each bundle member, even though only one changed
    expect(result?.filter((r) => r.fullName === 'heroDetails')).to.have.length(4);
  });

  it('sfdx sees no local changes', () => {
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    })
      .jsonOutput?.result.filter((r) => r.origin === 'Local')
      .filter(filterIgnored);
    expect(result).to.have.length(0);
  });

  it('sf sees no local changes', () => {
    const result = execCmd<PreviewResult>('deploy metadata preview --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result.toDeploy).to.have.length(0);
    expect(result.toRetrieve).to.have.length(0);
  });

  it("deleting an lwc sub-component should show the sub-component as 'Deleted'", async () => {
    await fs.promises.rm(cssPathAbsolute);
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    })
      .jsonOutput?.result.filter(filterIgnored)
      .find((r) => r.filePath === cssPathRelative);
    expect(result).to.deep.equal({
      fullName: 'heroDetails',
      type: 'LightningComponentBundle',
      state: 'Local Deleted',
      ignored: false,
      filePath: cssPathRelative,
      origin: 'Local',
      actualState: 'Deleted',
      conflict: false,
    });
  });

  it('pushes lwc subcomponent delete', () => {
    const result = execCmd<DeployResultJson>('deploy metadata --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result.files;
    const bundleMembers = result?.filter((r) => r.fullName === 'heroDetails');
    // TODO: these were previously corrected to show the deleted subcomponent.
    // To make sf do that, complete W-10256537 (SDR)
    // expect(bundleMembers, JSON.stringify(bundleMembers)).to.have.length(4);
    // expect(bundleMembers.filter((r) => r.state === 'Deleted')).to.have.length(1);
    expect(bundleMembers, JSON.stringify(bundleMembers)).to.have.length(3);
    expect(bundleMembers?.filter((r) => r.state === ComponentStatus['Changed'])).to.have.length(3);
  });

  it('sees no local changes', () => {
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    })
      .jsonOutput?.result.filter((r) => r.origin === 'Local')
      .filter(filterIgnored);
    expect(result).to.have.length(0);
  });

  it('sf sees no local changes', () => {
    const result = execCmd<PreviewResult>('deploy metadata preview --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result.toDeploy).to.have.length(0);
    expect(result.toRetrieve).to.have.length(0);
  });

  it('deletes entire component locally', async () => {
    const dependentLWCPath = path.join(session.project.dir, 'force-app', 'main', 'default', 'lwc', 'hero', 'hero.html');
    // remove the component
    await fs.promises.rm(path.join(session.project.dir, 'force-app', 'main', 'default', 'lwc', 'heroDetails'), {
      recursive: true,
      force: true,
    });

    // remove a dependency on that component
    await fs.promises.writeFile(
      dependentLWCPath,
      (await fs.promises.readFile(dependentLWCPath, 'utf-8')).replace(/<c-hero.*hero-details>/s, '')
    );
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    }).jsonOutput?.result.filter((r) => r.origin === 'Local');
    assert(result);
    expect(result.filter(filterIgnored)).to.have.length(4);
    expect(result.filter(filterIgnored).filter((r) => r.actualState === 'Deleted')).to.have.length(3);
    expect(result.filter(filterIgnored).filter((r) => r.actualState === 'Changed')).to.have.length(1);
  });

  it('push deletes the LWC remotely', () => {
    const result = execCmd<DeployResultJson>('deploy metadata --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result.files;
    // there'll also be changes for the changed Hero component html, but we've already tested changing a bundle member
    const bundleMembers = result?.filter((r) => r.fullName === 'heroDetails');
    expect(bundleMembers).to.have.length(3);
    expect(
      bundleMembers?.every((r) => r.state === ComponentStatus['Deleted']),
      JSON.stringify(bundleMembers, undefined, 2)
    ).to.be.true;
  });

  it('sees no local changes', () => {
    const result = execCmd<StatusResult[]>('force:source:status --json', {
      ensureExitCode: 0,
      cli: 'sf',
    })
      .jsonOutput?.result.filter((r) => r.origin === 'Local')
      .filter(filterIgnored);
    expect(result).to.have.length(0);
  });
  it('sf sees no local changes', () => {
    const result = execCmd<PreviewResult>('deploy metadata preview --json', {
      ensureExitCode: 0,
    }).jsonOutput?.result;
    assert(result);
    expect(result.toDeploy).to.have.length(0);
    expect(result.toRetrieve).to.have.length(0);
  });

  it('detects remote subcomponent conflicts');
});
