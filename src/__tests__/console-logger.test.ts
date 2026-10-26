/**
 * @jest-environment node
 */
import fs from 'fs';

describe('setupConsoleLogger (ATD-5)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not throw on a read-only filesystem such as Vercel', () => {
    jest.isolateModules(() => {
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw Object.assign(new Error("EROFS: read-only file system, mkdir '/var/task/output'"), { code: 'EROFS' });
      });
      const appendSpy = jest.spyOn(fs, 'appendFile');
      const originalLog = console.log;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setupConsoleLogger } = require('../lib/console-logger');

      expect(() => setupConsoleLogger()).not.toThrow();
      expect(console.log).toBe(originalLog);
      expect(appendSpy).not.toHaveBeenCalled();
    });
  });
});
