import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  assertNoParentIdUse,
  buildSubagentTree,
  pendingPermissionRequests,
  readEvents,
  type RuntimeEvent,
} from './events.ts';
import { buildSessionState } from './fixture-runtime.ts';

describe('subagent tree construction', () => {
  test('joins the spawning tool call to the emitting agent, and resolves completely', async () => {
    const fixture = await buildSessionState([
      {
        sessionId: 's1',
        subagents: [
          { agentId: 'tc-1', agentName: 'explore' },
          { agentId: 'tc-2', agentName: 'explore' },
          // nested: spawned by the subagent tc-1
          { agentId: 'tc-3', agentName: 'general-purpose', parentAgentId: 'tc-1' },
        ],
      },
    ]);
    try {
      const { events } = await readEvents(fixture.sessionStateRoot, 's1');
      const tree = buildSubagentTree(events);

      assert.equal(tree.byId.size, 3);
      assert.deepEqual(tree.unresolved, []);
      assert.equal(tree.roots.length, 2, 'tc-1 and tc-2 are root-spawned');
      assert.equal(tree.maxDepth, 2, 'tc-3 nests under tc-1');
      assert.equal(tree.byId.get('tc-3')?.parentAgentId, 'tc-1');
      assert.equal(tree.byId.get('tc-1')?.parentAgentId, null, 'root-spawned means main agent');
    } finally {
      await fixture.cleanup();
    }
  });

  test('a subagent whose spawning tool call is absent is reported unresolved, not invented', async () => {
    const fixture = await buildSessionState([
      {
        sessionId: 's1',
        subagents: [{ agentId: 'tc-orphan', omitToolCall: true }],
      },
    ]);
    try {
      const { events } = await readEvents(fixture.sessionStateRoot, 's1');
      const tree = buildSubagentTree(events);
      assert.deepEqual(tree.unresolved, ['tc-orphan']);
    } finally {
      await fixture.cleanup();
    }
  });

  /**
   * The regression this whole module exists to prevent. A fully populated
   * `parentId` chain is present in the fixture; a correct tree must ignore it.
   * Reading it would produce a deep chain of "parents" that are event ids.
   */
  test('a misleading parentId chain does not change the tree', async () => {
    const specs = [
      {
        sessionId: 's1',
        subagents: [
          { agentId: 'tc-1' },
          { agentId: 'tc-2' },
          { agentId: 'tc-3' },
        ],
      },
    ];
    const honest = await buildSessionState(specs);
    const misleading = await buildSessionState([{ ...specs[0]!, withMisleadingParentIds: true }]);
    try {
      const a = buildSubagentTree((await readEvents(honest.sessionStateRoot, 's1')).events);
      const b = buildSubagentTree((await readEvents(misleading.sessionStateRoot, 's1')).events);

      assert.equal(b.roots.length, 3, 'all three are root-spawned regardless of the chain');
      assert.equal(b.maxDepth, 1, 'a parentId-derived tree would be 3 deep here');
      assert.equal(a.maxDepth, b.maxDepth);
      assert.deepEqual(
        [...a.byId.keys()].sort(),
        [...b.byId.keys()].sort(),
        'the chain must not change which subagents exist',
      );
    } finally {
      await honest.cleanup();
      await misleading.cleanup();
    }
  });

  test('the source of events.ts never reads parentId', async () => {
    const source = await readFile(join(import.meta.dirname, 'events.ts'), 'utf8');
    assert.doesNotThrow(() => assertNoParentIdUse(source));
  });

  test('the parentId guard actually catches a reintroduction', () => {
    assert.throws(
      () => assertNoParentIdUse('const parent = event.parentId;'),
      /chronological chain pointer/,
    );
  });

  test('a cyclic log cannot hang the tree builder', () => {
    const events: RuntimeEvent[] = [
      { type: 'tool.execution_start', agentId: 'b', data: { toolCallId: 'a' } },
      { type: 'tool.execution_start', agentId: 'a', data: { toolCallId: 'b' } },
      { type: 'subagent.started', agentId: 'a', data: { toolCallId: 'a', agentName: 'x' } },
      { type: 'subagent.started', agentId: 'b', data: { toolCallId: 'b', agentName: 'y' } },
    ];
    const tree = buildSubagentTree(events);
    assert.equal(tree.byId.size, 2);
    assert.ok(Number.isFinite(tree.maxDepth));
  });
});

describe('Attention predicate', () => {
  test('an unmatched permission.requested is pending; a matched one is not', async () => {
    const fixture = await buildSessionState([
      {
        sessionId: 's1',
        pendingPermissions: ['req-open'],
        completedPermissions: ['req-closed'],
      },
    ]);
    try {
      const { events } = await readEvents(fixture.sessionStateRoot, 's1');
      const pending = pendingPermissionRequests(events).map((p) => p.requestId);
      assert.deepEqual(pending, ['req-open']);
    } finally {
      await fixture.cleanup();
    }
  });

  test('a session with no permission events has no Attention', async () => {
    const fixture = await buildSessionState([{ sessionId: 's1' }]);
    try {
      const { events } = await readEvents(fixture.sessionStateRoot, 's1');
      assert.deepEqual(pendingPermissionRequests(events), []);
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('event log reading', () => {
  test('an unreadable log yields no events and says so in its evidence', async () => {
    const { events, evidence } = await readEvents('/nonexistent-root', 'nope');
    assert.deepEqual(events, []);
    assert.match(evidence.detail, /unreadable/);
  });
});
