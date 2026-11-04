// Runs async tasks one after another, in the order they arrive.
// Node handles many requests at once, so without this two registrations could both
// read "1 seat left" before either of them saves; the queue makes check-and-save one step.
export function createSerialQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    // A failed task (e.g. "Event is full") must not block the tasks waiting behind it.
    tail = result.catch(() => {});
    return result;
  };
}
