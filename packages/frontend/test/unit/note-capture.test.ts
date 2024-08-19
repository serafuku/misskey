/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent } from 'vue';
import { EventEmitter } from 'eventemitter3';
import type { entities } from 'misskey-js';
import { noteEvents, useNoteCapture } from '@/composables/use-note-capture.js';

const { stream } = vi.hoisted(() => ({ stream: { send: vi.fn(), on: vi.fn(), off: vi.fn() } }));
vi.mock('@/stream.js', () => ({ useStream: () => stream }));
vi.mock('@/i.js', () => ({ $i: { id: 'viewer' } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true } } }));
vi.mock('@/events.js', () => ({ globalEvents: new EventEmitter() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@@/js/interval.js', () => ({ createVisibilityAwareInterval: vi.fn() }));

describe('note capture', () => {
	test('subscribes once, applies edits, preserves viewer votes, and cleans up', () => {
		const note = {
			id: 'note', createdAt: '2026-01-01T00:00:00Z', text: 'before', emojis: {},
			reactions: {}, reactionCount: 0, reactionEmojis: {}, files: [], fileIds: [],
			poll: { multiple: false, expiresAt: null, choices: [{ text: 'yes', votes: 1, isVoted: true }] },
		} as unknown as entities.Note;
		let capture!: ReturnType<typeof useNoteCapture>;
		const app = createApp(defineComponent({
			setup() {
				capture = useNoteCapture({ note, parentNote: null });
				return () => null;
			},
		}));
		app.mount(document.createElement('div'));
		try {
			capture.subscribe();
			capture.subscribe();
			expect(stream.send).toHaveBeenCalledTimes(1);
			expect(stream.on).toHaveBeenCalledTimes(2);
			noteEvents.emit('noteUpdated:note', {
				text: 'after :remote:', cw: null, files: [{ id: 'file' }] as entities.DriveFile[],
				updatedAt: '2026-01-02T00:00:00Z', emojis: { remote: 'https://example.com/emoji.png' },
				poll: { multiple: false, expiresAt: null, choices: [{ text: 'yes', votes: 2, isVoted: false }] },
			});
			expect(capture.$note.text).toBe('after :remote:');
			expect(capture.$note.emojis).toEqual({ remote: 'https://example.com/emoji.png' });
			expect(capture.$note.pollChoices[0]).toMatchObject({ votes: 2, isVoted: true });
			expect(note.fileIds).toEqual(['file']);
		} finally {
			app.unmount();
		}
		expect(stream.off).toHaveBeenCalledTimes(2);
		expect(noteEvents.listenerCount('noteUpdated:note')).toBe(0);
	});
});
