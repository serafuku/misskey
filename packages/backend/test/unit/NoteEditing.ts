/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import { NoteHistorySerivce } from '@/core/NoteHistoryService.js';
import { MiNote } from '@/models/Note.js';
import { MiPoll } from '@/models/Poll.js';
import NotesHistory from '@/server/api/endpoints/notes/history.js';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { MiPollVote } from '@/models/PollVote.js';

vi.mock('@/misc/distributed-lock.js', () => ({ acquireApObjectLock: async () => () => {} }));

const logger = { info: vi.fn(), error: vi.fn() };

describe('note editing', () => {
	test('rejects a different author before writing anything', async () => {
		const service = Object.create(NoteUpdateService.prototype);
		await expect(service.update({ id: 'other-user' }, {}, { userId: 'author' })).rejects.toThrow('another user');
	});

	test('removing a poll also persists the edited note and removes old votes', async () => {
		const note = new MiNote({ id: 'note', userId: 'author', hasPoll: true, text: 'before', fileIds: [] });
		const removed: unknown[] = [];
		const manager = {
			update: vi.fn(async (_entity, _where, values) => Object.assign(note, values)),
			delete: vi.fn(async (entity) => { removed.push(entity); }),
		};
		const service = Object.assign(Object.create(NoteUpdateService.prototype), {
			db: { transaction: async (fn: (em: typeof manager) => Promise<void>) => fn(manager) },
			notesRepository: { findOneBy: async () => note },
			noteHistoryService: { recordHistory: vi.fn() },
			logger,
		});
		const updated = await service.updateNote({ id: 'author', host: null }, note, { text: 'after', poll: null }, [], []);
		expect(updated.text).toBe('after');
		expect(updated.hasPoll).toBe(false);
		expect(removed).toContain(MiPoll);
		expect(removed).toContain(MiPollVote);
	});

	test('retains the intermediate version when reverting A to B to A', async () => {
		const records: { text: string }[] = [];
		const repository = {
			findOne: async () => records.at(-1),
			insert: async (record: { text: string }) => { records.push(record); },
		};
		const service = new NoteHistorySerivce({} as never, repository as never,
			{ gen: () => 'history', parse: () => ({ date: new Date(0) }) } as never,
			{ getLogger: () => logger } as never);
		const a = new MiNote({ id: 'note', text: 'A', fileIds: [] });
		const b = new MiNote({ id: 'note', text: 'B', fileIds: [] });
		await service.recordHistory(b, a, {});
		await service.recordHistory(a, b, {});
		expect(records.map(r => r.text)).toEqual(['A', 'B']);
	});
});

describe('note history access', () => {
	test.each([
		{ isHidden: true, visitor: 'all', host: null, allowed: false },
		{ isHidden: false, visitor: 'none', host: null, allowed: false },
		{ isHidden: false, visitor: 'local', host: 'remote.example', allowed: false },
		{ isHidden: false, visitor: 'local', host: null, allowed: true },
		{ isHidden: false, visitor: 'all', host: 'remote.example', allowed: true },
	])('respects visibility: $isHidden / $visitor / $host', async ({ isHidden, visitor, host, allowed }) => {
		const getHistory = vi.fn(async () => null);
		const endpoint = new NotesHistory(
			{ ugcVisibilityForVisitor: visitor } as never,
			{ pack: async () => ({ isHidden }) } as never,
			{} as never,
			{ getHistory } as never,
			{ getNote: async () => ({ id: 'note', userHost: host }) } as never,
		);
		if (allowed) {
			await expect(endpoint.exec({ noteId: 'note' }, null, null)).resolves.toEqual([]);
			expect(getHistory).toHaveBeenCalledOnce();
		} else {
			await expect(endpoint.exec({ noteId: 'note' }, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
			expect(getHistory).not.toHaveBeenCalled();
		}
	});
});

describe('federated note edits', () => {
	const actor = { id: 'author', uri: 'https://remote.example/users/author' };

	function inbox(authorId = actor.id) {
		return Object.assign(Object.create(ApInboxService.prototype), {
			notesRepository: { findOneBy: async () => ({ id: 'note', userId: authorId }) },
			utilityService: { extractDbHost: (uri: string) => new URL(uri).host },
			apNoteService: { updateNote: vi.fn() },
			apQuestionService: { updateQuestion: vi.fn() },
		});
	}

	test('rejects an update by another author on the same server', async () => {
		const service = inbox('other');
		await expect(service.updateNote({}, actor, { id: 'https://remote.example/notes/n', type: 'Note', attributedTo: actor.uri })).resolves.toContain('not the note author');
		expect(service.apNoteService.updateNote).not.toHaveBeenCalled();
	});
	test.each([undefined, [actor.uri], { id: actor.uri }])('updates both Question content and votes with attribution %j', async (attributedTo) => {
		const service = inbox();
		await expect(service.updateNote({}, actor, { id: 'https://remote.example/notes/n', type: 'Question', attributedTo })).resolves.toBe('ok');
		expect(service.apNoteService.updateNote).toHaveBeenCalledOnce();
		expect(service.apQuestionService.updateQuestion).toHaveBeenCalledOnce();
	});
});
