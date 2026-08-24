import assert from "node:assert/strict"
import test from "node:test"
import {
  BLOCKING_NOTIFICATIONS,
  QUIET_NOTIFICATIONS,
  shouldForward,
} from "../src/notification-filter.js"

/**
 * The notification filter (#64).
 *
 * The safety default here is the INVERSE of the rest of Maestro. Elsewhere,
 * failing safe means doing nothing. Here it means forwarding, because this
 * process sits between the runtime and a prompt the operator may be waiting on.
 *
 * So every suppression assertion below is paired with a forwarding assertion.
 * A filter tested only for silence would pass while suppressing everything,
 * which is precisely the bug that matters — a permission prompt that never
 * announces itself is far worse than the noise this ticket set out to remove.
 */

// --- the noise this exists to stop -------------------------------------------

test("non-blocking notifications are suppressed", () => {
  // Measured types in one session: agent_idle (7), shell_completed (1),
  // shell_detached_completed (1). None of them blocks the operator; a subagent
  // going quiet is already visible in the tree.
  for (const type of ["agent_idle", "shell_completed", "shell_detached_completed"]) {
    assert.equal(
      shouldForward(JSON.stringify({ notification_type: type })),
      false,
      `${type} must not raise a notification`,
    )
  }
})

// --- the signal it must never swallow ----------------------------------------

test("blocking notifications are forwarded", () => {
  for (const type of ["permission_prompt", "elicitation_dialog"]) {
    assert.equal(
      shouldForward(JSON.stringify({ notification_type: type })),
      true,
      `${type} blocks the operator and must still notify`,
    )
  }
})

test("the suppressed set and the blocking set cannot overlap", () => {
  // A type in both would be silently dropped while still raising a badge.
  for (const type of QUIET_NOTIFICATIONS) {
    assert.equal(BLOCKING_NOTIFICATIONS.has(type), false, `${type} is in both sets`)
  }
})

test("the blocking set matches the reducer's own definition of attention", () => {
  // Two places must not disagree about what blocks: the badge and the
  // notification. If these ever diverge, a Session can raise an ASK badge and
  // stay silent, or notify without a badge.
  assert.deepEqual([...BLOCKING_NOTIFICATIONS].sort(), ["elicitation_dialog", "permission_prompt"])
})

test("both spellings of the type field are read", () => {
  // The runtime renamed this field once already, and that rename cost two days
  // of silent breakage in the hook parser.
  assert.equal(shouldForward(JSON.stringify({ notificationType: "agent_idle" })), false)
  assert.equal(shouldForward(JSON.stringify({ notification_type: "agent_idle" })), false)
  assert.equal(shouldForward(JSON.stringify({ notificationType: "permission_prompt" })), true)
  assert.equal(shouldForward(JSON.stringify({ notification_type: "permission_prompt" })), true)
})

// --- uncertainty forwards ----------------------------------------------------

test("anything unclassifiable is forwarded rather than dropped", () => {
  const uncertain: Array<[string, string]> = [
    ["", "empty stdin"],
    ["not json at all", "malformed JSON"],
    ["null", "null payload"],
    ["[]", "array payload"],
    ["{}", "no type field"],
    [JSON.stringify({ notification_type: "" }), "empty type"],
    [JSON.stringify({ notification_type: 42 }), "type of the wrong kind"],
    [JSON.stringify({ renamed_again: "permission_prompt" }), "a future rename"],
    [JSON.stringify({ notification_type: "some_new_blocking_thing" }), "an unknown type"],
  ]

  for (const [input, why] of uncertain) {
    assert.equal(shouldForward(input), true, `${why} must forward`)
  }
})

test("an unknown type forwards, so a new blocking type is noisy rather than silent", () => {
  // This is the whole reason the list is an allow-list of BLOCKING types rather
  // than a deny-list of known noise. Noise is fixed by adding one string here;
  // silence is a missed prompt that nothing reports.
  assert.equal(shouldForward(JSON.stringify({ notification_type: "future_prompt" })), true)
})
