import { sleep } from 'src/common/utils/sleep';

describe('sleep', () => {
  it('resolves after the given amount of time', async () => {
    jest.useFakeTimers();

    const promise = sleep(1000);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);

    jest.useRealTimers();
  });
});
