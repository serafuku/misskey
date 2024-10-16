/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { CleanRemoteFilesProcessorService } from '@/queue/processors/CleanRemoteFilesProcessorService.js';
import { CleanExpiredRemoteFilesProcessorService } from '@/queue/processors/CleanExpiredRemoteFilesProcessorService.js';

describe('remote cache cleanup', () => {
	test('deletes cached files through DriveService when object storage is disabled', async () => {
		const file = { id: 'remoteFile' };
		const find = vi.fn().mockResolvedValueOnce([file]).mockResolvedValueOnce([]);
		const deleteFileSync = vi.fn();
		const service = Object.assign(Object.create(CleanRemoteFilesProcessorService.prototype), {
			driveFilesRepository: { countBy: async () => 1, find },
			usersRepository: { find: async () => [] },
			driveService: { deleteFileSync },
			metaService: { fetch: async () => ({ useObjectStorage: false }) },
			logger: { info: vi.fn(), succ: vi.fn() },
		});
		await service.process({ updateProgress: vi.fn() });
		expect(deleteFileSync).toHaveBeenCalledExactlyOnceWith(file, true);
		expect(find.mock.calls[0][0].where).toMatchObject({ isLink: false });
		expect(find.mock.calls[0][0].where.userHost).toBeDefined();
	});

	test('disabled expiry does not delete cache files', async () => {
		const deleteFileSync = vi.fn();
		const service = Object.assign(Object.create(CleanExpiredRemoteFilesProcessorService.prototype), {
			metaService: { fetch: async () => ({ objectStorageCacheDays: null }) },
			driveService: { deleteFileSync },
			logger: { debug: vi.fn() },
		});
		await service.process();
		expect(deleteFileSync).not.toHaveBeenCalled();
	});
});

describe('orphaned object storage files', () => {
	const old = new Date('2000-01-01T00:00:00Z');
	const meta = { useObjectStorage: true, objectStorageBucket: 'dedicated', objectStoragePrefix: 'current' };

	function setup(contents: Record<string, unknown>[] = []) {
		const list = vi.fn().mockResolvedValue({ Contents: contents, IsTruncated: false });
		const remove = vi.fn().mockResolvedValue({});
		const exists = vi.fn().mockResolvedValue(false);
		const logger = { info: vi.fn(), succ: vi.fn() };
		const service = Object.assign(Object.create(CleanRemoteFilesProcessorService.prototype), {
			metaService: { fetch: async () => meta },
			s3Service: { list, delete: remove },
			driveFilesRepository: { exists },
			logger,
		});
		return { service, list, remove, exists, logger };
	}

	test('cleans old prefixes across pages while preserving all three DB reference types', async () => {
		const { service, list, remove, exists } = setup();
		const references: Record<string, string>[] = [
			{ accessKey: 'old/original' },
			{ thumbnailAccessKey: 'old/thumbnail' },
			{ webpublicAccessKey: 'old/webpublic' },
		];
		exists.mockImplementation(async ({ where }) => where.some((query: Record<string, string>) =>
			references.some(reference => Object.entries(query).some(([column, key]) => reference[column] === key))));
		list.mockResolvedValueOnce({
			Contents: ['old/original', 'old/thumbnail', 'old/webpublic', 'old/orphan'].map(Key => ({ Key, LastModified: old })),
			IsTruncated: true,
		}).mockResolvedValueOnce({ Contents: [{ Key: 'previous/orphan', LastModified: old }], IsTruncated: false });

		await service.cleanOrphanedFiles();
		expect(list.mock.calls[0][1]).toEqual({ Bucket: 'dedicated' });
		expect(list.mock.calls[1][1]).toEqual({ Bucket: 'dedicated', Marker: 'old/orphan' });
		expect(remove.mock.calls.map(call => call[1].Key)).toEqual(['old/orphan', 'previous/orphan']);
	});

	test('preserves recent uploads and objects without a valid modification time', async () => {
		const { service, exists, remove } = setup([
			{ Key: 'uploading', LastModified: new Date() },
			{ Key: 'unknown' },
			{ Key: 'invalid', LastModified: new Date(NaN) },
			{ LastModified: old },
		]);
		await service.cleanOrphanedFiles();
		expect(exists).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	test('waits for deletion to finish before reporting completion', async () => {
		const { service, remove, logger } = setup([{ Key: 'orphan', LastModified: old }]);
		let finish!: () => void;
		const pending = new Promise<void>(resolve => { finish = resolve; });
		remove.mockImplementation(() => pending);
		const running = service.cleanOrphanedFiles();
		await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
		expect(logger.succ).not.toHaveBeenCalled();
		finish();
		await running;
		expect(logger.succ).toHaveBeenCalledWith('1 orphaned files deleted.');
	});

	test('propagates storage failures instead of reporting successful cleanup', async () => {
		const { service, remove, logger } = setup([{ Key: 'orphan', LastModified: old }]);
		remove.mockRejectedValue(new Error('storage unavailable'));
		await expect(service.cleanOrphanedFiles()).rejects.toThrow('storage unavailable');
		expect(logger.succ).not.toHaveBeenCalled();
	});

	test('follows an explicit continuation marker and rejects a stuck listing', async () => {
		const { service, list } = setup();
		list.mockResolvedValue({ Contents: [], IsTruncated: true, NextMarker: 'cursor' });
		await expect(service.cleanOrphanedFiles()).rejects.toThrow('continuation marker');
		expect(list).toHaveBeenCalledTimes(2);
		expect(list.mock.calls[1][1]).toEqual({ Bucket: 'dedicated', Marker: 'cursor' });
	});
});
